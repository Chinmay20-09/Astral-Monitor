# OrbitShield — Security Architecture

**Status:** Current as of 2026-10-06
**Scope:** Security pipeline implementation details
**Rule:** Documents actual code. No speculative functionality.

---

## 1. Pipeline Overview

```text
Perimeter (security.ts middleware)
  ↓
Authentication (AuthenticationModule)
  ↓
Integrity (IntegrityModule)
  ↓
Replay Protection (ReplayProtectionModule)
  ↓
Authorization (AuthenticationModule + policy.ts role checks)
  ↓
Mission Context (MissionContextModule)
  ↓
Behavioral Analysis (BehavioralAnalysisModule)
  ↓
Risk Engine (RiskEngine)
  ↓
Deterministic Safety Policy (SafetyPolicyEngine)
  ↓
SAFE MODE (SpacecraftSimulator.enterSafeMode())
  ↓
Recovery (OPERATOR_RECOVER → SafetyPolicyEngine → SpacecraftSimulator.exitSafeMode())
```

The pipeline executes in `SecurityGateway.processCommand()` in `src/gateway/gateway.ts`. Each layer produces a structured result that feeds the next layer. The final decision is made by `SafetyPolicyEngine.evaluate()` in `src/gateway/policy.ts`.

---

## 2. Layer: Perimeter Security

**File:** `backend/src/middleware/security.ts`

### Purpose

Enforce trust zone policy at the HTTP API boundary. Block untrusted origins from accessing privileged endpoints before any pipeline processing occurs.

### Input

- `Request` — HTTP request with `Origin` or `Referer` header

### Output

- `SecurityContext` attached to request (`req.securityContext`)
- `trustZone`: `'TRUSTED' | 'INTERNAL' | 'UNTRUSTED' | 'UNKNOWN'`

### Trust Zone Classification

| Zone | Origins | Access |
| ------ | --------- | -------- |
| TRUSTED | `localhost:3000`, `localhost:3100` (and 127.0.0.1 variants) | All endpoints |
| UNTRUSTED | `localhost:3500` (and 127.0.0.1 variant) | `/api/commands` ONLY |
| INTERNAL | `localhost:4000` | All endpoints |
| UNKNOWN | No origin, other hosts | Logged, allowed (backward compatibility) |

### Failure Behavior

- UNTRUSTED origin accessing non-`/api/commands` endpoint → HTTP 403
- Security event persisted to SQLite: `UNAUTHORIZED_ACCESS`, CRITICAL, BLOCK
- Same event ID returned in response body and persisted to database

### Security Events Produced

- `UNAUTHORIZED_ACCESS` — untrusted origin blocked from privileged endpoint
  - Risk score: 95/100 (CRITICAL)
  - Rule: `UNTRUSTED_ORIGIN_BLOCKED`

### Owner

Developer 1 (Security/Backend)

---

## 3. Layer: Authentication

**File:** `src/gateway/authentication.ts`

### Purpose

Verify that the command sender is a recognized ground station with an active credential in the authorized registry.

### Input

- `CommandEnvelope` — specifically `envelope.security.key_id`

### Output

- `AuthenticationCheckResult`:

  ```typescript
  {
    passed: boolean;
    key_id: string;
    authorized_identity?: string;   // e.g., "Svalbard Satellite Station (SvalSat)"
    role?: string;                   // FLIGHT_DIRECTOR | SUBSYSTEM_ENGINEER | PAYLOAD_OPERATOR
    error?: string;
  }
  ```

### Credential Registry

`AUTHORIZED_GROUND_STATIONS` in `authentication.ts`:

| Key ID | Station | Role | Status |
| -------- | --------- | ------ | -------- |
| `GS-PRIMARY-01` | Svalbard Satellite Station (SvalSat) | FLIGHT_DIRECTOR | ACTIVE |
| `GS-BACKUP-02` | Santiago Earth Station Backup | SUBSYSTEM_ENGINEER | ACTIVE |
| `GS-PAYLOAD-03` | Toulouse Payload Operations | PAYLOAD_OPERATOR | ACTIVE |

