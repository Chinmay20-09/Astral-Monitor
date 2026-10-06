# OrbitShield — API Contracts

**Status:** Current as of 2026-10-06
**Scope:** Backend HTTP API (`backend/src/routes/`)
**Rule:** Documents actual endpoints only. No speculative routes.

---

## Base URL

`http://127.0.0.1:4000/api`

All requests use `Content-Type: application/json`.

---

## Trust Zone Legend

| Zone | Origins | Access |
| ------ | --------- | -------- |
| TRUSTED | `localhost:3000` (Ground), `localhost:3100` (SpaceTwin) | All endpoints |
| UNTRUSTED | `localhost:3500` (Attacker) | `/api/commands` ONLY |
| INTERNAL | `localhost:4000` | All endpoints |
| UNKNOWN | No origin, other hosts | Logged, allowed for backward compatibility |

---

## 1. Health Check

```
GET /api/health
```

**Trust:** ALL zones
**Authorization:** None
**Owner:** Developer 1 (Security/Backend) + Developer 4 (Docs/QA)

### Purpose

Liveness check + persistence statistics. Probes database connectivity.

### Response 200

```json
{
  "status": "ok",
  "service": "orbitshield-backend",
  "database": "connected",
  "version": "1.1.0",
  "spacecraft_id": "SAT-01",
  "operating_mode": "NOMINAL",
  "mission_phase": "UMBRA_ECLIPSE",
  "uptime_seconds": 1234,
  "timestamp": "2026-10-06T03:05:30.354Z",
  "persistence": {
    "commands_persisted": 8,
    "security_events_persisted": 2307,
    "ground_stations_registered": 3,
    "decisions": {
      "ALLOW": 4,
      "BLOCK": 2303
    }
  }
}
```

### Response 503

```json
{
  "status": "error",
  "service": "orbitshield-backend",
  "database": "disconnected",
  "version": "1.1.0",
  "timestamp": "..."
}
```

### Errors

- 503 — Database disconnected

### Security Events

None (health check does not process commands)

---

## 2. Submit Command Envelope

```
POST /api/commands
```

**Trust:** TRUSTED + controlled UNTRUSTED (attacker demo exception)
**Authorization:** None (pipeline handles auth via envelope content)
**Owner:** Developer 1 (Security/Backend) + Developer 3 (Attacker/Demo)

### Purpose

Run a raw (possibly hostile) command envelope through the full security pipeline. Used by both operator consoles (trusted) and attacker simulator (untrusted demo exception).

### Request

```json
{
  "envelope": {
    "header": {
      "spacecraft_id": "SAT-01",
      "command_id": "CMD-1042",
      "timestamp": "2026-10-03T16:30:21Z",
      "sequence_number": 1042,
      "nonce": "a1b2c3d4e5f6..."
    },
    "payload": {
      "command_type": "QUERY_TELEMETRY",
      "parameters": { "subsystems": ["power", "thermal"] }
    },
    "security": {
      "key_id": "GS-PRIMARY-01",
      "algorithm": "HMAC-SHA256",
      "signature": "hex-encoded-hmac",
      "ciphertext": "hex-encoded-aes-gcm",     // optional
      "iv": "hex-encoded-iv"                   // optional
    }
  },
  "attackType": "TAMPERING"    // optional — for audit trail tagging
}
```

### Response 201

