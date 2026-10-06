# ADR-002: Security Gateway Pipeline

**Status:** Accepted
**Date:** 2026-10-06
**Owner:** Developer 1 (Security/Backend)

---

## Context

The ST-02 brief requires a security gateway that validates commands, detects suspicious behavior, blocks replay/tampering, and places the spacecraft into safe mode for high-confidence threats.

We needed to decide: what layers does the gateway have, in what order, and who has final authority?

---

## Decision

The gateway is a **10-layer sequential pipeline** implemented in `SecurityGateway.processCommand()` in `src/gateway/gateway.ts`:

```text
1. Schema/Structural Validation  (gateway.ts — inline)
2. Authentication                (AuthenticationModule — src/gateway/authentication.ts)
3. Integrity                     (IntegrityModule — src/gateway/integrity.ts)
4. Replay Protection             (ReplayProtectionModule — src/gateway/replay.ts)
5. Authorization                 (role-based — src/gateway/authentication.ts + policy.ts)
6. Mission Context               (MissionContextModule — src/gateway/context.ts)
7. Behavioral Analysis           (BehavioralAnalysisModule — src/gateway/behavioral.ts)
8. Risk Engine                   (RiskEngine — src/gateway/risk.ts)
9. Deterministic Safety Policy   (SafetyPolicyEngine — src/gateway/policy.ts)
10. Response Dispatch + Audit    (gateway.ts — execute/block + audit event creation)
```

### Key Principles

1. **Each layer produces a structured result** that feeds the next layer
2. **Hard constraints stop the pipeline early** (malformed, auth failure, integrity failure, replay detected)
3. **Deterministic safety policy is the final authority** — not behavioral analysis, not risk engine
4. **SAFE_MODE is triggered by policy, not by risk engine** — risk engine scores, policy decides
5. **Every decision produces a complete audit event** persisted to SQLite

### Hard Constraints (stop pipeline, immediate BLOCK)

| Priority | Rule | Condition | File |
|----------|------|-----------|------|
| 1 | `SCHEMA_PARSE_FAILURE` | Missing header/payload/security | `gateway.ts` |
| 2 | `HARD_CONSTRAINT_AUTHENTICATION_FAIL` | !auth.passed | `policy.ts` Rule 1 |
| 3 | `HARD_CONSTRAINT_INTEGRITY_FAIL` | !integrity.passed | `policy.ts` Rule 2 |
| 4 | `HARD_CONSTRAINT_REPLAY_DETECTED` | !replay.passed | `policy.ts` Rule 3 |
| 5a | `SAFE_MODE_TELEMETRY_EXCEPTION` | SAFE_MODE + QUERY_TELEMETRY | `policy.ts` Rule 4a |
| 5b | `OPERATOR_RECOVERY_ACCEPTED` | SAFE_MODE + OPERATOR_RECOVER + battery >= 40% | `policy.ts` Rule 4b |
| 5c | `RECOVERY_INSUFFICIENT_POWER` | SAFE_MODE + OPERATOR_RECOVER + battery < 40% | `policy.ts` Rule 4c |
| 5d | `HARD_CONSTRAINT_SAFE_MODE_LOCKED` | SAFE_MODE + non-allowed command | `policy.ts` Rule 4d |

### SAFE_MODE Trigger

- Risk score >= 75 OR severity === 'CRITICAL' → `AUTONOMOUS_SAFE_MODE_TRIGGER` (policy.ts Rule 5)
- NOT triggered by risk engine directly — risk engine only scores

---

## Consequences

### Positive
- Clear separation of concerns — each module has one job
- Deterministic policy is always final — no AI/behavioral override
- Complete audit trail for every decision
- Modular — each layer can be tested independently
- Easy to explain to judges — "10 layers, policy is final"

### Negative
- Sequential processing means later layers don't run if earlier layers fail
- Behavioral analysis and mission context only run for cryptographically valid commands
- Risk scoring formula is weighted — changing weights affects all scenarios
- No short-circuit for high-risk commands before expensive analysis (intentional — all layers must run)

### Neutral
- Pipeline modules live in `src/gateway/` (frontend tree) but run in backend via `CommandService`
- Gateway rehydrates from SQLite at startup (replay state, nonce cache, behavioral history)
- Anti-replay state only advances for cryptographically verified commands

---

## Compliance

- PRD Section 4: Core features — structured command protocol, integrity, authentication, replay, behavioral AI, mission context, risk engine, safety policy, response engine, audit
- TRD Section 4: Pipeline order — Receive → Parse → Integrity → Authentication → Replay → Behavioral → Mission Context → Risk → Safety Policy → Response → Audit
- TRD Section 8: Response policy — NORMAL (allow), SUSPICIOUS (monitor), HIGH (block + alert), CRITICAL (safe mode)
- TRD Section 13: Reliability — invalid commands don't crash, AI failure falls back to policy, logging failure doesn't change decisions
- TRD Section 14: Testing — 10 minimum tests, all implemented in `src/tests/gateway.test.ts`