### Failure Behavior

- Missing `key_id` → `passed: false`, error: "Missing security key_id in command envelope"
- Unknown `key_id` → `passed: false`, error: `Unauthorized key_id: "..." is not in spacecraft authorized key registry`
- Revoked credential → `passed: false`, error: `Credential for key_id "..." has been revoked by Ground Security Policy`

### Hard Constraint (policy.ts Rule 1)

If `!auth.passed` → immediate BLOCK with `HARD_CONSTRAINT_AUTHENTICATION_FAIL`. Pipeline stops here.

### Security Events Produced

- Authentication result is part of every `AuditEvent`
- Auth failure produces `HARD_CONSTRAINT_AUTHENTICATION_FAIL` rule in policy section

### Owner

Developer 1 (Security/Backend)

---

## 4. Layer: Integrity

**File:** `src/gateway/integrity.ts`

### Purpose

Verify that the command envelope has not been tampered with by validating the HMAC-SHA256 authentication tag over the canonical JSON representation of header + payload (+ AES-GCM transport when present).

### Input

- `CommandEnvelope` — header, payload, security fields (signature, algorithm, optional ciphertext/iv)
- `secretKey` — from authenticated credential (or dummy key if auth failed)
- `options.encryptionKey?` — server-side AES transport key for encrypted commands

### Output

- `IntegrityCheckResult`:

  ```typescript
  {
    passed: boolean;
    computed_signature: string;   // HMAC computed by server
    received_signature: string;   // signature from envelope
    algorithm: string;            // HMAC-SHA256 | AES-GCM-256
    error?: string;
    decryption?: {
      performed: boolean;
      passed: boolean;
      algorithm?: string;
      error?: string;
      parameters?: Record<string, unknown>;  // plaintext params after AES-GCM decrypt
    }
  }
  ```

### How It Works

1. Build canonical JSON string: `canonicalJsonStringify({ header, payload, transport? })`
   - `canonicalJsonStringify` in `crypto_utils.ts` sorts keys alphabetically for reproducible hashing
2. Compute HMAC-SHA256 over canonical string using `secretKey`
3. Compare computed tag with received signature using constant-time comparison (`verifySignatureString`)
4. If tag matches AND envelope has `ciphertext` → attempt AES-GCM-256 authenticated decryption
5. If decryption succeeds → plaintext parameters available for pipeline; wire parameters are redacted

### Failure Behavior

- Missing signature → `passed: false`, error: "Missing HMAC authentication tag in security field"
- HMAC mismatch → `passed: false`, error: "HMAC integrity mismatch: payload, header or encrypted transport has been tampered with or corrupted in transit"
- AES-GCM decryption failure → `passed: false`, error: "Authenticated decryption of encrypted payload failed"

### Hard Constraint (policy.ts Rule 2)

If `!integrity.passed` → immediate BLOCK with `HARD_CONSTRAINT_INTEGRITY_FAIL`. Pipeline stops here.

### Security Events Produced

- Integrity result is part of every `AuditEvent`
- Integrity failure produces `HARD_CONSTRAINT_INTEGRITY_FAIL` rule in policy section
- Contains both `computed_signature` and `received_signature` for forensic comparison

### Owner

Developer 1 (Security/Backend)

---

## 5. Layer: Replay Protection

**File:** `src/gateway/replay.ts`

### Purpose

Prevent command replay by enforcing nonce uniqueness, timestamp freshness, and monotonic sequence numbers per sender scope.

### Input

- `CommandEnvelope` — specifically `header.nonce`, `header.timestamp`, `header.sequence_number`, `header.spacecraft_id`, `security.key_id`
- `options.recordState` — only true when integrity + auth both passed (prevents state poisoning)

### Output