```json
{
  "audit_event": {
    "event_id": "EVT-1728190230-042",
    "timestamp": "2026-10-06T03:05:30.354Z",
    "command_id": "CMD-1042",
    "spacecraft_id": "SAT-01",
    "sender_identity": "Svalbard Satellite Station (SvalSat)",
    "envelope": { ... },
    "integrity": { "passed": true, "computed_signature": "...", "received_signature": "...", "algorithm": "HMAC-SHA256" },
    "authentication": { "passed": true, "key_id": "GS-PRIMARY-01", "authorized_identity": "Svalbard Satellite Station (SvalSat)", "role": "FLIGHT_DIRECTOR" },
    "replay": { "passed": true, "nonce_is_fresh": true, "sequence_valid": true, "timestamp_valid": true, "clock_skew_seconds": 0.1, "expected_sequence": 1043, "received_sequence": 1042 },
    "behavioral": { "is_anomalous": false, "anomaly_score": 5, "confidence": 0.92, "findings": [...], "explanation": "...", "suggested_risk_delta": 0 },
    "mission_context": { "is_compliant": true, "conflicting_rules": [], "current_phase": "UMBRA_ECLIPSE", "environmental_factors": [...], "findings": [...], "risk_contribution": 0 },
    "risk": { "total_score": 2, "severity": "NORMAL", "breakdown": {...}, "summary": "..." },
    "policy": { "decision": "ALLOW", "enforced_by_deterministic_rule": false, "safe_mode_activated": false, "operator_alert_dispatched": false, "explanation": "..." },
    "final_decision": "ALLOW",
    "simulated_attack_type": "TAMPERING"
  },
  "executed": true,
  "execution_message": "Telemetry query acknowledged. Full diagnostic packet generated.",
  "spacecraft_state": { ... },
  "telemetry": { ... }
}
```

### Response 400

```json
{ "error": "Request body must contain a command envelope object: { envelope, attackType? }" }
```

### Response 503

```json
{ "error": "Security decision could not be persisted: the audit transaction was rolled back. ..." }
```

### Decisions

- `ALLOW` — command executed
- `MONITOR` — command allowed with warning
- `BLOCK` — command rejected (with specific rule_triggered)
- `SAFE_MODE` — spacecraft entered safe mode

### Common BLOCK Rules

- `HARD_CONSTRAINT_AUTHENTICATION_FAIL` — unknown/revoked key
- `HARD_CONSTRAINT_INTEGRITY_FAIL` — HMAC mismatch
- `HARD_CONSTRAINT_REPLAY_DETECTED` — replayed nonce/sequence
- `HARD_CONSTRAINT_SAFE_MODE_LOCKED` — dangerous command during safe mode
- `HIGH_RISK_COMMAND_BLOCK` — risk >= 50
- `AUTONOMOUS_SAFE_MODE_TRIGGER` — risk >= 75, spacecraft enters safe mode

### Security Events

Every command produces one `AuditEvent` persisted to SQLite. The event_id is consistent across SQLite, HTTP response, and frontend display.

### Errors

- 400 — Malformed request body
- 503 — Database transaction failed (decision NOT persisted)

---

## 3. Operator Command Intent

```
POST /api/commands/operator
```

**Trust:** TRUSTED
**Authorization:** Ground station key_id must be in registry (validated server-side)
**Owner:** Developer 1 (Security/Backend) + Developer 2 (Frontend)

### Purpose

Operator console sends a command INTENT. Backend resolves credential, signs (+ optionally encrypts) server-side, then runs full pipeline. No secret material reaches the browser.

### Request

```json
{
  "key_id": "GS-PRIMARY-01",          // optional, defaults to GS-PRIMARY-01
  "command_type": "QUERY_TELEMETRY",
  "parameters": { "subsystems": ["power", "thermal"] },
  "encrypt": false                     // optional, defaults to false
}
```

### Response 201

Same structure as `POST /api/commands` (see above).

### Errors

- 400 — Unknown key_id, missing command_type, invalid parameters
- 503 — Database transaction failed

### Security Events

Same as `POST /api/commands` — full audit event per decision.

---

## 4. List Commands

```
GET /api/commands?limit=N&spacecraft_id=ID&key_id=ID
```

**Trust:** ALL zones
**Authorization:** None
**Owner:** Developer 1 (Security/Backend)

### Purpose

Recently processed commands (persisted trail, bounded limit).

### Query Parameters

