# OrbitShield — Testing Documentation

**Status:** Current as of 2026-10-06
**Scope:** Test suites, manual security tests, verification procedures
**Rule:** Documents what actually exists. No invented tests.

---

## 1. Test Suites

### Unit Tests: Gateway Pipeline

**Command:** `npm run test:gateway`
**File:** `src/tests/gateway.test.ts`
**Framework:** vitest
**Count:** 10 tests

These tests verify the security gateway pipeline modules directly (in-memory, no HTTP, no database). They use `SecurityGateway`, `GroundStationClient`, `AttackSimulator`, and `SpacecraftSimulator` from `src/gateway/`, `src/ground_station/`, `src/attacker/`, and `src/spacecraft/`.

| # | Test | What It Verifies |
|---|------|------------------|
| TRD-14.1 | Valid command with genuine signature passes all checks and executes | Full pipeline: integrity ✓, auth ✓, replay ✓, behavioral nominal, final_decision: ALLOW, executed: true |
| TRD-14.2 | Modified payload fails integrity check and is blocked | Tampered command → integrity.passed: false, final_decision: BLOCK, rule: HARD_CONSTRAINT_INTEGRITY_FAIL |
| TRD-14.3 | Unknown/rogue credential fails authentication and is blocked | Rogue key → authentication.passed: false, final_decision: BLOCK, rule: HARD_CONSTRAINT_AUTHENTICATION_FAIL |
| TRD-14.4 | Replayed nonce and sequence fails replay check and is blocked | Same envelope twice → replay.nonce_is_fresh: false, replay.passed: false, final_decision: BLOCK, rule: HARD_CONSTRAINT_REPLAY_DETECTED |
| TRD-14.5 | Malformed command is gracefully rejected at parser boundary | Missing header/payload/security → final_decision: BLOCK, rule: SCHEMA_PARSE_FAILURE, no crash |
| TRD-14.6 | High-risk dangerous command violating mission constraints is blocked | FIRE_THRUSTER (delta_v: 4.5) in eclipse → integrity: true (signed), mission_context.is_compliant: false, risk >= 50, final_decision: BLOCK or SAFE_MODE |
| TRD-14.7 | Critical attack scenario triggers autonomous SAFE_MODE transition | DESTRUCTIVE_BURN with valid creds in eclipse → risk >= 75, severity: CRITICAL, final_decision: SAFE_MODE, spacecraft_state.operating_mode: SAFE_MODE, telemetry.safe_mode_active: true |
| TRD-14.8 | Essential telemetry queries remain operational in SAFE_MODE | enterSafeMode() → QUERY_TELEMETRY returns ALLOW, telemetry returned, safe_mode_active: true; CAPTURE_IMAGE returns BLOCK |
| TRD-14.9 | Deterministic policy engine overrides advisory behavioral layer | Tampered signature (corrupted hex) → policy.enforced_by_deterministic_rule: true, final_decision: BLOCK (even if behavioral score were low) |
| TRD-14.10 | Complete explainable audit record contains all required forensic fields | All AuditEvent fields present: event_id, timestamp, command_id, spacecraft_id, sender_identity, integrity, authentication, replay, behavioral, mission_context, risk, policy, final_decision |

### Integration Tests: Backend HTTP

**Command:** `npm run test:backend`
**File:** `backend/src/tests/backend.test.ts`
**Framework:** vitest (with Express test server on random port)
**Count:** 6 tests

These tests verify the backend HTTP API end-to-end (with database, migrations, full service wiring). They start a real Express server on a random port and make HTTP requests.

| # | Test | What It Verifies |
|---|------|------------------|
| 1 | Onboarding creates a spacecraft entity + active session | POST /api/spacecraft → 201, session_id defined, spacecraft_id matches |
| 2 | GET /api/sessions returns all sessions plus active one | 200, total >= 1, active session found in sessions list |
| 3 | POST /api/sessions/:id/activate switches active session | Activation returns correct session_id, after fetch shows new active + deactivated |
| 4 | GET /api/spacecraft returns current active spacecraft | 200, active_spacecraft_id defined, entity exists for that ID |
| 5 | GET /api/spacecraft/:id/twin returns valid deterministic visualization payload | 200, spacecraft_id matches, position/orbit objects exist, security_posture is NORMAL/SUSPICIOUS/CRITICAL |
| 6 | Existing SAT-01 demo behavior is unchanged | GET /api/spacecraft/SAT-01 → 200, spacecraft_id: SAT-01, operating_mode: NOMINAL |