- `ReplayCheckResult`:

  ```typescript
  {
    passed: boolean;
    nonce_is_fresh: boolean;
    sequence_valid: boolean;
    timestamp_valid: boolean;
    clock_skew_seconds: number;
    expected_sequence: number;
    received_sequence: number;
    error?: string;
  }
  ```

### How It Works

**Three independent checks:**

1. **Timestamp freshness** — Clock skew must be <= `maxClockSkewSeconds` (default 60s)
   - `clockSkewSeconds = Math.abs(now - cmdTime) / 1000`
   - If skew > threshold → `timestamp_valid: false`

2. **Nonce freshness** — Nonce must not be in global seen-nonce cache
   - Cache bounded to 5000 entries, evicts oldest 1000 when full
   - If nonce seen → `nonce_is_fresh: false`, error: `Replay detected: nonce "..." has already been processed`

3. **Sequence monotonicity** — Sequence number must be > last accepted sequence for sender scope
   - Scope: `spacecraft_id::key_id` (per spacecraft + per key, not global)
   - If sequence <= last → `sequence_valid: false`, error: `Sequence violation: received sequence X <= last executed sequence Y`

**State advancement** only when `passed && recordState`:

- Nonce added to cache
- Sequence counter updated for sender scope

### Persistence

- Replay state persisted to `replay_state` table in SQLite (per-spacecraft_id, key_id, last_sequence)
- On startup, `CommandService.rehydrateGatewayState()` seeds replay module from database
- Nonce cache rehydrated from recent command nonces in database

### Failure Behavior

- Stale timestamp → `passed: false`, error: `Stale command: timestamp skew (Xs) exceeds max threshold (Ys)`
- Replay detected → `passed: false`, error: `Replay detected: nonce "..." has already been processed`
- Sequence violation → `passed: false`, error: `Sequence violation: received sequence X <= last executed sequence Y`

### Hard Constraint (policy.ts Rule 3)

If `!replay.passed` → immediate BLOCK with `HARD_CONSTRAINT_REPLAY_DETECTED`. Pipeline stops here.

### Security Events Produced

- Replay result is part of every `AuditEvent`
- Replay failure produces `HARD_CONSTRAINT_REPLAY_DETECTED` rule in policy section
- Contains `expected_sequence` and `received_sequence` for forensic comparison

### Owner

Developer 1 (Security/Backend)

---

## 6. Layer: Authorization

**File:** `src/gateway/authentication.ts` (role) + `src/gateway/policy.ts` (enforcement)

### Purpose

Verify that the authenticated sender is authorized to execute the specific command type. Separates authentication (who are you?) from authorization (are you allowed to do this?).

### Input

- `AuthenticationCheckResult` — includes `role`
- `CommandEnvelope.payload.command_type`

### Role-Based Authorization

| Role | Allowed Command Types |
| ------ | ---------------------- |
| FLIGHT_DIRECTOR (`GS-PRIMARY-01`) | ALL |
| SUBSYSTEM_ENGINEER (`GS-BACKUP-02`) | QUERY_TELEMETRY, CAPTURE_IMAGE, TRANSMIT_DATA |
| PAYLOAD_OPERATOR (`GS-PAYLOAD-03`) | CAPTURE_IMAGE, QUERY_TELEMETRY |

### Failure Behavior

- Unauthorized command type for role → blocked by safety policy
- Authorization failures feed into risk scoring and policy decisions

### Owner

Developer 1 (Security/Backend)

---

## 7. Layer: Mission Context

**File:** `src/gateway/context.ts`

### Purpose

Evaluate the command against orbital phase and mission flight rules. Determines if the command is compliant with the current mission context regardless of cryptographic validity.

### Input

- `CommandEnvelope` — command_type and parameters
- `SpacecraftState` — current vehicle state (battery, thermal, etc.)

### Output