| Parameter | Type | Default |
| ----------- | ------ | --------- |
| limit | number | 100 (max 1000) |
| spacecraft_id | string | undefined |
| key_id | string | undefined |

### Response 200

```json
{
  "total": 42,
  "commands": [
    {
      "command_id": "CMD-1042",
      "spacecraft_id": "SAT-01",
      "command_type": "QUERY_TELEMETRY",
      "key_id": "GS-PRIMARY-01",
      "timestamp": "2026-10-03T16:30:21Z",
      "sequence_number": 1042,
      "final_decision": "ALLOW"
    }
  ]
}
```

### Errors

None (bounded query, always succeeds)

---

## 5. Next Sequence

```
GET /api/commands/next-sequence?spacecraft_id=ID&key_id=ID
```

**Trust:** ALL zones
**Authorization:** None
**Owner:** Developer 1 (Security/Backend) + Developer 3 (Attacker/Demo)

### Purpose

Monotonic sequence sync for external ground-station tooling. Returns next acceptable sequence number.

### Query Parameters

| Parameter | Type | Default |
|-----------|------|---------|
| spacecraft_id | string | SAT-01 |
| key_id | string | undefined (global max) |

### Response 200

```json
{
  "spacecraft_id": "SAT-01",
  "next_sequence": 1043
}
```

When `key_id` provided: next sequence for that sender scope.
When `key_id` omitted: global maximum across all scopes + 1.

### Errors

None

---

## 6. Attack Simulation

```
POST /api/attacks
```

**Trust:** TRUSTED (operator console initiates, backend generates hostile envelope)
**Authorization:** Scenario name must be valid
**Owner:** Developer 3 (Attacker/Demo) + Developer 1 (Security/Backend)

### Purpose

Controlled local attack simulation. Backend manufactures hostile envelope server-side and runs through full pipeline. Browser never sees credential material.

### Request

```json
{
  "scenario": "TAMPERING"
}
```

### Valid Scenarios

- `TAMPERING`
- `INJECTION`
- `REPLAY`
- `CREDENTIAL_COMPROMISE`
- `DESTRUCTIVE_BURN`
- `EAVESDROP`

### Response 201

```json
{
  "scenario": "TAMPERING",
  "description": "Intercepted legitimate command...",
  "result": {
    "audit_event": { ... },
    "executed": false,
    "execution_message": "...",
    "spacecraft_state": { ... },
    "telemetry": { ... }
  }
}
```

### Response 400

```json
{ "error": "Unknown attack scenario. Valid scenarios: TAMPERING, INJECTION, REPLAY, CREDENTIAL_COMPROMISE, DESTRUCTIVE_BURN, EAVESDROP" }
```

### Errors

- 400 — Unknown scenario

### Security Events

Same as command processing — full audit event per attack simulation.

---

## 7. List Security Events

```
GET /api/security-events?limit=N&decision=DECISION&spacecraft_id=ID&key_id=ID
```

**Trust:** TRUSTED
**Authorization:** None (filtered query)
**Owner:** Developer 1 (Security/Backend) + Developer 4 (Docs/QA)

### Purpose

Filterable explainable audit trail. Used by security dashboard and timeline.

### Query Parameters

| Parameter | Type | Default |
| ----------- | ------ | --------- |
| limit | number | 200 (max 200) |
| decision | string | undefined |
| spacecraft_id | string | undefined |
| key_id | string | undefined |

### Response 200

```json
{
  "total": 2307,
  "decisions": { "ALLOW": 4, "BLOCK": 2303 },
  "events": [
    {
      "event_id": "EVT-1728190230-042",
      "timestamp": "2026-10-06T03:05:30.354Z",
      "command_id": "CMD-1042",
      "spacecraft_id": "SAT-01",
      "sender_identity": "Svalbard Satellite Station (SvalSat)",
      "final_decision": "ALLOW",
      "risk": { "total_score": 2, "severity": "NORMAL" },
      "policy": { "decision": "ALLOW", "rule_triggered": undefined, "explanation": "..." }
    }
  ]
}
```

