# OrbitShield — System Architecture

**Status:** Current as of 2026-10-06
**Scope:** ST-02 local security gateway simulation
**Rule:** This documents what exists. Not a plan to change it.

---

## 1. Service Topology

```text
                 ┌──────────────────────┐
                 │     GROUND :3000     │
                 │   Trusted Operator    │
                 │   main.tsx → App.tsx  │
                 └──────────┬───────────┘
                            │ HTTP (trusted origin)
                            ▼
                 ┌──────────────────────┐
                 │    BACKEND :4000     │
                 │  Express + SQLite     │
                 │  Security Gateway     │
                 └───────┬───────┬──────┘
                         │       │
                         │       └──────────────┐
                         ▼                      ▼
                ┌────────────────┐      ┌───────────────┐
                │ SQLite DB      │      │ SpaceTwin     │
                │ backend-only   │      │ :3100         │
                └────────────────┘      └───────────────┘

                 ┌──────────────────────┐
                 │   ATTACKER :3500    │
                 │     UNTRUSTED        │
                 └──────────┬───────────┘
                            │ HTTP (hostile commands)
                            ▼
                       BACKEND :4000
                            │
                       Security Gateway
                            │
                     BLOCK / MONITOR /
                       SAFE MODE
```

All services run on `localhost`. Network segmentation is enforced by origin/port checks in the security middleware, not by physical network isolation.

---

## 2. Services & Ports

| Service | Port | Process | Entry Point | Vite Config |
|---------|------|---------|-------------|-------------|
| Ground Station | 3000 | Vite + React | `src/main.tsx` → `<App activeScreen="ground">` | `vite.ground.config.ts` (or `vite.config.ts`) |
| SpaceTwin | 3100 | Vite + React | `src/main.twin.tsx` → `<App activeScreen="twin">` | `vite.twin.config.ts` |
| Attacker Simulator | 3500 | Vite + React | `src/main.attacker.tsx` → `<App activeScreen="attacker">` | `vite.attacker.config.ts` |
| Backend / Gateway | 4000 | Node + Express | `backend/src/server.ts` | N/A (Express) |
| SQLite | — | Backend-only file | `backend/data/orbitshield.db` | N/A |

### Startup Commands

```bash
npm run dev          # concurrent: backend + ground (:3000)
npm run dev:demo     # concurrent: ground :3000 + twin :3100 + attacker :3500 + backend :4000
npm run dev:backend  # backend only (:4000)
npm run dev:frontend # ground only (:3000)
npm run dev:twin     # twin only (:3100)
npm run dev:attacker # attacker only (:3500)
```

`start.bat` / `stop.bat` provide Windows service management with port collision detection.

---

## 3. Frontend Structure

```
src/
├── main.tsx              # Ground entry (port 3000)
├── main.twin.tsx         # SpaceTwin entry (port 3100)
├── main.attacker.tsx     # Attacker entry (port 3500)
├── App.tsx               # Shared app shell, screen routing via activeScreen prop
├── index.css             # @import "tailwindcss"
├── api/
│   └── client.ts         # Typed HTTP client (orbitShieldApi) — browser-safe
├── components/
│   ├── AttackSimulator.tsx       # Attacker UI — standalone attack buttons
│   ├── AttackSimulatorPanel.tsx  # Attack panel display
│   ├── BackendMonitor.tsx        # Backend status display
│   ├── ExplainableIncidentPanel.tsx
│   ├── FlightRulesView.tsx
│   ├── GroundConsole.tsx         # Ground UI — operator commands + demo mode
│   ├── GroundStationTerminal.tsx
│   ├── Header.tsx
│   ├── LiveCommandStream.tsx
│   ├── OperatorShell.tsx         # Layout shell
│   ├── SecurityEventLog.tsx
│   ├── SecurityOverview.tsx
│   ├── SecurityStatusCards.tsx
│   ├── ServiceTopology.tsx
│   ├── SessionView.tsx
│   ├── SpacecraftTelemetry.tsx
│   ├── SpacecraftTwin.tsx        # Twin visualization
│   └── SessionView.tsx
├── gateway/                 # ⚠️ SHARED — security pipeline modules (see Section 6)
├── attacker/
│   ├── attackerClient.ts    # Browser-side attack envelope generator (Web Crypto)
│   └── simulator.ts         # Server-side attack scenario generator (Node-only)
├── ground_station/
│   └── client.ts           # ⚠️ NODE-ONLY — credential holder, NEVER import in browser
├── models/
│   ├── command.ts          # CommandEnvelope, CommandType, etc.
│   ├── audit.ts            # AuditEvent, check results, SecurityDecision
│   ├── spacecraft.ts       # SpacecraftState, EssentialTelemetry
│   ├── mission.ts          # MissionState, MissionPhase
│   └── attacks.ts          # AttackScenario (UI metadata only)
└── spacecraft/
    └── simulator.ts        # SpacecraftSimulator class (shared, used by both frontend bundle and backend)
```

