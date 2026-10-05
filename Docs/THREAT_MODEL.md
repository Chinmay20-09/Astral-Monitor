# ST-02 — Threat Model

## 1. Attacker Model

The simulator assumes an attacker may:

1. intercept traffic,
2. modify existing commands,
3. inject new commands,
4. obtain/compromise legitimate credentials,
5. replay captured commands,
6. passively observe traffic.

Priority:

1. interception
2. modification/injection
3. credential compromise
4. replay
5. passive observation

## 2. Threats and Defenses

| Threat | Defense | Expected result |
| --- | --- | --- |
| Command modification | HMAC-based integrity/authentication tag (HMAC-SHA256) | Block |
| Unauthorized injection | Authentication + HMAC tag verification against backend registry | Block |
| Credential compromise | Behavioral + contextual analysis | Escalate/block/safe mode |
| Replay | nonce + timestamp + per-sender sequence (persisted) | Block |
| Passive observation | AES-GCM-256 encryption (ciphertext authoritative on the wire) | Protect command contents |
| Malformed command | Schema validation | Reject |
| AI hallucination/error | Deterministic safety policy | AI cannot directly execute |
| Mission-conflicting action | Mission context + policy | Block/escalate |
| Dangerous action during emergency | Safety constraints | Block |

## 3. Primary Attack Scenario

Stage 1:
Attacker intercepts and modifies a legitimate command.

Result:
Integrity check fails.

Stage 2:
Attacker obtains legitimate credentials.

Result:
Cryptographic checks may pass.

Stage 3:
Attacker issues unusual commands.

Result:
Behavioral analysis detects anomaly.

Stage 4:
Mission context confirms inconsistency.

Result:
Risk score escalates.

Stage 5:
Risk becomes critical.

Result:
Safe mode and operator alert.

## 4. Safe Mode

Safe mode is protective, not destructive.

Priority:

1. restrict dangerous operations,
2. allow conditional automatic recovery,
3. require/recommend operator re-authentication,
4. communication lockdown only when necessary.

Essential telemetry should remain available whenever safely possible.

## 5. Safety Rules

- Never execute a command solely because an AI model recommends it.
- Never bypass cryptographic validation for convenience.
- Never use real credentials in the repository.
- Never test attacks against real spacecraft or external systems.
- Attack simulation is local and controlled.
- Replay and behavioral defenses must survive gateway restarts: anti-replay state is
  rehydrated from the persistent audit database at startup (implemented in `backend/`).
- Anti-replay state must only advance for cryptographically verified commands, so
  unauthenticated traffic cannot poison the per-sender sequence stream.
- Simulated ground-station credentials must never leave the backend process; the
  browser bundle must not contain authoritative secrets (build-checked).