### Errors

None (bounded query)

---

## 8. Get Security Event

```
GET /api/security-events/:eventId
```

**Trust:** TRUSTED
**Authorization:** None
**Owner:** Developer 1 (Security/Backend) + Developer 4 (Docs/QA)

### Purpose

Get one complete security event with all evidence fields.

### Response 200

```json
{
  "event": {
    "event_id": "EVT-1728190230-042",
    "timestamp": "...",
    "command_id": "CMD-1042",
    "spacecraft_id": "SAT-01",
    "sender_identity": "Svalbard Satellite Station (SvalSat)",
    "envelope": { ... },
    "integrity": { ... },
    "authentication": { ... },
    "replay": { ... },
    "behavioral": { ... },
    "mission_context": { ... },
    "risk": { ... },
    "policy": { ... },
    "final_decision": "ALLOW",
    "simulated_attack_type": undefined
  }
}
```

### Response 404

```json
{ "error": "Security event not found" }
```

### Errors

- 404 — Event not found

---

## 9. Spacecraft State

```
GET /api/spacecraft
GET /api/spacecraft/:spacecraftId
```

**Trust:** TRUSTED
**Authorization:** None
**Owner:** Developer 1 (Security/Backend) + Developer 2 (Frontend)

### Purpose

Current vehicle state + essential telemetry + mission state.

### Response 200

```json
{
  "active_session": "SESSION-001",
  "active_spacecraft_id": "SAT-01",
  "entities": [...],
  "state": {
    "spacecraft_id": "SAT-01",
    "operating_mode": "NOMINAL",
    "communication_status": "ONLINE",
    "power": { "battery_percent": 88.5, ... },
    "thermal": { ... },
    "navigation": { ... },
    "camera": { ... },
    "flight_computer": { ... }
  },
  "telemetry": {
    "timestamp": "...",
    "spacecraft_id": "SAT-01",
    "operating_mode": "NOMINAL",
    "comm_status": "ONLINE",
    "battery_percent": 88.5,
    "bus_temp_celsius": 18.2,
    "safe_mode_active": false,
    "safe_mode_reason": undefined,
    "heartbeat_counter": 1234
  },
  "mission": {
    "mission_id": "ORBITSHIELD-LEO-01",
    "current_phase": { "name": "UMBRA_ECLIPSE", ... },
    "all_phases": [...],
    "active_constraints": [...],
    "mission_documents": [...]
  }
}
```

### Errors

None

---

## 10. Spacecraft Twin Visualization

```
GET /api/spacecraft/:spacecraftId/twin
```

**Trust:** TRUSTED
**Authorization:** None
**Owner:** Developer 2 (Frontend) + Developer 4 (Docs/QA)

### Purpose

Read-only visualization payload for SpaceTwin display. Includes deterministic orbit position.

### Response 200

```json
{
  "spacecraft_id": "SAT-01",
  "position": { "x_px": 120, "y_px": -45, "orbit_progress": 0.35 },
  "orbit": { "altitude_km": 540, "inclination_deg": 97.4, "period_minutes": 94.6, "orbit_type": "SUN_SYNCHRONOUS" },
  "altitude_km": 540,
  "solar_condition": "UMBRA_ECLIPSE",
  "operating_mode": "NOMINAL",
  "battery_percent": 88.5,
  "temperature": 18.2,
  "communication_status": "ONLINE",
  "security_posture": "NORMAL",
  "orbit_progress": 0.35
}
```

### Errors

- 404 — Unknown spacecraft

---

## 11. Spacecraft Recovery

```
POST /api/spacecraft/:spacecraftId/recovery
```

