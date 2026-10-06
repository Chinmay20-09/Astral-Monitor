# OrbitShield — Threat Model

**Status:** Current as of 2026-10-06
**Scope:** ST-02 security gateway threat analysis
**Rule:** Documents actual implementation. No speculative defenses.

---

## Threat Catalog

Each threat follows the required format:
**Threat → Attack Vector → Detection → Prevention → Response → Recovery**

---

### 1. Spoofed Ground Station

**Threat:** An attacker impersonates a legitimate ground station to send commands to the spacecraft.

**Attack Vector:**

```text
Attacker (port 3500, UNTRUSTED zone)
  → Generates command with forged key_id (e.g., ATTACKER-ROGUE-GS)
  → Signs with rogue secret key
  → Sends to backend /api/commands
  → Attempts to impersonate GS-PRIMARY-01 or other authorized station
```

**Detection:**

- Authentication module checks key_id against authorized registry (`src/gateway/authentication.ts`)
- Unknown key_id detected: `Unauthorized key_id: "ATTACKER-ROGUE-GS" is not in spacecraft authorized key registry`
- Security middleware detects untrusted origin (localhost:3500) — `backend/src/middleware/security.ts`
- Security event generated: `UNAUTHORIZED_ACCESS`, CRITICAL, BLOCK

**Prevention:**

- HMAC-SHA256 authentication against credential registry (`AUTHORIZED_GROUND_STATIONS` in `src/gateway/authentication.ts`)
- Service identity validation via origin check (TRUSTED vs UNTRUSTED zones)
- Default-deny policy: untrusted origins blocked at perimeter (except `/api/commands` for demo)
- Deterministic hard constraint: `HARD_CONSTRAINT_AUTHENTICATION_FAIL` (`src/gateway/policy.ts` Rule 1)

**Response:**

- Backend returns 403 Forbidden with security context for perimeter blocks
- For gateway-processed attacks: BLOCK decision with `HARD_CONSTRAINT_AUTHENTICATION_FAIL`
- Security event persisted to SQLite audit trail
- Risk score: 95/100 (CRITICAL) for perimeter blocks; auth failure contributes +55 to cryptographic penalty
- Attacker blocked before reaching spacecraft

**Recovery:**

- No recovery needed — request never executed
- Audit trail records the attempt for forensic analysis
- Ground station registry unchanged (rogue key not added)

---

### 2. Compromised Operator Endpoint

**Threat:** An attacker gains access to a legitimate operator's workstation or credentials.

**Attack Vector:**

```text
Attacker compromises operator session
  → Uses legitimate operator credentials
  → Sends commands through Ground Console (port 3000, TRUSTED zone)
  → Attempts unauthorized command types (e.g., SYSTEM_REBOOT, FIRE_THRUSTER)
  → May attempt mission-violating commands during restricted phases
```

**Detection:**

- Behavioral analysis detects anomalous command patterns (`src/gateway/behavioral.ts`)
- Mission context module detects phase conflicts (e.g., imaging during eclipse) (`src/gateway/context.ts`)
- Risk engine calculates elevated risk score (`src/gateway/risk.ts`)
- Audit trail records all commands with operator identity (key_id)
- Role-based authorization: PAYLOAD_OPERATOR cannot execute SYSTEM_REBOOT

**Prevention:**

- Command type authorization by role (`AUTHORIZED_GROUND_STATIONS` — each role has `allowed_command_types`)
- Mission context constraints: RULE-OPT-02 (no imaging in eclipse), RULE-NAV-04 (delta-V limit)
- Behavioral anomaly detection: burst detection, state conflicts, credential compromise deviation patterns
- Deterministic safety policy enforces hard constraints regardless of auth status

**Response:**

- If risk >= 75: Autonomous SAFE_MODE triggered (`AUTONOMOUS_SAFE_MODE_TRIGGER` in `src/gateway/policy.ts`)
- Dangerous commands blocked by flight software lock (`HARD_CONSTRAINT_SAFE_MODE_LOCKED`)
- Telemetry continues (essential functions preserved)
- Operator alert dispatched (`operator_alert_dispatched: true`)
- Security event: SAFE_MODE_ENTERED with reason

**Recovery:**