- `MissionContextCheckResult`:

  ```typescript
  {
    is_compliant: boolean;
    conflicting_rules: string[];       // e.g., ["RULE-OPT-02: No Payload Imaging in Eclipse"]
    current_phase: string;              // e.g., "UMBRA_ECLIPSE"
    environmental_factors: string[];    // phase, solar generation, battery state
    findings: string[];
    risk_contribution: number;          // 0-80
  }
  ```

### Mission Phases

| Phase | Solar Condition | Restricted Commands |
|-------|-----------------|---------------------|
| `UMBRA_ECLIPSE` | UMBRA_ECLIPSE (0W solar) | CAPTURE_IMAGE, FIRE_THRUSTER, SYSTEM_REBOOT |
| `FULL_SUN_IMAGING` | FULL_SUN (320W solar) | FIRE_THRUSTER |

### Flight Rules Evaluated

| Rule ID | Name | Condition | Risk Contribution |
| --------- | ------ | ----------- | ------------------- |
| RULE-OPT-02 | No Payload Imaging in Eclipse | UMBRA_ECLIPSE + CAPTURE_IMAGE | +55 (→75 after P0 fix) |
| RULE-NAV-04 | Thruster Burn Delta-V Ceiling | delta_v > 2.0 m/s OR burn_duration > 15000ms | +65 |
| RULE-WHEEL-01 | Wheel Speed Limit | rpm > 5500 | +60 |
| RULE-REBOOT-PWR | System Reboot Prohibited | battery < 40% OR eclipse | +70 |
| RULE-SAFE-LOCK | SAFE_MODE Lock | operating_mode === 'SAFE_MODE' + non-allowed command | +50 |
| RULE-PHASE-RESTRICT | Propulsion Locked in Phase | FIRE_THRUSTER during restricted phase | +35 |

### Failure Behavior

- Conflicting rules → `is_compliant: false`, rules listed in `conflicting_rules`
- Risk contribution added to mission conflict penalty in risk engine

### Owner

Developer 1 (Security/Backend)

---

## 8. Layer: Behavioral Analysis

**File:** `src/gateway/behavioral.ts`

### Purpose

Analyze command sequence patterns and spacecraft state for anomalous behavior that may indicate an attack, even when cryptographic checks pass.

### Input

- `CommandEnvelope` — command_type, parameters
- `SpacecraftState` — current vehicle state

### Output

- `BehavioralCheckResult`:

  ```typescript
  {
    is_anomalous: boolean;              // anomaly_score >= 40
    anomaly_score: number;              // 0-100
    confidence: number;                 // 0.0-1.0
    findings: string[];
    explanation: string;
    suggested_risk_delta: number;       // anomalyScore * 0.7 when anomalous
    historical_pattern_detected?: string;
  }
  ```

### Anomaly Patterns Detected

| Pattern | Trigger | Anomaly Score |
| --------- | --------- | --------------- |
| COMMAND_BURST_FLOODING | >= 4 commands in 10s window | +45 |
| CRITICAL_POWER_DEPLETION_ATTEMPT | CAPTURE_IMAGE when battery < 30% | +40 |
| EXCESSIVE_DELTA_V_MANEUVER | FIRE_THRUSTER with delta_v > 2.0 | +45 |
| UNCOORDINATED_PROPULSION_MANEUVER | FIRE_THRUSTER without preceding QUERY_TELEMETRY or ROTATE_REACTION_WHEEL | +35 |
| Adversarial persistence | >= 2 recent BLOCK/SAFE_MODE verdicts | +30 |
| CREDENTIAL_COMPROMISE_DEVIATION | Sudden shift from QUERY_TELEMETRY to FIRE_THRUSTER/SYSTEM_REBOOT with delta_v > 2.0 | +50 |
| **CREDENTIAL_COMPROMISE_ECLIPSE_IMAGING** (P0 fix) | **CAPTURE_IMAGE during eclipse (in_eclipse=true)** | **+75** |

### Baseline

- No anomalies → `anomaly_score: 5`, `confidence: 0.92`, `is_anomalous: false`

### Owner

Developer 1 (Security/Backend)