### Running All Tests

```bash
npm test
```

This runs both suites sequentially.

---

## 2. Manual Security Tests

These are the manual verification steps for the security pipeline. Run these when validating the system or after making changes to gateway modules.

### 2.1 Normal Command

**Steps:**
1. Ensure spacecraft is NOMINAL, mission phase is FULL_SUN_IMAGING
2. Send valid QUERY_TELEMETRY command via `POST /api/commands/operator` with GS-PRIMARY-01 key
3. Check response

**Expected Result:**
- `final_decision: ALLOW`
- `executed: true`
- `integrity.passed: true`
- `authentication.passed: true`
- `replay.passed: true`
- `risk.total_score: < 25` (NORMAL)
- `spacecraft_state.operating_mode: NOMINAL`

---

### 2.2 Tampered Command

**Steps:**
1. Create valid QUERY_TELEMETRY envelope with GS-PRIMARY-01
2. Modify payload to FIRE_THRUSTER with delta_v: 8.5, burn_duration_ms: 25000
3. Keep original signature (do NOT re-sign)
4. Send to `POST /api/commands` with attackType: TAMPERING

**Expected Result:**
- `final_decision: BLOCK`
- `executed: false`
- `integrity.passed: false`
- `integrity.error` contains "HMAC integrity mismatch"
- `integrity.computed_signature != integrity.received_signature`
- `policy.rule_triggered: HARD_CONSTRAINT_INTEGRITY_FAIL`

---

### 2.3 Replay Attack

**Steps:**
1. Create valid ROTATE_REACTION_WHEEL envelope with GS-PRIMARY-01
2. Send it once (should ALLOW)
3. Send the EXACT same envelope again (same nonce, same sequence, same timestamp)
4. Check response

**Expected Result (second send):**
- `final_decision: BLOCK`
- `executed: false`
- `replay.passed: false`
- `replay.nonce_is_fresh: false`
- `replay.error` contains "Replay detected"
- `policy.rule_triggered: HARD_CONSTRAINT_REPLAY_DETECTED`

---

### 2.4 Invalid Credentials

**Steps:**
1. Create envelope with key_id: ATTACKER-ROGUE-GS (not in registry)
2. Sign with any random secret
3. Send to `POST /api/commands` with attackType: INJECTION

**Expected Result:**
- `final_decision: BLOCK`
- `executed: false`
- `authentication.passed: false`
- `authentication.key_id: ATTACKER-ROGUE-GS`
- `authentication.error` contains "not in spacecraft authorized key registry"
- `policy.rule_triggered: HARD_CONSTRAINT_AUTHENTICATION_FAIL`

---

### 2.5 Credential Compromise

**Steps:**
1. Set mission phase to UMBRA_ECLIPSE
2. Create CAPTURE_IMAGE envelope with VALID GS-PRIMARY-01 HMAC (use real secret key)
3. Send to `POST /api/commands` with attackType: CREDENTIAL_COMPROMISE

**Expected Result:**
- `final_decision: SAFE_MODE`
- `executed: false`
- `authentication.passed: true` (valid creds)
- `integrity.passed: true` (valid HMAC)
- `mission_context.is_compliant: false`
- `mission_context.conflicting_rules` contains RULE-OPT-02
- `behavioral.is_anomalous: true`
- `behavioral.historical_pattern_detected: CREDENTIAL_COMPROMISE_ECLIPSE_IMAGING`
- `risk.total_score: >= 75`
- `risk.severity: CRITICAL`
- `policy.rule_triggered: AUTONOMOUS_SAFE_MODE_TRIGGER`
- `spacecraft_state.operating_mode: SAFE_MODE`
- `telemetry.safe_mode_active: true`

---

### 2.6 Safe Mode

**Steps:**
1. After credential compromise triggers SAFE_MODE, check spacecraft state
2. Send QUERY_TELEMETRY (should still work)
3. Send CAPTURE_IMAGE (should be blocked)