### Frontend Entry Points

All three Vite entry points render the same `App.tsx` with different `activeScreen` values:

- `activeScreen="ground"` → `<GroundConsole spacecraftId="SAT-01" />`
- `activeScreen="twin"` → `<SpacecraftTwin spacecraftId="SAT-01" />`
- `activeScreen="attacker"` → `<AttackSimulator />`

The `App.tsx` shell also renders shared layout components: `ServiceTopology`, `SecurityStatusCards`, `SecurityEventLog`, `SessionView`, `BackendMonitor`.

---

## 4. Backend Structure

```
backend/
├── src/
│   ├── server.ts           # Express server, graceful shutdown
│   ├── app.ts              # createApp() — wires DB, services, middleware, routes
│   ├── config.ts           # Env parsing (PORT, DATABASE_PATH, SPACECRAFT_ID, MAX_CLOCK_SKEW_SECONDS)
│   ├── middleware/
│   │   ├── security.ts     # Trust zone enforcement, attacker blocking
│   │   ├── errorHandler.ts
│   │   └── requestLogger.ts
│   ├── routes/
│   │   ├── commands.ts
│   │   ├── attacks.ts
│   │   ├── spacecraft.ts
│   │   ├── mission.ts
│   │   ├── health.ts
│   │   ├── security.ts
│   │   ├── securityEvents.ts
│   │   ├── groundStations.ts
│   │   ├── sessions.ts
│   │   └── ... 
│   ├── services/
│   │   ├── commandService.ts      # ⚠️ CENTRAL ORCHESTRATOR
│   │   ├── attackService.ts
│   │   ├── spacecraftService.ts
│   │   ├── missionService.ts
│   │   ├── securityEventService.ts
│   │   └── sessionService.ts
│   ├── db/
│   │   ├── database.ts           # SQLite singleton, migrations
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   └── repositories/
│   └── tests/
│       └── backend.test.ts       # 6 backend HTTP tests
├── data/
│   └── orbitshield.db           # SQLite database file
└── package.json
```

### Backend Service Wiring (`app.ts`)

```typescript
// Service creation order (app.ts):
1. getDatabase()                          // SQLite initialization
2. new GroundStationRepository().seedFromRegistry()
3. new MissionService(config.defaultSpacecraftId)
4. new SpacecraftService(missionService, spacecraftId)
5. new CommandService(spacecraftService, missionService, spacecraftId)  // builds SecurityGateway internally
6. new AttackService(commandService, missionService, spacecraftId)
7. new SessionService()
8. new SecurityEventService()

// Route wiring:
- /api/health          → healthRouter({ spacecraftService, missionService })
- /api/commands        → commandsRouter({ commandService })
- /api/attacks         → attacksRouter({ attackService })
- /api/spacecraft      → spacecraftRouter({ spacecraftService, commandService, sessionService, missionService })
- /api/mission         → missionRouter({ missionService })
- /api/security-events → securityEventsRouter({ securityEventService })
- /api/security        → securityRouter({ securityEventService, spacecraftService, missionService })
- /api/ground-stations → groundStationsRouter()
- /api/sessions        → sessionsRouter({ sessionService })
```

---

## 5. Database

**SQLite is backend-only.** The browser never touches it.

### Tables

