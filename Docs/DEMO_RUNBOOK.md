# OrbitShield — Demo Runbook

**For:** Live judge demonstration (ST-02 competition)
**Duration:** ~3 minutes
**Prerequisites:** All 4 services running (3000, 3100, 3500, 4000)

---

## Before the Demo

1. Run `npm run dev:demo` (or start all 4 services via `start.bat`)
2. Verify all ports respond: 3000, 3100, 3500, 4000
3. Open Ground Console: `http://localhost:3000`
4. Verify spacecraft is NOMINAL, mission phase is UMBRA_ECLIPSE

---

## Step 1: Start OrbitShield

**ACTION:** Start all services

```bash
npm run dev:demo
```

**EXPECTED UI:** All 4 services start without errors. Ground console loads at localhost:3000.

**EXPECTED BACKEND RESULT:** Health endpoint returns `operating_mode: "NOMINAL"`, `database: "connected"`.

**EXPECTED SECURITY EVENT:** None (startup only).

**SAY:** "OrbitShield runs four local services: Ground station on 3000, SpaceTwin on 3100, Attacker simulator on 3500, and the security gateway backend on 4000 with SQLite persistence."

---

## Step 2: Open Ground Console

**ACTION:** Navigate to `http://localhost:3000`

**EXPECTED UI:** Ground Station Uplink Dispatcher visible. Vehicle State shows NOMINAL. Live Command Stream shows session.

**EXPECTED BACKEND RESULT:** `GET /api/spacecraft` returns NOMINAL state, `GET /api/sessions` returns active session.

**EXPECTED SECURITY EVENT:** None.

**SAY:** "This is the trusted operator console. It sends command intents to the backend — no credentials live in the browser."

---

## Step 3: Open SpaceTwin

**ACTION:** Open new tab to `http://localhost:3100`

**EXPECTED UI:** Spacecraft visualization with orbit position, telemetry, security posture.

**EXPECTED BACKEND RESULT:** `GET /api/spacecraft/SAT-01/twin` returns visualization payload.

**EXPECTED SECURITY EVENT:** None.

**SAY:** "SpaceTwin is the read-only visualization. It receives validated state from the backend — it never sends commands."

---

## Step 4: Open Attacker Simulator

**ACTION:** Open new tab to `http://localhost:3500`

**EXPECTED UI:** Attack Simulator with attack scenario buttons (TAMPERING, INJECTION, REPLAY, CREDENTIAL_COMPROMISE, DESTRUCTIVE_BURN, EAVESDROP). Shows "ATTACKER :3500 UNTRUSTED" badge.

**EXPECTED BACKEND RESULT:** Attacker can POST to `/api/commands` but all other endpoints return 403.

**EXPECTED SECURITY EVENT:** None yet (no attacks launched).

**SAY:** "This is the attacker simulator on port 3500. It's untrusted — the security middleware blocks it from every endpoint except command submission, where it can demonstrate attacks through the full pipeline."

---

## Step 5: Execute Valid Command

**ACTION:** On Ground Console (3000), click "Start Security Demo" → Stage 1: NORMAL → "Start Demo"

**EXPECTED UI:** Stage 1 — NORMAL: ACCEPTED. Shows decision: ALLOW, risk: ~2/100 (NORMAL), spacecraft: NOMINAL, auth: PASS, integrity: PASS.

**EXPECTED BACKEND RESULT:** `POST /api/commands/operator` returns `final_decision: ALLOW`, `executed: true`.

**EXPECTED SECURITY EVENT:** Audit event with `final_decision: ALLOW`, risk score ~2, severity NORMAL.

**SAY:** "Stage 1: A legitimate operator sends a telemetry query. The gateway authenticates the ground station, verifies the HMAC signature, checks replay protection — all pass. The command executes and the audit trail records it."

---

## Step 6: Demonstrate Tampering

**ACTION:** Demo advances to Stage 2. Click "Next Stage" → TAMPERING attack launches.

**EXPECTED UI:** Stage 2 — TAMPERING BLOCKED. Shows decision: BLOCK, rule: `HARD_CONSTRAINT_INTEGRITY_FAIL`, integrity: FAIL (expected).

**EXPECTED BACKEND RESULT:** `POST /api/commands` with tampered envelope returns `final_decision: BLOCK`, `integrity.passed: false`, `policy.rule_triggered: HARD_CONSTRAINT_INTEGRITY_FAIL`.

**EXPECTED SECURITY EVENT:** Audit event with integrity failure. `computed_signature` differs from `received_signature`.

**SAY:** "Stage 2: The attacker intercepts a valid command and changes the payload from QUERY_TELEMETRY to FIRE_THRUSTER with an 8.5 m/s burn. But they didn't re-sign it. The HMAC integrity check fails — the computed signature doesn't match what was received. The command is blocked."

---

## Step 7: Demonstrate Unauthorized Injection

**ACTION:** Click "Next Stage" → INJECTION attack launches.