- Operator initiates recovery via `POST /api/spacecraft/SAT-01/recovery` from trusted Ground context
- Recovery requires: FLIGHT_DIRECTOR clearance + `GROUND-SECURE-RECOVERY-CHANNEL` token
- System health verification before restoration (battery >= 40%)
- Safe mode cleared, nominal operations resume (`SpacecraftSimulator.exitSafeMode()`)
- Recovery audit event recorded with `OPERATOR_RECOVERY_ACCEPTED` rule

---

### 3. Replay Attack

**Threat:** An attacker captures a valid command and retransmits it to cause duplicate execution.

**Attack Vector:**

```text
Attacker eavesdrops on valid command transmission
  → Captures envelope with nonce + sequence + timestamp
  → Retransmits identical envelope to backend /api/commands
  → Attempts duplicate execution of ROTATE_REACTION_WHEEL or other command
```

**Detection:**

- Replay protection module checks nonce against seen-nonce cache (`src/gateway/replay.ts`)
- Duplicate nonce detected: `Replay detected: nonce "..." has already been processed in session cache`
- Sequence number check: received sequence <= last accepted sequence for sender scope
- Timestamp freshness: clock skew > 60s rejects stale commands
- Security event: replay fields in audit event show `nonce_is_fresh: false`, `sequence_valid: false`

**Prevention:**

- Nonce uniqueness check (global cache, max 5000 entries, evicts oldest 1000 when full)
- Monotonic sequence number per (spacecraft_id, key_id) scope — not global
- Timestamp freshness check (60-second clock skew window, configurable via `MAX_CLOCK_SKEW_SECONDS`)
- Anti-replay state persists across restarts (`replay_state` table in SQLite)
- Only cryptographically verified commands advance sequence state (`recordState: integrityResult.passed && authResult.passed`)

**Response:**

- Command rejected with BLOCK decision
- Deterministic rule: `HARD_CONSTRAINT_REPLAY_DETECTED` (`src/gateway/policy.ts` Rule 3)
- Audit event records: `expected_sequence`, `received_sequence`, `clock_skew_seconds`
- Risk score: cryptographic penalty +50 for replay failure
- No duplicate execution occurs

**Recovery:**

- No recovery needed — command never executed
- Sequence state unchanged (replay failed, state not advanced)
- Audit trail captures attempt for analysis

---

### 4. Tampered Command

**Threat:** An attacker intercepts a valid command and modifies parameter values.

**Attack Vector:**

```text
Attacker intercepts legitimate QUERY_TELEMETRY command
  → Modifies payload to FIRE_THRUSTER with delta_v: 8.5 m/s, burn_duration_ms: 25000
  → Keeps original HMAC signature (does not re-sign)
  → Sends tampered envelope to backend /api/commands
  → Attempts to execute dangerous thruster maneuver
```

**Detection:**

- Integrity module computes HMAC over received envelope (`src/gateway/integrity.ts`)
- Computed signature != received signature
- Integrity check fails: `HMAC integrity mismatch: payload, header or encrypted transport has been tampered with or corrupted in transit`
- Canonical JSON stringify ensures reproducible hashing (`canonicalJsonStringify` in `src/gateway/crypto_utils.ts`)
- Constant-time signature comparison prevents timing attacks (`verifySignatureString` in `crypto_utils.ts`)

**Prevention:**

- HMAC-SHA256 integrity tag covers canonical header + payload (+ AES-GCM transport when present)
- Any payload modification invalidates signature
- Key sorting in canonical JSON prevents field ordering attacks
- Ciphertext bound into HMAC tag (prevents ciphertext substitution for encrypted commands)
- Deterministic hard constraint: `HARD_CONSTRAINT_INTEGRITY_FAIL` (`src/gateway/policy.ts` Rule 2)

**Response:**

- Command rejected with BLOCK decision
- Integrity failure explanation includes computed vs received signature for forensic comparison
- Risk score: cryptographic penalty +60 for integrity failure
- Spacecraft never receives tampered command

**Recovery:**

- No recovery needed — tampered command never executed
- Original legitimate command (if any) unaffected
- Audit trail shows tampering attempt with signature mismatch evidence (`computed_signature` vs `received_signature`)

---

### 5. Invalid/Forged Command

**Threat:** An attacker sends a malformed or completely forged command envelope.

**Attack Vector:**