| Table | Purpose |
|-------|---------|
| `ground_stations` | Seeded from AUTHORIZED_GROUND_STATIONS registry |
| `commands` | Persisted command envelopes (with decrypted parameters for encrypted commands) |
| `security_events` | Full pipeline evidence as JSON (complete AuditEvent) |
| `spacecraft_state` | Last known vehicle state |
| `mission_state` | Last known mission state |
| `replay_state` | Per-(spacecraft_id, key_id) sequence counters |
| `sessions` | Operator sessions |

### Persistence Guarantees

- Migrations in `backend/src/db/migrations/` applied automatically at startup
- Command + audit event + replay state + spacecraft state written in **one SQLite transaction** per decision
- Persistence failure → `PersistenceError` → HTTP 503 (never silently converts decision to success)
- On startup, backend rehydrates: replay sequence scopes, nonce cache, behavioral history, mission state, spacecraft state

### Repository Classes

- `CommandRepository` — command CRUD, sequence queries, recent nonces
- `SecurityEventRepository` — event CRUD, filtering, counts by decision
- `ReplayStateRepository` — per-sender sequence persistence
- `SpacecraftRepository` — spacecraft state persistence
- `GroundStationRepository` — seeded registry snapshot

---

## 6. Shared Modules — The `src/gateway/` Directory

**This is the most important architectural fact in the codebase.**

The security pipeline lives in `src/gateway/`, NOT `backend/src/gateway/`. These modules are imported by both:

- **Frontend bundle** (via `src/ground_station/client.ts`, `src/attacker/attackerClient.ts`) — uses crypto utils, authentication types, integrity signing
- **Backend** (via `backend/src/services/commandService.ts` imports `../../../src/gateway/gateway`) — runs the full pipeline

```
src/gateway/
├── gateway.ts           # SecurityGateway — main pipeline orchestration
├── authentication.ts    # AuthenticationModule + AUTHORIZED_GROUND_STATIONS registry
├── integrity.ts         # IntegrityModule — HMAC verification + AES-GCM decryption
├── replay.ts            # ReplayProtectionModule — nonce cache + sequence tracking
├── behavioral.ts        # BehavioralAnalysisModule — anomaly detection patterns
├── context.ts           # MissionContextModule — eclipse/thruster/wheel constraint evaluation
├── risk.ts              # RiskEngine — multi-factor 0-100 scoring
├── policy.ts            # SafetyPolicyEngine — deterministic safety rules, SAFE_MODE triggers
└── crypto_utils.ts      # canonicalJsonStringify, computeHmacSha256, verifySignatureString, AES-GCM encrypt/decrypt
```

### Import Paths

- Backend → gateway: `import { SecurityGateway } from '../../../src/gateway/gateway'` (from `backend/src/services/commandService.ts`)
- Frontend (credential holder) → gateway: `import { AUTHORIZED_GROUND_STATIONS } from '../gateway/authentication'` (from `src/ground_station/client.ts`)
- Frontend (attacker) → gateway: `import { canonicalJsonStringify, computeHmacSha256 } from '../gateway/crypto_utils'` (from `src/attacker/attackerClient.ts`)
- Frontend (shared simulator) → gateway: `import { IntegrityModule } from '../gateway/integrity'` (from `src/ground_station/client.ts`)

**There is no `backend/src/gateway/` directory.** All gateway logic is in `src/gateway/`.

---

## 7. Security Pipeline (Actual Implementation)

The pipeline executes sequentially in `SecurityGateway.processCommand()`:

```text
1. Schema/Structural Validation  (gateway.ts inline — MALFORMED → immediate BLOCK)
         ↓
2. Authentication                (AuthenticationModule.authenticate() — key registry lookup)
         ↓
3. Integrity                     (IntegrityModule.verifyIntegrity() — HMAC-SHA256 + AES-GCM decrypt)
         ↓
4. Replay Protection             (ReplayProtectionModule.evaluate() — nonce + sequence + timestamp)
         ↓
5. Behavioral Analysis           (BehavioralAnalysisModule.evaluate() — anomaly patterns)
         ↓
6. Mission Context               (MissionContextModule.evaluate() — eclipse/thruster/wheel rules)
         ↓
7. Risk Engine                   (RiskEngine.evaluate() — 0-100 multi-factor score)
         ↓
8. Safety Policy                 (SafetyPolicyEngine.evaluate() — deterministic rules, SAFE_MODE trigger)
         ↓
9. Response Dispatch             (gateway.ts — execute command or block, spacecraft simulator)
         ↓
10. Audit Event Creation         (gateway.ts — complete AuditEvent record)
```