**Expected Result (QUERY_TELEMETRY):**
- `final_decision: ALLOW`
- `policy.rule_triggered: SAFE_MODE_TELEMETRY_EXCEPTION`
- `telemetry` returned
- `telemetry.safe_mode_active: true`

**Expected Result (CAPTURE_IMAGE):**
- `final_decision: BLOCK`
- `executed: false`
- `policy.rule_triggered: HARD_CONSTRAINT_SAFE_MODE_LOCKED`

---

### 2.7 Safe Mode Lock

**Steps:**
1. Ensure spacecraft is in SAFE_MODE
2. Send FIRE_THRUSTER with valid GS-PRIMARY-01 credentials (delta_v: 6.2)
3. Check response

**Expected Result:**
- `final_decision: BLOCK`
- `executed: false`
- `policy.rule_triggered: HARD_CONSTRAINT_SAFE_MODE_LOCKED`
- `spacecraft_state.operating_mode: SAFE_MODE` (unchanged)

---

### 2.8 Recovery

**Steps:**
1. Ensure spacecraft is in SAFE_MODE
2. Send POST to `/api/spacecraft/SAT-01/recovery` with:
   - Origin: http://localhost:3000 (trusted)
   - Body: { token: "GROUND-SECURE-RECOVERY-CHANNEL", clearance_level: "FLIGHT_DIRECTOR" }
3. Check response
4. Verify spacecraft state is NOMINAL

**Expected Result:**
- HTTP 200
- `final_decision: ALLOW`
- `policy.rule_triggered: OPERATOR_RECOVERY_ACCEPTED`
- `spacecraft_state.operating_mode: NOMINAL`
- `telemetry.safe_mode_active: false`
- Recovery parameters in envelope (token, clearance_level)

**Failure Case (battery < 40%):**
- `final_decision: BLOCK`
- `policy.rule_triggered: RECOVERY_INSUFFICIENT_POWER`

---

## 3. End-to-End Tests

### Current E2E Coverage

There are no automated end-to-end tests. The full E2E flow is verified manually using the demo mode on the Ground Console (port 3000).

### Manual E2E Flow (Verified)

The 7-stage demo flow on GroundConsole.tsx verifies the complete sequence:

1. **NORMAL** → valid QUERY_TELEMETRY → ALLOW (verified: final_decision === 'ALLOW')
2. **TAMPERING** → tampered envelope → BLOCK (verified: integrity.passed === false, rule === 'HARD_CONSTRAINT_INTEGRITY_FAIL')
3. **INJECTION** → rogue key envelope → BLOCK (verified: authentication.passed === false, rule === 'HARD_CONSTRAINT_AUTHENTICATION_FAIL')
4. **CREDENTIAL_COMPROMISE** → valid HMAC + eclipse imaging → SAFE_MODE (verified: auth.passed === true, integrity.passed === true, final_decision === 'SAFE_MODE', operating_mode === 'SAFE_MODE')
5. **DESTRUCTIVE_BURN** → valid HMAC + FIRE_THRUSTER during SAFE_MODE → BLOCK (verified: rule === 'HARD_CONSTRAINT_SAFE_MODE_LOCKED')
6. **OPERATOR_RECOVER** → trusted Ground recovery → NOMINAL (verified: final_decision === 'ALLOW', operating_mode === 'NOMINAL')
7. **Complete** — demo shows all stages passed

Each stage asserts the expected backend result BEFORE advancing. No stale React state.

---

## 4. Test Command Reference

```bash
# All tests
npm test

# Gateway unit tests only
npm run test:gateway

# Backend integration tests only
npm run test:backend

# Typecheck (frontend)
npm run typecheck

# Typecheck (backend)
npm run typecheck:backend

# Both typechecks
npm run typecheck && npm run typecheck:backend

# Full verification (tests + typecheck)
npm test && npm run typecheck && npm run typecheck:backend
```

---

## 5. What's Not Tested

- **Frontend component rendering** — No React component tests exist
- **Browser bundle credential check** — Verified manually (build should fail if credentials leak)
- **Attacker boundary enforcement** — Verified manually (curl from 3500 → 403 on privileged endpoints)
- **Demo flow UI** — Verified manually (click through demo mode)
- **Service startup/shutdown** — Verified manually (start.bat/stop.bat)
- **Port collision detection** — Verified manually

These are manual verification items, not gaps to fill unless time permits.