**Trust:** TRUSTED (requires Origin: localhost:3000)
**Authorization:** FLIGHT_DIRECTOR clearance + recovery token
**Owner:** Developer 1 (Security/Backend) + Developer 3 (Attacker/Demo — trusted recovery execution)

### Purpose

Operator-initiated recovery from SAFE_MODE. Processes through full pipeline as OPERATOR_RECOVER command.

### Request

```json
{
  "token": "GROUND-SECURE-RECOVERY-CHANNEL",
  "clearance_level": "FLIGHT_DIRECTOR"
}
```

### Response 200

Same structure as `POST /api/commands/operator` (full pipeline result).

### Recovery Decision Logic

| Condition | Decision | Rule |
| ----------- | ---------- | ------ |
| In SAFE_MODE + battery >= 40% | ALLOW (exits safe mode) | `OPERATOR_RECOVERY_ACCEPTED` |
| In SAFE_MODE + battery < 40% | BLOCK | `RECOVERY_INSUFFICIENT_POWER` |
| Not in SAFE_MODE | ALLOW (normal processing) | — |

### Security Events

Recovery command produces full audit event with:

- `final_decision: ALLOW`
- `rule_triggered: OPERATOR_RECOVERY_ACCEPTED`
- Recovery parameters in envelope

### Errors

- 404 — Unknown spacecraft
- 503 — Database transaction failed

---

## 12. Spacecraft Tick

```
POST /api/spacecraft/tick
```

**Trust:** TRUSTED
**Authorization:** None
**Owner:** Developer 2 (Frontend)

### Purpose

Advance physics simulation (eclipse-aware battery drain/charge).

### Request

```json
{ "delta_seconds": 2.0 }
```

### Response 200

```json
{
  "state": { ... },
  "telemetry": { ... }
}
```

### Errors

None

---

## 13. Spacecraft Reset

```
POST /api/spacecraft/reset
```

**Trust:** TRUSTED
**Authorization:** None (operator action)
**Owner:** Developer 1 (Security/Backend) + Developer 3 (Attacker/Demo)

### Purpose

Operator full session reset: wipe command/audit trail, replay state, reset vehicle and mission, rebuild gateway with empty state.

### Response 200

```json
{
  "message": "Session reset: vehicle, mission plan and persisted audit trail cleared.",
  "spacecraft": { "state": { ... }, "telemetry": { ... } },
  "mission": { ... },
  "next_sequence": 1001
}
```

### Errors

None

---

## 14. Mission State

```
GET /api/mission/:spacecraftId
```

**Trust:** TRUSTED
**Authorization:** None
**Owner:** Developer 1 (Security/Backend) + Developer 2 (Frontend)

### Purpose

Structured mission state: phases, constraints, documents.

### Response 200

```json
{
  "mission": {
    "mission_id": "ORBITSHIELD-LEO-01",
    "spacecraft_id": "SAT-01",
    "orbit_altitude_km": 540,
    "current_phase": { "name": "UMBRA_ECLIPSE", ... },
    "all_phases": [ ... ],
    "active_constraints": [ ... ],
    "mission_documents": [ ... ]
  }
}
```

### Errors

None

---

## 15. Set Mission Phase

```
POST /api/mission/phase
```

**Trust:** TRUSTED
**Authorization:** None
**Owner:** Developer 1 (Security/Backend) + Developer 3 (Attacker/Demo)

### Purpose

Switch active orbital phase (persisted to database).

### Request

```json
{ "phase": "UMBRA_ECLIPSE" }
```

or

```json
{ "phase": "FULL_SUN_IMAGING" }
```

### Response 200

```json
{ "mission": { ... } }
```

### Errors

- 400 — Invalid phase name

---

## 16. Ground Stations

```
GET /api/ground-stations
```

**Trust:** ALL zones
**Authorization:** None
**Owner:** Developer 1 (Security/Backend)

### Purpose

Sanitized registry snapshot — metadata only, NO keys.

### Response 200