---

## 9. Layer: Risk Engine

**File:** `src/gateway/risk.ts`

### Purpose

Combine all security layer results into a single 0-100 risk score with severity classification.

### Input

- `CommandEnvelope`
- `SpacecraftState`
- All check results: `IntegrityCheckResult`, `AuthenticationCheckResult`, `ReplayCheckResult`, `BehavioralCheckResult`, `MissionContextCheckResult`

### Output

- `RiskEngineResult`:

  ```typescript
  {
    total_score: number;       // 0-100
    severity: RiskSeverity;    // NORMAL | SUSPICIOUS | HIGH | CRITICAL
    breakdown: {
      cryptographic_penalty: number;
      behavioral_penalty: number;
      mission_conflict_penalty: number;
      spacecraft_vulnerability_penalty: number;
      command_inherent_criticality: number;
    };
    summary: string;
  }
  ```

### Command Inherent Criticality

| Command Type | Criticality |
| -------------- | ------------- |
| QUERY_TELEMETRY | 5 |
| TRANSMIT_DATA | 15 |
| CAPTURE_IMAGE | 25 |
| OPERATOR_RECOVER | 30 |
| SET_POWER_MODE | 35 |
| ROTATE_REACTION_WHEEL | 40 |
| EMERGENCY_SAFE_MODE | 60 |
| FIRE_THRUSTER | 70 |
| SYSTEM_REBOOT | 85 |

### Scoring Formula

**When cryptographic penalty > 0** (auth/integrity/replay failure):

```
totalScore = Math.max(cryptoPenalty, 55) + Math.round(inherentCriticality * 0.25)
```

- Cryptographic failures automatically put risk in HIGH/CRITICAL range

**When cryptography passes** (auth + integrity + replay all OK):

```
totalScore = inherentCriticality * 0.35 + behavioralPenalty * 0.4 + missionPenalty * 0.5 + spacecraftPenalty * 0.25
```

### Spacecraft Vulnerability Penalties

| Condition | Penalty |
| ----------- | --------- |
| battery < 25% | +20 |
| operating_mode === 'SAFE_MODE' | +25 |
| thermal.bus_temp_celsius > 45 OR < -15 | +15 |

### Severity Thresholds

| Score | Severity |
| ------- | ---------- |
| 0-24 | NORMAL |
| 25-49 | SUSPICIOUS |
| 50-74 | HIGH |
| 75-100 | CRITICAL |

### Owner

Developer 1 (Security/Backend)

---

## 10. Layer: Deterministic Safety Policy

**File:** `src/gateway/policy.ts`

### Purpose

Final authority over command execution and safe mode triggers. Deterministic rules override all heuristic/advisory layers.

### Input

- `CommandEnvelope`
- `SpacecraftState`
- All check results + risk result

### Output

- `PolicyDecisionResult`:

  ```typescript
  {
    decision: SecurityDecision;         // ALLOW | MONITOR | BLOCK | SAFE_MODE
    enforced_by_deterministic_rule: boolean;
    rule_triggered?: string;
    safe_mode_activated: boolean;
    safe_mode_reason?: string;
    operator_alert_dispatched: boolean;
    explanation: string;
  }
  ```

### Deterministic Rules (in priority order)