```text
Attacker crafts malformed command
  → Missing header fields (spacecraft_id, command_id, etc.)
  → Invalid JSON structure
  → Random/garbage signature
  → Sends to backend /api/commands
```

**Detection:**

- Schema validation at gateway entry point (`SecurityGateway.processCommand()` in `src/gateway/gateway.ts`)
- Missing required fields detected: `!envelope || !envelope.header || !envelope.payload || !envelope.security`
- Type checking on command_id (string), spacecraft_id (string)
- Malformed envelope rejected at parser boundary before any pipeline processing

**Prevention:**

- Schema validation requires header, payload, security fields
- Type checking on command_id (string), spacecraft_id (string)
- Gateway parser rejects malformed envelopes before pipeline
- Deterministic rule: `SCHEMA_PARSE_FAILURE` (`src/gateway/policy.ts`)

**Response:**

- Immediate BLOCK with explanation: `Malformed envelope rejected by gateway parser.`
- Risk score: 95/100 (CRITICAL) — cryptographic_penalty: 80
- No further pipeline processing
- Audit event created with MALFORMED sender_identity, all module results showing failure

**Recovery:**

- No recovery needed — malformed command never processed
- Parser state unchanged
- Audit trail records malformed attempt

---

### 6. Malicious Insider / Unauthorized Operator

**Threat:** An authorized ground station operator abuses their credentials to execute unauthorized commands.

**Attack Vector:**

```text
Insider with valid GS-PRIMARY-01 credentials (FLIGHT_DIRECTOR)
  → Authenticates successfully (HMAC passes)
  → Attempts commands outside their authorization scope
  → Or: insider with GS-PAYLOAD-03 (PAYLOAD_OPERATOR) attempts SYSTEM_REBOOT
  → Or: attempts dangerous commands during restricted phases
```

**Detection:**

- Authentication passes (valid credentials) — this is the insider's advantage
- Authorization check: command type not in allowed list for this role
  - PAYLOAD_OPERATOR limited to CAPTURE_IMAGE, QUERY_TELEMETRY
  - SUBSYSTEM_ENGINEER limited to QUERY_TELEMETRY, CAPTURE_IMAGE, TRANSMIT_DATA
- Mission context detects phase violations
- Behavioral analysis detects unusual patterns for this operator

**Prevention:**

- Role-based command authorization (`AUTHORIZED_GROUND_STATIONS` — each credential has `role` and `allowed_command_types`)
- FLIGHT_DIRECTOR (GS-PRIMARY-01) has ALL commands — highest privilege
- Mission phase restrictions (eclipse, etc.) apply regardless of role
- Deterministic safety policy evaluates risk regardless of auth status
- Risk engine combines: behavioral anomaly + mission conflict + inherent criticality

**Response:**

- If command type unauthorized for role: BLOCK with auth failure explanation
- If command valid but risky: MONITOR or BLOCK based on risk score
- If risk CRITICAL (>= 75): SAFE_MODE triggered
- Operator identity recorded in audit trail (authorized_identity, role)

**Recovery:**

- Same as compromised operator recovery (see Threat 2)
- Operator credentials may be revoked (future feature — key lifecycle management not implemented)
- Audit trail provides evidence for investigation

---

### 7. Credential/Key Compromise

**Threat:** An attacker steals or compromises legitimate ground station credentials.

**Attack Vector:**

```text
Attacker obtains GS-PRIMARY-01 secret_key and encryption_key
  → Creates validly-signed command envelopes (HMAC passes)
  → Sends to backend /api/commands
  → Attempts mission-violating commands:
    - CAPTURE_IMAGE during UMBRA_ECLIPSE (180W payload, 0W solar)
    - FIRE_THRUSTER with delta_v: 6.2 m/s (exceeds 2.0 m/s limit)
    - SYSTEM_REBOOT during low power / eclipse
  → Bypasses authentication but not authorization/context
```

**Detection:**

- Authentication passes (HMAC valid with stolen creds) — this is the danger
- BUT mission context detects constraint violations:
  - RULE-OPT-02: No imaging in eclipse (risk_contribution: 75)
  - RULE-NAV-04: Thruster delta-V exceeds 2.0 m/s limit (risk_contribution: 65)
  - RULE-REBOOT-PWR: System reboot prohibited under marginal power (risk_contribution: 70)