**EXPECTED UI:** Stage 3 — INJECTION BLOCKED. Shows decision: BLOCK, rule: `HARD_CONSTRAINT_AUTHENTICATION_FAIL`, auth: FAIL (expected).

**EXPECTED BACKEND RESULT:** `POST /api/commands` with rogue key envelope returns `final_decision: BLOCK`, `authentication.passed: false`, `authentication.key_id: ATTACKER-ROGUE-GS`, `policy.rule_triggered: HARD_CONSTRAINT_AUTHENTICATION_FAIL`.

**EXPECTED SECURITY EVENT:** Audit event with auth failure. `key_id: ATTACKER-ROGUE-GS`, error: "Unauthorized key_id is not in spacecraft authorized key registry".

**SAY:** "Stage 3: The attacker tries to inject a command with a completely rogue key — ATTACKER-ROGUE-GS. The authentication module checks the key registry and doesn't find it. The command is blocked before any further processing."

---

## Step 8: Demonstrate Credential Compromise

**ACTION:** Click "Next Stage" → CREDENTIAL_COMPROMISE attack launches. (Demo sets mission phase to UMBRA_ECLIPSE first.)

**EXPECTED UI:** Stage 4 — CREDENTIAL COMPROMISE → SAFE_MODE. Shows:

- decision: SAFE_MODE
- auth: PASS (expected — stolen creds)
- integrity: PASS (expected — valid HMAC)
- risk: 76/100 (CRITICAL)
- rule: `AUTONOMOUS_SAFE_MODE_TRIGGER`
- spacecraft mode: SAFE_MODE

**EXPECTED BACKEND RESULT:** `POST /api/commands` with valid GS-PRIMARY-01 HMAC + CAPTURE_IMAGE in eclipse returns `final_decision: SAFE_MODE`, `authentication.passed: true`, `integrity.passed: true`, `risk.total_score: 76`, `risk.severity: CRITICAL`, `spacecraft_state.operating_mode: SAFE_MODE`.

**EXPECTED SECURITY EVENT:** Audit event with:

- `final_decision: SAFE_MODE`
- `policy.rule_triggered: AUTONOMOUS_SAFE_MODE_TRIGGER`
- `policy.safe_mode_activated: true`
- `policy.safe_mode_reason: "CRITICAL risk score (76/100) triggered by ..."`

**SAY:** "Stage 4: This is the critical scenario. The attacker has stolen legitimate ground station credentials. The HMAC signature is valid — authentication passes. Integrity passes. But the attacker tries to capture an image during orbital eclipse, when the solar arrays produce zero watts and the 180-watt camera would drain the battery. The mission context module flags RULE-OPT-02. The behavioral module detects the credential compromise pattern. The risk engine scores this 76 out of 100 — CRITICAL. The deterministic safety policy autonomously triggers SAFE_MODE. The spacecraft protects itself."

---

## Step 9: Show SAFE_MODE

**ACTION:** Observe Stage 4 results. Vehicle State panel on Ground Console should show SAFE_MODE.

**EXPECTED UI:** Vehicle State shows `operating_mode: SAFE_MODE`, `communication_status: SAFE_CARRIER_ONLY`, `camera.status: DISABLED`.

**EXPECTED BACKEND RESULT:** `GET /api/spacecraft` returns `operating_mode: SAFE_MODE`.

**EXPECTED SECURITY EVENT:** SAFE_MODE_ENTERED audit event (from the credential compromise command processing).

**SAY:** "The spacecraft is now in SAFE_MODE. Notice what's still working: essential telemetry continues. The communication carrier is still active. But dangerous operations are locked — the camera is disabled, propulsion is locked. This is protective, not destructive."

---

## Step 10: Attempt Destructive Command

**ACTION:** Click "Next Stage" → DESTRUCTIVE_BURN attack launches. (Demo verifies SAFE_MODE is active before sending.)

**EXPECTED UI:** Stage 5 — DESTRUCTIVE BURN BLOCKED BY SAFE_MODE_LOCK. Shows decision: BLOCK, rule: `HARD_CONSTRAINT_SAFE_MODE_LOCKED`.

**EXPECTED BACKEND RESULT:** `POST /api/commands` with valid GS-PRIMARY-01 HMAC + FIRE_THRUSTER (6.2 m/s) returns `final_decision: BLOCK`, `policy.rule_triggered: HARD_CONSTRAINT_SAFE_MODE_LOCKED`, `spacecraft_state.operating_mode: SAFE_MODE`.

**EXPECTED SECURITY EVENT:** Audit event with `final_decision: BLOCK`, `policy.rule_triggered: HARD_CONSTRAINT_SAFE_MODE_LOCKED`.

**SAY:** "Stage 5: Even with valid stolen credentials, the attacker can't execute a destructive 6.2 m/s thruster burn. The spacecraft is in SAFE_MODE — the flight software lock blocks all dangerous commands. Only telemetry queries or authenticated recovery are accepted. The attacker is contained."

---

## Step 11: Show SAFE_MODE_LOCK