| Priority | Rule | Condition | Decision |
| ---------- | ------ | ----------- | ---------- |
| 1 | `HARD_CONSTRAINT_AUTHENTICATION_FAIL` | `!auth.passed` | BLOCK |
| 2 | `HARD_CONSTRAINT_INTEGRITY_FAIL` | `!integrity.passed` | BLOCK |
| 3 | `HARD_CONSTRAINT_REPLAY_DETECTED` | `!replay.passed` | BLOCK |
| 4a | `SAFE_MODE_TELEMETRY_EXCEPTION` | SAFE_MODE + QUERY_TELEMETRY | ALLOW |
| 4b | `OPERATOR_RECOVERY_ACCEPTED` | SAFE_MODE + OPERATOR_RECOVER + battery >= 40% | ALLOW (exits safe mode) |
| 4c | `RECOVERY_INSUFFICIENT_POWER` | SAFE_MODE + OPERATOR_RECOVER + battery < 40% | BLOCK |
| 4d | `HARD_CONSTRAINT_SAFE_MODE_LOCKED` | SAFE_MODE + non-allowed command | BLOCK |
| 5 | `AUTONOMOUS_SAFE_MODE_TRIGGER` | risk >= 75 OR severity === 'CRITICAL' | SAFE_MODE |
| 6 | `HIGH_RISK_COMMAND_BLOCK` | risk >= 50 OR severity === 'HIGH' | BLOCK |
| 7 | (monitor) | risk >= 25 OR severity === 'SUSPICIOUS' | MONITOR |
| 8 | (nominal) | all checks passed | ALLOW |

### SAFE_MODE Activation

When rule 5 triggers:

1. `SpacecraftSimulator.enterSafeMode(reason)` called
2. Vehicle state changes: `operating_mode: 'SAFE_MODE'`, `communication_status: 'SAFE_CARRIER_ONLY'`, `camera.status: 'DISABLED'`, `consumption_watts: 22.0`
3. `safe_mode_trigger_count` incremented
4. `safe_mode_reason` set to: `CRITICAL risk score (X/100) triggered by Y. Context conflicts: Z`

### Owner

Developer 1 (Security/Backend)

---

## 11. SAFE MODE

**File:** `src/spacecraft/simulator.ts` (`SpacecraftSimulator.enterSafeMode()`)

### Purpose

Place spacecraft into protective mode that restricts dangerous operations while preserving essential telemetry.

### State Changes

| Field | Before | After SAFE_MODE |
| ------- | -------- | ----------------- |
| `operating_mode` | NOMINAL | SAFE_MODE |
| `communication_status` | ONLINE | SAFE_CARRIER_ONLY |
| `camera.status` | IDLE | DISABLED |
| `power.consumption_watts` | 45.0 | 22.0 (minimal survival) |
| `flight_computer.safe_mode_trigger_count` | N | N+1 |
| `flight_computer.safe_mode_reason` | undefined | reason string |

### Allowed Commands in SAFE_MODE

- `QUERY_TELEMETRY` — essential telemetry continues
- `OPERATOR_RECOVER` — recovery path

### Blocked Commands in SAFE_MODE

- All others → `HARD_CONSTRAINT_SAFE_MODE_LOCKED`

### Owner

Developer 1 (Security/Backend)

---

## 12. Recovery

**File:** `backend/src/routes/spacecraft.ts` (endpoint) + `src/gateway/policy.ts` (rule 4b) + `src/spacecraft/simulator.ts` (`exitSafeMode()`)

### Purpose

Restore spacecraft from SAFE_MODE to NOMINAL after operator authorization and system health verification.

### Recovery Endpoint

`POST /api/spacecraft/:spacecraftId/recovery`

**Trust:** TRUSTED (requires Origin: localhost:3000)
**Authorization:** FLIGHT_DIRECTOR clearance + recovery token

### Request

```json
{
  "token": "GROUND-SECURE-RECOVERY-CHANNEL",
  "clearance_level": "FLIGHT_DIRECTOR"
}
```

### Recovery Flow

1. Endpoint receives recovery request from trusted Ground origin
2. Creates `OPERATOR_RECOVER` command envelope via `commandService.processOperatorCommand()`
3. Pipeline processes the recovery command:
   - Authentication: GS-PRIMARY-01 (FLIGHT_DIRECTOR) → passes
   - Integrity: HMAC verified → passes
   - Replay: fresh nonce + sequence → passes
   - Mission context: OPERATOR_RECOVER allowed in all phases → compliant
   - Behavioral: nominal → not anomalous
   - Risk: low inherent criticality (30) → LOW risk
   - Policy: Rule 4b `OPERATOR_RECOVERY_ACCEPTED` → ALLOW