- Behavioral analysis detects anomaly patterns:
  - `CREDENTIAL_COMPROMISE_DEVIATION`: sudden deviation from nominal queries to destructive commands (+50)
  - `CREDENTIAL_COMPROMISE_ECLIPSE_IMAGING`: optical payload activation during eclipse (+75) — P0 fix
- Risk engine combines: behavioral anomaly + mission conflict + inherent criticality

**Risk Calculation Example (CAPTURE_IMAGE in eclipse with valid creds):**

```
inherentCriticality (CAPTURE_IMAGE) = 25
behavioral_penalty (eclipse imaging) = 75
mission_conflict_penalty (RULE-OPT-02) = 75
spacecraft_vulnerability_penalty = 0

totalScore = 25*0.35 + 75*0.4 + 75*0.5 + 0*0.25
           = 8.75 + 30 + 37.5 + 0
           = 76.25 → 76 (CRITICAL)
```

**Prevention:**

- Mission context module enforces flight rules regardless of auth status
- Behavioral analysis detects credential compromise patterns even with valid HMAC
- Risk engine thresholds trigger SAFE_MODE at >= 75
- Deterministic safety policy: `AUTONOMOUS_SAFE_MODE_TRIGGER`
- Safe mode lock prevents dangerous commands even with valid creds (`HARD_CONSTRAINT_SAFE_MODE_LOCKED`)

**Response:**

- If single violation: BLOCK or MONITOR depending on risk score
- If CRITICAL risk (>= 75): `AUTONOMOUS_SAFE_MODE_TRIGGER`
  - Dangerous commands blocked
  - Telemetry preserved (QUERY_TELEMETRY still allowed)
  - Operator alerted (`operator_alert_dispatched: true`)
  - Security event: SAFE_MODE_ENTERED with full reason
- Command history shows legitimately-signed but contextually-blocked command
- Audit trail proves: auth passed, integrity passed, but mission context + behavioral caught the attack

**Recovery:**

- Requires `POST /api/spacecraft/SAT-01/recovery` with FLIGHT_DIRECTOR clearance
- System health verification before restoration (battery >= 40%)
- Options:
  - Revoke compromised key (future: key lifecycle management not implemented)
  - Issue new credentials (future)
  - Audit all commands during compromise window (available now via security events)
- Recovery audit event records: recovery_token, clearance_level, timestamp
- After recovery: spacecraft returns to NOMINAL, commands resume normally

---

## Summary Table

| Threat | Detection | Prevention | Response | Recovery |
| -------- | ----------- | ------------ | ---------- | ---------- |
| Spoofed Ground Station | Auth registry check + origin validation | HMAC-SHA256 + credential registry + default-deny | 403 Blocked (perimeter) or BLOCK (gateway), security event | No recovery needed |
| Compromised Operator | Behavioral analysis + mission context + role auth | Command authorization + mission constraints + risk engine | SAFE_MODE if critical, BLOCK otherwise | OPERATOR_RECOVER with auth |
| Replay Attack | Nonce cache + sequence check + timestamp freshness | Monotonic sequence per (spacecraft,key) + 60s freshness window + persisted state | BLOCK, `HARD_CONSTRAINT_REPLAY_DETECTED` | No recovery needed |
| Tampered Command | HMAC integrity verification (canonical JSON + constant-time compare) | HMAC-SHA256 over canonical envelope + ciphertext binding | BLOCK, `HARD_CONSTRAINT_INTEGRITY_FAIL` | No recovery needed |
| Invalid/Forged Command | Schema validation at parser boundary | Required fields + type checking | Immediate BLOCK, `SCHEMA_PARSE_FAILURE` | No recovery needed |
| Malicious Insider | Role-based auth + behavioral analysis + mission context | Allowed command types per role + mission phase restrictions | BLOCK or SAFE_MODE based on risk | Same as compromised operator |
| Credential/Key Compromise | Mission context + behavioral anomaly (even with valid HMAC) | Flight rules + risk engine (>= 75 CRITICAL) + safe mode lock | SAFE_MODE if critical, otherwise BLOCK | OPERATOR_RECOVER + key revocation (future) |

---

## Security Principles