### Pipeline Inputs

- `CommandEnvelope` — header, payload, security fields
- `SpacecraftState` — current vehicle state (from simulator)
- `MissionContextModule` — injected so mission state persists outside gateway process

### Pipeline Outputs

- `GatewayProcessResult` — audit_event, executed, execution_message, spacecraft_state, telemetry

### Hard Failures (stop pipeline early)

| Failure | Rule Triggered | Decision |
|---------|---------------|----------|
| Malformed envelope | `SCHEMA_PARSE_FAILURE` | BLOCK |
| Auth failure (unknown/revoked key) | `HARD_CONSTRAINT_AUTHENTICATION_FAIL` | BLOCK |
| Integrity failure (HMAC mismatch) | `HARD_CONSTRAINT_INTEGRITY_FAIL` | BLOCK |
| Replay detected (nonce/sequence/timestamp) | `HARD_CONSTRAINT_REPLAY_DETECTED` | BLOCK |
| SAFE_MODE active + dangerous command | `HARD_CONSTRAINT_SAFE_MODE_LOCKED` | BLOCK |
| SAFE_MODE active + OPERATOR_RECOVER + battery < 40% | `RECOVERY_INSUFFICIENT_POWER` | BLOCK |

### SAFE_MODE Trigger

- Risk score >= 75 OR severity === 'CRITICAL' → `AUTONOMOUS_SAFE_MODE_TRIGGER`
- Command types allowed in SAFE_MODE: `QUERY_TELEMETRY`, `OPERATOR_RECOVER`
- All other commands blocked by `HARD_CONSTRAINT_SAFE_MODE_LOCKED`

---

## 8. Trust Zones

Enforced by `backend/src/middleware/security.ts`:

| Zone | Origins | Access |
|------|---------|--------|
| TRUSTED | `localhost:3000` (Ground), `localhost:3100` (SpaceTwin) | All endpoints |
| UNTRUSTED | `localhost:3500` (Attacker) | `/api/commands` ONLY (explicit exception for demo) |
| INTERNAL | `localhost:4000` | All endpoints |
| UNKNOWN | No origin / other | Logged, allowed for backward compatibility |

### Attacker Exception

The attacker on port 3500 is blocked from all endpoints EXCEPT `/api/commands` and `/api/commands/*`. This is an explicit exception so the attacker can demonstrate attacks through the full gateway pipeline. Blocked requests generate a security event with `UNAUTHORIZED_ACCESS` type.

---

## 9. Credential Boundary

### What Holds Secrets

- `src/ground_station/client.ts` — `GroundStationClient` holds `secret_key` and `encryption_key` from `AUTHORIZED_GROUND_STATIONS`
- `src/gateway/authentication.ts` — `AUTHORIZED_GROUND_STATIONS` registry defines all credentials

### What Must NEVER Import Credential-Holding Modules

**Browser code must NOT import `src/ground_station/client.ts`.**

Currently verified:
- ✅ `backend/src/services/commandService.ts` imports it (server-side)
- ✅ `src/tests/gateway.test.ts` imports it (Node test runtime)
- ✅ `src/attacker/simulator.ts` imports it (server-side attack generator)
- ❌ `src/components/*` do NOT import it (browser UI)

**No build-time guard exists.** The boundary is enforced by convention and the build check that verifies no credentials leak to the frontend bundle.

---

## 10. Cross-Service Communication

### Ground → Backend (trusted)

```typescript
POST /api/commands/operator     → operator command intent (key_id, command_type, parameters?)
GET  /api/spacecraft            → vehicle state + telemetry (trusted)
GET  /api/spacecraft/:id/twin   → visualization payload (trusted)
POST /api/spacecraft/:id/recovery → operator recovery (trusted, requires Origin: localhost:3000)
GET  /api/mission               → mission state (trusted)
POST /api/mission/phase         → switch orbital phase (trusted)
GET  /api/security-events       → audit trail (trusted)
GET  /api/health                → liveness + persistence stats (trusted)
```