4. `SpacecraftSimulator.exitSafeMode()` called:
   - `operating_mode: 'NOMINAL'`
   - `communication_status: 'ONLINE'`
   - `camera.status: 'IDLE'`
   - `power.consumption_watts: 48.0`
   - `flight_computer.safe_mode_reason: undefined`

### Recovery Failure Cases

- Battery < 40% → `RECOVERY_INSUFFICIENT_POWER` → BLOCK
- Not in SAFE_MODE → normal command processing (recovery is still valid, just no safe mode to exit)

### Security Events Produced

- Recovery command processed through full pipeline
- Audit event with `final_decision: ALLOW`, `rule_triggered: OPERATOR_RECOVERY_ACCEPTED`
- Contains recovery_token and clearance_level in parameters

### Owner

Developer 1 (Security/Backend) + Developer 3 (Demo/Integration — recovery execution)

---

## 13. Security Events Summary

Every command processed through the pipeline produces one `AuditEvent` with:

| Field | Content |
| ------- | --------- |
| `event_id` | `EVT-{timestamp}-{random3digit}` |
| `timestamp` | ISO 8601 UTC |
| `command_id` | From envelope header |
| `spacecraft_id` | From envelope header |
| `sender_identity` | Authorized identity from credential registry (or key_id) |
| `envelope` | Full command envelope (wire form) |
| `integrity` | Complete integrity check result |
| `authentication` | Complete auth check result |
| `replay` | Complete replay check result |
| `behavioral` | Complete behavioral analysis result |
| `mission_context` | Complete mission context result |
| `risk` | Complete risk engine result |
| `policy` | Complete policy decision result |
| `final_decision` | ALLOW | MONITOR | BLOCK | SAFE_MODE |
| `simulated_attack_type?` | Attack type tag if scenario was simulated |

### Event Types (from perimeter + pipeline)

- `UNAUTHORIZED_ACCESS` — perimeter block (untrusted origin)
- All pipeline decisions produce audit events with `final_decision` field

### Event Persistence

- All events persisted to `security_events` table in SQLite
- Queryable via `GET /api/security-events?limit=N`
- Filterable by decision, spacecraft_id, key_id
- Single event ID consistent across SQLite, HTTP response, and frontend display

---

## 14. Cryptographic Implementation

### Integrity/Authentication: HMAC-SHA256

- Algorithm: HMAC-SHA256 (symmetric MAC, NOT asymmetric digital signature)
- Key: ground station `secret_key` from credential registry
- Data: canonical JSON of `{ header, payload, transport? }`
- Comparison: constant-time (`verifySignatureString` in `crypto_utils.ts`)

### Confidentiality: AES-GCM-256

- Algorithm: AES-GCM-256
- Key: derived from ground station `encryption_key` via SHA-256 hash
- IV: 12 random bytes per encryption
- Ciphertext bound into HMAC tag (prevents ciphertext substitution)
- Server-side authenticated decryption only

### Key Management

- All keys are simulated demo credentials (TRD Section 5)
- Live only in backend process memory
- Never committed to repository as real secrets
- Frontend bundle verified to contain no secret material

### Owner

Developer 1 (Security/Backend)

---

## 15. Architectural Rules for Security Code

1. **No custom cryptography** — Only Web Crypto API (`SubtleCrypto`) for HMAC, AES-GCM
2. **No command execution without full pipeline** — Every command goes through all 10 layers
3. **Deterministic policy is final authority** — AI/behavioral recommendations cannot override hard constraints
4. **Anti-replay state only advances for verified commands** — Unauthenticated traffic cannot poison sequence stream
5. **Secrets never leave backend** — Credential material only in `src/ground_station/client.ts` and `src/gateway/authentication.ts`
6. **Audit trail is durable** — Every decision persisted in SQLite transaction
7. **Safe mode preserves telemetry** — Essential functions continue during protective mode