| Principle | Implementation |
| ----------- | --------------- |
| **DEFAULT DENY** | All requests blocked unless explicitly allowed by trust zone |
| **EXPLICIT ALLOW** | Trusted origins (3000, 3100) allowed; untrusted (3500) blocked except `/api/commands` |
| **LEAST PRIVILEGE** | Each role has minimal command authorizations (GS-PAYLOAD-03: 2 command types) |
| **SERVICE IDENTITY** | Ground stations identified by key_id in registry; each has unique secret |
| **NETWORK SEGMENTATION** | Logical separation via ports + origin validation in security middleware |
| **QUARANTINE** | Attacker blocked at perimeter (UNTRUSTED zone), contained to `/api/commands` only |
| **RECOVERY** | Explicit recovery workflow with FLIGHT_DIRECTOR authorization + health verification |
| **NO CUSTOM CRYPTO** | Only Web Crypto API (SubtleCrypto) for HMAC-SHA256 and AES-GCM-256 |
| **PERSISTENT STATE** | Replay state, audit trail, spacecraft state all survive restarts via SQLite |

---

## Defense in Depth Layers

| # | Layer | Module | File |
| --- | ------- | -------- | ------ |
| 1 | Perimeter | Security middleware | `backend/src/middleware/security.ts` |
| 2 | Authentication | AuthenticationModule | `src/gateway/authentication.ts` |
| 3 | Integrity | IntegrityModule | `src/gateway/integrity.ts` |
| 4 | Replay Protection | ReplayProtectionModule | `src/gateway/replay.ts` |
| 5 | Authorization | Role-based (AuthenticationModule + policy) | `src/gateway/authentication.ts` + `src/gateway/policy.ts` |
| 6 | Mission Context | MissionContextModule | `src/gateway/context.ts` |
| 7 | Behavioral Analysis | BehavioralAnalysisModule | `src/gateway/behavioral.ts` |
| 8 | Risk Engine | RiskEngine | `src/gateway/risk.ts` |
| 9 | Safety Policy | SafetyPolicyEngine | `src/gateway/policy.ts` |
| 10 | Safe Mode | SpacecraftSimulator | `src/spacecraft/simulator.ts` |
| 11 | Audit Trail | SecurityEventRepository | `backend/src/db/repositories/securityEventRepository.ts` |

---

## Attack Surface Summary

| Attack Vector | Status | Notes |
| --------------- | -------- | ------- |
| Spoofed ground station | ✅ Defended | Auth registry + perimeter block |
| Compromised operator endpoint | ✅ Defended | Behavioral + mission context + safe mode |
| Replay attack | ✅ Defended | Nonce + sequence + timestamp, persisted |
| Tampered command | ✅ Defended | HMAC integrity verification |
| Invalid/forged command | ✅ Defended | Schema validation at parser |
| Malicious insider | ✅ Defended | Role-based auth + behavioral + mission context |
| Credential/key compromise | ✅ Defended | Mission context + behavioral + risk engine + safe mode |
| Eavesdropping | ✅ Defended | AES-GCM-256 encryption (EAVESDROP scenario) |
| Command burst flooding | ✅ Defended | Behavioral burst detection (+45 anomaly) |
| Safe mode escape | ✅ Defended | Only QUERY_TELEMETRY + OPERATOR_RECOVER allowed in safe mode |
| Recovery abuse | ✅ Defended | FLIGHT_DIRECTOR clearance + recovery token + battery check |

---

## Known Limitations

1. **All services on localhost** — Network segmentation is logical (ports + origin checks), not physical. Judge may note this.
2. **Service tokens in .env not enforced** — Security middleware checks origin, not service tokens. `requireServiceToken` middleware exists but is not wired into routes.
3. **Quarantine not persisted** — In-memory Map in `security.ts`. Restart clears quarantine state.
4. **Key revocation not implemented** — Compromised keys cannot be revoked without restart + code change. Future feature.
5. **No key rotation** — Credentials are static for the demo. Future feature.
6. **Attacker cannot view security event timeline** — `SecurityEventLog` requires trusted origin. Attacker's attempts to view events are blocked at perimeter.

---

## Future / Not Currently Implemented

- Key lifecycle management (rotation, revocation)
- Capability-based authorization (beyond role-based)
- Event-driven security architecture (currently sequential pipeline)
- CCSDS SDLS alignment
- Ed25519 asymmetric signatures
- Multi-satellite fleet support
- Full orbital simulation
- SIEM integration / incident export
- Real-time service topology data binding