```json
{
  "total": 3,
  "stations": [
    {
      "key_id": "GS-PRIMARY-01",
      "station_name": "Svalbard Satellite Station (SvalSat)",
      "allowed_command_types": ["ALL"],
      "role": "FLIGHT_DIRECTOR",
      "status": "ACTIVE"
    }
  ]
}
```

### Errors

None

---

## 17. Sessions

```
GET /api/sessions
POST /api/sessions/:id/activate
```

**Trust:** TRUSTED
**Authorization:** None
**Owner:** Developer 1 (Security/Backend) + Developer 2 (Frontend)

### Purpose

Session management for multi-operator scenarios.

### GET /api/sessions Response 200

```json
{
  "total": 2,
  "active": "SESSION-001",
  "sessions": [
    { "session_id": "SESSION-001", "active": true, "spacecraft_id": "SAT-01", ... },
    { "session_id": "SESSION-002", "active": false, "spacecraft_id": "TEST-01", ... }
  ]
}
```

### POST /api/sessions/:id/activate Response 200

```json
{ "activated": "SESSION-002", "spacecraft_id": "TEST-01" }
```

### Errors

- 404 — Session not found

---

## 18. Security Router Endpoints

```
GET /api/security   (various sub-routes)
```

**Trust:** TRUSTED
**Authorization:** None
**Owner:** Developer 1 (Security/Backend)

### Purpose

Security-specific queries: event counts, system status, threat statistics.

### Errors

Varies by sub-route

---

## Endpoint Trust Zone Summary

| Endpoint | Trust Zone | Attacker Access |
| ---------- | ------------ | ---------------- |
| `GET /api/health` | ALL | ❌ Blocked (403) |
| `POST /api/commands` | TRUSTED + UNTRUSTED exception | ✅ Allowed (demo only) |
| `POST /api/commands/operator` | TRUSTED | ❌ Blocked (403) |
| `GET /api/commands` | ALL | ❌ Blocked (403) |
| `GET /api/commands/next-sequence` | ALL | ❌ Blocked (403) |
| `POST /api/attacks` | TRUSTED | ❌ Blocked (403) |
| `GET /api/security-events` | TRUSTED | ❌ Blocked (403) |
| `GET /api/security-events/:id` | TRUSTED | ❌ Blocked (403) |
| `GET /api/spacecraft` | TRUSTED | ❌ Blocked (403) |
| `GET /api/spacecraft/:id` | TRUSTED | ❌ Blocked (403) |
| `GET /api/spacecraft/:id/twin` | TRUSTED | ❌ Blocked (403) |
| `POST /api/spacecraft/:id/recovery` | TRUSTED | ❌ Blocked (403) |
| `POST /api/spacecraft/tick` | TRUSTED | ❌ Blocked (403) |
| `POST /api/spacecraft/reset` | TRUSTED | ❌ Blocked (403) |
| `GET /api/mission/:id` | TRUSTED | ❌ Blocked (403) |
| `POST /api/mission/phase` | TRUSTED | ❌ Blocked (403) |
| `GET /api/ground-stations` | ALL | ❌ Blocked (403) |
| `GET /api/sessions` | TRUSTED | ❌ Blocked (403) |
| `POST /api/sessions/:id/activate` | TRUSTED | ❌ Blocked (403) |
| `GET /api/security` | TRUSTED | ❌ Blocked (403) |

**Only `/api/commands` and `/api/commands/*` are accessible from the attacker (port 3500).** This is the explicit exception for security demo.

---

## API Contract Change Rules

1. **Do not silently change request/response formats** — Update `src/api/client.ts` when changing backend contracts
2. **Do not change trust zone assignments without understanding demo impact** — The `/api/commands` exception for attacker is critical for the demo flow
3. **Do not add new endpoints without documenting them here** — This file is the source of truth
4. **Do not remove endpoints without checking importers** — `src/api/client.ts`, `src/components/*`, tests all depend on these routes