**ACTION:** Observe Stage 5 results. Emphasize the rule_triggered field.

**EXPECTED UI:** Stage 5 details show `HARD_CONSTRAINT_SAFE_MODE_LOCKED` rule, BLOCK decision, SAFE_MODE still active.

**EXPECTED BACKEND RESULT:** Same as Step 10 — blocked by hard constraint, not by auth or integrity (those passed).

**EXPECTED SECURITY EVENT:** Block audit event with `HARD_CONSTRAINT_SAFE_MODE_LOCKED`.

**SAY:** "Notice the difference from Stage 2 and 3. The signature is valid, the key is authorized — but the command is still blocked. Not by cryptography, but by the flight software lock. The spacecraft has isolated itself from dangerous operations."

---

## Step 12: Execute Authorized Recovery

**ACTION:** Click "Next Stage" → OPERATOR_RECOVER executes from Ground console (port 3000, trusted).

**EXPECTED UI:** Stage 6 — SYSTEM RESTORED — NOMINAL. Shows decision: ALLOW, rule: `OPERATOR_RECOVERY_ACCEPTED`, spacecraft mode: NOMINAL.

**EXPECTED BACKEND RESULT:** `POST /api/spacecraft/SAT-01/recovery` with Origin: localhost:3000, token: GROUND-SECURE-RECOVERY-CHANNEL, clearance_level: FLIGHT_DIRECTOR returns `final_decision: ALLOW`, `spacecraft_state.operating_mode: NOMINAL`.

**EXPECTED SECURITY EVENT:** Audit event with `final_decision: ALLOW`, `policy.rule_triggered: OPERATOR_RECOVERY_ACCEPTED`. Recovery parameters in envelope.

**SAY:** "Stage 6: The operator initiates recovery from the trusted Ground console. This is not a frontend button changing a variable — it's a real command processed through the full security pipeline. The recovery requires FLIGHT_DIRECTOR clearance and a recovery token. The system verifies health — battery is above 40%. SAFE_MODE is cleared. The spacecraft returns to NOMINAL operations."

---

## Step 13: Show NOMINAL

**ACTION:** Observe Stage 6 results. Vehicle State panel should show NOMINAL.

**EXPECTED UI:** Vehicle State shows `operating_mode: NOMINAL`, `communication_status: ONLINE`, `camera.status: IDLE`.

**EXPECTED BACKEND RESULT:** `GET /api/spacecraft` returns `operating_mode: NOMINAL`.

**EXPECTED SECURITY EVENT:** Final recovery audit event confirms NOMINAL restoration.

**SAY:** "The system is back to NOMINAL. Throughout this demonstration, every decision was persisted to SQLite — refresh the browser or restart the backend and the full audit trail, vehicle state, and replay history remain. The attacker can launch attacks independently from port 3500, the gateway processes every command through all 10 security layers, and the deterministic safety policy is always the final authority."

---

## Quick Reference: Expected Decisions

| Stage | Action | Expected Decision | Key Rule |
| ------- | -------- | ------------------- | ---------- |
| 1 | Valid QUERY_TELEMETRY | ALLOW | — |
| 2 | Tampered FIRE_THRUSTER | BLOCK | `HARD_CONSTRAINT_INTEGRITY_FAIL` |
| 3 | Rogue key SYSTEM_REBOOT | BLOCK | `HARD_CONSTRAINT_AUTHENTICATION_FAIL` |
| 4 | Stolen creds + eclipse imaging | SAFE_MODE | `AUTONOMOUS_SAFE_MODE_TRIGGER` |
| 5 | Destructive burn during SAFE_MODE | BLOCK | `HARD_CONSTRAINT_SAFE_MODE_LOCKED` |
| 6 | Authorized recovery | ALLOW | `OPERATOR_RECOVERY_ACCEPTED` |

---

## Troubleshooting

| Problem | Check |
| --------- | ------- |
| Demo doesn't start | Verify backend is running on port 4000. Check browser console for fetch errors. |
| Stage 4 doesn't trigger SAFE_MODE | Verify mission phase is UMBRA_ECLIPSE. Check that attackerClient uses valid GS-PRIMARY-01 secret key. |
| Stage 5 doesn't show SAFE_MODE_LOCK | Verify SAFE_MODE is active before Stage 5 runs. Check spacecraft_state.operating_mode. |
| Stage 6 recovery fails | Verify Origin header is localhost:3000 (trusted). Check recovery token and clearance_level. |
| Attacker can't launch attacks | Verify `/api/commands` proxy is configured in vite.attacker.config.ts. Check security middleware exception. |
| Ports conflict | Run `stop.bat` or kill node processes. Check no other services on 3000, 3100, 3500, 4000. |

---

## What NOT to Say

- Don't claim asymmetric digital signatures — it's HMAC-SHA256 (symmetric MAC).
- Don't claim the attacker is on a different machine — all services are localhost.
- Don't claim AI makes the final decision — deterministic safety policy is final authority.
- Don't claim real satellite integration — this is a local simulation.