### Attacker → Backend (untrusted)

```typescript
POST /api/commands              → hostile command envelope (UNTRUSTED, allowed for demo only)
// ALL OTHER ENDPOINTS → 403 BLOCKED, security event generated
```

### SpaceTwin → Backend (trusted)

```typescript
GET /api/spacecraft/:id/twin   → visualization payload (trusted)
GET /api/health                → liveness (trusted)
```

---

## 11. Vite Configuration

Three Vite configs serve the same React app on different ports:

| Config | Port | Purpose | Proxy |
|--------|------|----------|-------|
| `vite.config.ts` | 3000 | Default / Ground console | `/api` → `http://127.0.0.1:4000` |
| `vite.ground.config.ts` | 3000 | Ground (explicit) | `/api` → `http://127.0.0.1:4000` (added `Origin: http://localhost:3000` header for recovery) |
| `vite.twin.config.ts` | 3100 | SpaceTwin visualization | `/api` → `http://127.0.0.1:4000` |
| `vite.attacker.config.ts` | 3500 | Attacker simulator | `/api` → `http://127.0.0.1:4000`, adds `Origin: http://localhost:3500` header |

All configs use `@vitejs/plugin-react` and `@tailwindcss/vite` plugins.

---

## 12. Current Technical Debt

### 🔴 High Priority

1. **Gateway modules in `src/gateway/`, not `backend/src/gateway/`** — The security pipeline is the core of the system but lives in the frontend source tree. Backend imports it via `../../../src/gateway/`. This is the biggest structural oddity.

2. **No structural guard preventing browser import of `src/ground_station/client.ts`** — Enforced only by convention. A build check verifies no credentials leak, but there's no import-time barrier.

3. **Quarantine state is in-memory only** — `security.ts` has a Map for quarantine, not persisted. Restart clears it.

4. **Attacker cannot view security event timeline** — `SecurityEventLog` requires trusted origin; attacker's attempts to view events are blocked at perimeter.

### 🟡 Medium Priority

5. **Demo mode on GroundConsole** — Guided judge flow runs from trusted Ground console. Attacker screen retains standalone attack buttons (not part of guided flow). This is architecturally correct.

6. **Some duplication between `src/models/attacks.ts` and `src/attacker/attackerClient.ts`** — UI metadata and attack generation logic overlap.

7. **No `backend/src/gateway/` directory** — If backend-only gateway extensions are needed, there's no clear place.

8. **`vite.config.ts` and `vite.ground.config.ts` are nearly identical** — Both serve ground on port 3000.

### 🟢 Low Priority

9. **`focus.md` and `current-state.md` in repo root** — Could move to `docs/` or `ST02_Project_Docs/`

10. **Scattered documentation** — Docs across `docs/`, `ST02_Project_Docs/`, and repo root

---

## 13. Dependency Direction

Preferred:
```text
UI Components (src/components/*)
  ↓
API Client (src/api/client.ts)
  ↓
Domain Types (src/models/*)
  ↓
Gateway Modules (src/gateway/*) ← also imported by backend
  ↓
Backend Services (backend/src/services/*)
  ↓
Database (backend/src/db/*)
```

Avoid:
```text
Component A ↕ Component B          # circular component deps
Backend internals → Browser code   # credential leakage
React components → crypto policy   # policy in UI layer
```

---

## 14. Files That Are High-Risk to Modify

See `docs/CODE_OWNERSHIP.md` for the complete classification. The most critical:

- `src/gateway/gateway.ts` — pipeline orchestration
- `src/gateway/policy.ts` — SAFE_MODE triggers, recovery rules
- `src/gateway/authentication.ts` — credential registry
- `src/gateway/integrity.ts` — HMAC verification
- `src/gateway/replay.ts` — anti-replay state
- `backend/src/services/commandService.ts` — central orchestrator
- `backend/src/middleware/security.ts` — perimeter enforcement
- `src/models/command.ts` — core data contract
- `src/models/audit.ts` — audit contract
