# OrbitShield — Architecture Audit (Pre-Refactoring Baseline)

**Date:** 2026-10-06
**Purpose:** Baseline inspection before any reorganization or refactoring.
**Rule:** This document records the *current* state. It is not a plan to change things yet.

---

## 1. Services & Ports

| Service | Port | Role | Process |
|---------|------|------|---------|
| Ground Station | 3000 | Trusted operator UI, command issuance | Vite (vite.ground.config.ts / vite.config.ts) |
| SpaceTwin | 3100 | Read-only spacecraft visualization | Vite (vite.twin.config.ts) |
| Attacker Simulator | 3500 | UNTRUSTED attack demonstration UI | Vite (vite.attacker.config.ts) |
| Backend / Gateway | 4000 | Security pipeline, credential registry, SQLite | Node + Express (backend/src/server.ts) |
| SQLite | — | Backend-only persistence | `backend/data/orbitshield.db` |

**All services run on localhost.** Network segmentation is logical (origin/port checks), not physical.

---

## 2. Startup

```bash
npm run dev          # concurrent backend + ground (:3000)
npm run dev:demo     # concurrent: ground :3000, twin :3100, attacker :3500, backend :4000
npm run dev:backend  # backend only (:4000)
npm run dev:frontend # ground only (:3000)
npm run dev:twin     # twin only (:3100)
npm run dev:attacker # attacker only (:3500)
```

`start.bat` / `stop.bat` exist for Windows service management with port collision detection.

---

## 3. Frontend Entry Points

| File | Serves | Notes |
|------|---------|-------|
| `src/main.tsx` | Ground :3000 (default) | Renders `<App activeScreen="ground">` |
| `src/main.twin.tsx` | SpaceTwin :3100 | Renders `<App activeScreen="twin">` |
| `src/main.attacker.tsx` | Attacker :3500 | Renders `<App activeScreen="attacker">`, imports `./index.css` |

All three render the same `src/App.tsx`, switching content via `activeScreen` prop:
- `ground` → `<GroundConsole>`
- `twin` → `<SpacecraftTwin>`
- `attacker` → `<AttackSimulator>`

`src/index.css` contains `@import "tailwindcss"`. Tailwind is wired via `@tailwindcss/vite` in all three Vite configs.

---

## 4. Backend Entry Points

| File | Role |
|------|------|
| `backend/src/server.ts` | Express server startup, graceful shutdown |
| `backend/src/app.ts` | `createApp()` — wires DB, services, middleware, routes |
| `backend/src/config.ts` | Env parsing (`PORT`, `DATABASE_PATH`, `SPACECRAFT_ID`, `MAX_CLOCK_SKEW_SECONDS`) |
| `backend/src/db/database.ts` | SQLite initialization, migrations, `getDatabase()` singleton |
| `backend/src/services/commandService.ts` | **Central orchestrator** — owns gateway lifecycle, persistence transaction, credential registry access, operator client pool |
| `backend/src/services/attackService.ts` | Attack scenario runner (calls `commandService.processCommand` with pre-built envelopes) |
| `backend/src/services/spacecraftService.ts` | Spacecraft state wrapper |
| `backend/src/services/missionService.ts` | Mission state wrapper |
| `backend/src/services/securityEventService.ts` | Security event query service |
| `backend/src/services/sessionService.ts` | Session management |

---

## 5. Security Pipeline (Actual Implementation)

The pipeline is implemented in `src/gateway/gateway.ts` (`SecurityGateway.processCommand`) and executed inside the backend via `CommandService`.

**Sequence:**

```
1. Schema/Structural Validation  (gateway.ts — inline, MALFORMED)
2. Authentication                (src/gateway/authentication.ts — AuthenticationModule)
3. Integrity                     (src/gateway/integrity.ts — IntegrityModule, HMAC-SHA256 + AES-GCM decrypt)
4. Replay Protection             (src/gateway/replay.ts — ReplayProtectionModule, nonce+sequence+timestamp)
5. Behavioral Analysis           (src/gateway/behavioral.ts — BehavioralAnalysisModule, anomaly patterns)
6. Mission Context               (src/gateway/context.ts — MissionContextModule, eclipse/thruster/wheel rules)
7. Risk Engine                   (src/gateway/risk.ts — RiskEngine, 0-100 multi-factor score)
8. Safety Policy                 (src/gateway/policy.ts — SafetyPolicyEngine, deterministic rules, SAFE_MODE trigger)
9. Response Dispatch             (gateway.ts — execute or block, spacecraft simulator)
10. Audit Event Creation         (gateway.ts — full AuditEvent record)
```

**Pipeline modules are in `src/gateway/`** — these are shared code imported by both:
- Frontend bundle (via `src/ground_station/client.ts`, `src/attacker/attackerClient.ts`) — uses crypto utils, authentication types
- Backend (via `backend/src/services/commandService.ts` imports `../../../src/gateway/gateway`)

This is the **most important architectural fact** in this codebase: the security pipeline lives in `src/gateway/`, not `backend/src/gateway/`.

---

## 6. Database Boundary

**SQLite is backend-only.** Access patterns:

- `backend/src/db/database.ts` — `getDatabase()` singleton, migration runner
- `backend/src/db/schema.sql` — schema definition
- `backend/src/db/migrations/` — migration files
- `backend/src/db/repositories/` — typed repository classes:
  - `commandRepository.ts`
  - `securityEventRepository.ts`
  - `replayStateRepository.ts`
  - `spacecraftRepository.ts`
  - `groundStationRepository.ts`

**Frontend never touches SQLite.** The browser talks to the backend via HTTP API only.

**Persistence transaction:** `CommandService.processCommand()` wraps command insert + audit event insert + replay state upsert + spacecraft state save in ONE SQLite transaction. A persistence failure throws `PersistenceError` → HTTP 503.

---

## 7. Attacker Boundary

The attacker runs on port 3500 and is **UNTRUSTED**.

**Attacker capabilities:**
- `src/attacker/attackerClient.ts` — runs in browser, generates hostile command envelopes client-side using Web Crypto API (HMAC-SHA256)
- Sends envelopes directly to `POST /api/commands` on backend
- Generates: TAMPERING, INJECTION, REPLAY, CREDENTIAL_COMPROMISE, DESTRUCTIVE_BURN

**Attacker restrictions (enforced by `backend/src/middleware/security.ts`):**
- Attacker origin (`localhost:3500`) is classified as `UNTRUSTED`
- Attacker CAN submit to `/api/commands` (for security demo) — this is an explicit exception
- Attacker CANNOT access: `/api/health`, `/api/sessions`, `/api/spacecraft`, `/api/mission`, `/api/security`, `/api/security-events`, `/api/ground-stations`
- Blocked requests generate a security event with `UNAUTHORIZED_ACCESS` type, event ID persisted to SQLite

**Critical boundary rule:** `src/ground_station/client.ts` contains credential material and **must NEVER be imported by browser code**. It is imported by:
- `backend/src/services/commandService.ts` (server-side) ✅
- `src/tests/gateway.test.ts` (test code, Node runtime) ✅
- `src/attacker/simulator.ts` (server-side attack generator) ✅

**NOT imported by:** `src/components/*` (browser UI) ✅

---

## 8. Important Shared Modules

These are the modules that multiple parts of the system depend on:

### `src/gateway/` (security pipeline — SHARED, high-risk)
- `gateway.ts` — SecurityGateway class, main pipeline
- `authentication.ts` — AuthenticationModule, AUTHORIZED_GROUND_STATIONS registry
- `integrity.ts` — IntegrityModule, HMAC verification + AES-GCM decryption
- `replay.ts` — ReplayProtectionModule, nonce cache + sequence tracking
- `behavioral.ts` — BehavioralAnalysisModule, anomaly detection patterns
- `context.ts` — MissionContextModule, eclipse/thruster/wheel constraint evaluation
- `risk.ts` — RiskEngine, multi-factor scoring
- `policy.ts` — SafetyPolicyEngine, deterministic safety rules, SAFE_MODE triggers
- `crypto_utils.ts` — canonicalJsonStringify, computeHmacSha256, verifySignatureString, encrypt/decrypt AES-GCM

### `src/models/` (shared types — SHARED)
- `command.ts` — CommandEnvelope, CommandHeader, CommandPayload, CommandSecurity, CommandType
- `audit.ts` — AuditEvent, all check result interfaces, SecurityDecision, RiskSeverity
- `spacecraft.ts` — SpacecraftState, EssentialTelemetry, OperatingMode
- `mission.ts` — MissionState, MissionPhase, OperatingConstraint, MissionDocument
- `attacks.ts` — AttackScenario, ATTACK_SCENARIOS (UI-safe metadata only)

### `src/ground_station/client.ts` (credential holder — BACKEND/TEST ONLY)
- `GroundStationClient` — holds credential material, creates signed/encrypted envelopes
- **DO NOT import in browser components**

### `src/attacker/attackerClient.ts` (browser-side attack generator — ATTACKER ONLY)
- `AttackerClient` — generates hostile envelopes in browser using Web Crypto
- Uses `canonicalJsonStringify` and `computeHmacSha256` from `src/gateway/crypto_utils.ts`

### `src/api/client.ts` (frontend API client — BROWSER SAFE)
- `orbitShieldApi` — typed fetch client for all backend endpoints
- Sends command intents, not credential material

---

## 9. Cross-Service Communication

```
Ground :3000 ──HTTP──▶ Backend :4000
  ├─ POST /api/commands/operator     (operator command intent, trusted origin)
  ├─ GET  /api/spacecraft            (vehicle state, trusted origin)
  ├─ GET  /api/mission               (mission state, trusted origin)
  ├─ POST /api/spacecraft/.../recovery (recovery, trusted origin)
  ├─ GET  /api/security-events       (audit trail, trusted origin)
  └─ ... (all endpoints, trusted)

SpaceTwin :3100 ──HTTP──▶ Backend :4000
  ├─ GET  /api/spacecraft/:id/twin   (visualization payload, trusted origin)
  └─ GET  /api/health                (trusted origin)

Attacker :3500 ──HTTP──▶ Backend :4000
  ├─ POST /api/commands              (hostile envelope, UNTRUSTED but allowed for demo)
  └─ ALL OTHER ENDPOINTS             BLOCKED with 403, security event generated
```

**CORS:** Dynamic — `Access-Control-Allow-Origin` is set to the request's `Origin` header. Trusted origins get full access; untrusted origins are blocked at the middleware layer before CORS is relevant.

---

## 10. Current Technical Debt

### 🔴 High priority

1. **Gateway modules live in `src/gateway/` not `backend/src/gateway/`**
   - The security pipeline is the core of the system but lives in the frontend source tree
   - Backend imports it via `../../../src/gateway/` which is fragile
   - This is the biggest structural oddity in the repo

2. **`src/ground_station/client.ts` must not be imported by browser code** — enforced only by convention/comments, not by build boundaries
   - Contains credential material
   - Currently not imported by browser code (verified), but there's no structural guard

3. **Quarantine state is in-memory only** — `security.ts` has a Map for quarantine, not persisted. Restart clears it.

4. **Attacker cannot view security event timeline** — `SecurityEventLog` requires trusted origin; attacker's attempts to view events are blocked at perimeter

### 🟡 Medium priority

5. **Demo mode is on GroundConsole** — the guided judge flow runs from trusted Ground console, not attacker screen. This is architecturally correct but means the attacker screen's demo buttons are standalone (not part of the guided flow).

6. **`src/models/attacks.ts` and `src/attacker/attackerClient.ts` both define attack scenarios** — some duplication between UI metadata and attack generation logic

7. **No `backend/src/gateway/` directory** — all gateway logic is in `src/gateway/`. If backend-only gateway extensions are needed, there's no clear place for them.

8. **Vite configs are somewhat redundant** — `vite.config.ts` and `vite.ground.config.ts` are nearly identical (both serve ground on port 3000)

### 🟢 Low priority / cosmetic

9. **`focus.md` and `current-state.md` in repo root** — could move to `docs/` or `ST02_Project_Docs/`

10. **No `docs/` directory with organized documentation** — docs are scattered: `docs/` has some files, `ST02_Project_Docs/` has others, root has `README.md`, `judge-todo.md`, `focus.md`

---

## 11. High-Conflict / High-Risk Files

These files are touched by multiple concerns and should have clear ownership:

### 🔴 CRITICAL — DO NOT MODIFY WITHOUT UNDERSTANDING IMPACT

| File | Why high-risk | Owner |
|------|---------------|-------|
| `src/gateway/gateway.ts` | Main pipeline orchestration — affects ALL security decisions | Security/Backend |
| `src/gateway/policy.ts` | Deterministic safety rules — SAFE_MODE triggers, recovery logic | Security/Backend |
| `src/gateway/authentication.ts` | Credential registry — defines who can send commands | Security/Backend |
| `src/gateway/integrity.ts` | HMAC verification — tamper detection | Security/Backend |
| `src/gateway/replay.ts` | Anti-replay — sequence/nonce state | Security/Backend |
| `src/gateway/behavioral.ts` | Anomaly detection — affects risk scoring | Security/Backend |
| `src/gateway/context.ts` | Mission context — eclipse/thruster rules | Security/Backend |
| `src/gateway/risk.ts` | Risk scoring — CRITICAL threshold determination | Security/Backend |
| `backend/src/services/commandService.ts` | Central orchestrator — persistence, gateway lifecycle, credential access | Security/Backend |
| `backend/src/middleware/security.ts` | Perimeter security — trust zone enforcement, attacker blocking | Security/Backend |
| `backend/src/app.ts` | Service wiring — affects all route/service connections | Security/Backend |
| `backend/src/config.ts` | Configuration — affects ports, DB path, spacecraft ID | Security/Backend |
| `src/models/command.ts` | Core data contract — envelope structure | Shared (additive only) |
| `src/models/audit.ts` | Audit contract — all check result structures | Shared (additive only) |
| `src/App.tsx` | Main app shell — screen routing, shared layout | Frontend |
| `src/components/AttackSimulator.tsx` | Attacker UI — demo flow, attack buttons | Attacker/Demo |
| `src/components/GroundConsole.tsx` | Ground UI — operator commands, demo mode | Frontend + Demo |
| `vite.config.ts` | Vite config — port 3000, proxy, plugins | DevOps |
| `vite.twin.config.ts` | Vite config — port 3100 | DevOps |
| `vite.attacker.config.ts` | Vite config — port 3500, proxy | DevOps |
| `package.json` | Dependencies, scripts — affects entire build | DevOps |
| `start.bat` / `stop.bat` | Service lifecycle — port management | DevOps |

### 🟡 SHARED — Coordinate before changing

| File | Notes |
|------|-------|
| `src/models/*.ts` | Additive changes OK; breaking changes affect all importers |
| `src/api/client.ts` | Frontend API client — changes must match backend routes |
| `src/attacker/attackerClient.ts` | Attack generation — changes affect demo flow |
| `src/ground_station/client.ts` | Credential holder — must stay backend/test only |

### 🟢 LOW CONFLICT — Safe to modify independently

| File | Notes |
|------|-------|
| `src/components/SecurityStatusCards.tsx` | Presentation only |
| `src/components/ServiceTopology.tsx` | Presentation only |
| `src/components/BackendMonitor.tsx` | Presentation only |
| `src/components/SessionView.tsx` | Presentation only |
| `src/components/Header.tsx` | Presentation only |
| `src/components/OperatorShell.tsx` | Layout shell |
| `src/components/SpacecraftTwin.tsx` | Twin visualization |
| `src/components/FlightRulesView.tsx` | Display only |
| `src/components/GroundStationTerminal.tsx` | Terminal display |
| `src/components/LiveCommandStream.tsx` | Stream display |
| `src/components/ExplainableIncidentPanel.tsx` | Incident display |
| `src/components/SpacecraftTelemetry.tsx` | Telemetry display |
| `src/components/SecurityEventLog.tsx` | Event log display |
| `src/components/SecurityOverview.tsx` | Dashboard display |
| `src/components/AttackSimulatorPanel.tsx` | Attack panel display |

---

## 12. Files That Should NOT Be Modified Casually

These files have subtle dependencies or enforce critical boundaries:

1. **`src/ground_station/client.ts`** — Contains credential material. Modifying this risks exposing secrets to browser bundle. The build check in `package.json` verifies no credentials leak to frontend, but the structural boundary is convention-only.

2. **`src/gateway/crypto_utils.ts`** — Cryptographic primitives. Any change to `canonicalJsonStringify` breaks signature compatibility across all envelopes. Any change to HMAC/AES-GCM usage must use established Web Crypto APIs (no custom crypto).

3. **`src/gateway/replay.ts`** — Replay state management. Changes to nonce cache eviction, sequence tracking, or clock skew logic can silently weaken anti-replay protection.

4. **`backend/src/services/commandService.ts`** — The `getOperatorClient` method was recently fixed to re-sync sequence counters on every call. Any revert or further change to sequence management can cause replay false positives/negatives.

5. **`backend/src/middleware/security.ts`** — The trust zone logic and the `/api/commands` exception for attacker demo are tightly coupled. Changing the exception list can break the demo flow or expose restricted endpoints.

6. **`src/gateway/policy.ts`** — The `HARD_CONSTRAINT_SAFE_MODE_LOCKED` rule and recovery logic were recently verified as part of P0. Changes to policy rules can silently break the demo sequence.

---

## 13. Build & Test Commands

```bash
npm install && npm --prefix backend install   # install all dependencies
npm run dev                                    # backend + ground concurrent
npm run dev:demo                               # all 4 services
npm test                                       # all test suites (gateway + backend)
npm run test:gateway                           # gateway pipeline tests (10 tests)
npm run test:backend                           # backend HTTP tests (6 tests)
npm run typecheck                              # frontend tsc --noEmit
npm run typecheck:backend                      # backend tsc --noEmit
npm run build                                  # typecheck + vite build
```

**Test files:**
- `src/tests/gateway.test.ts` — 10 gateway pipeline tests (TRD Section 14)
- `backend/src/tests/backend.test.ts` — 6 backend HTTP tests

---

## 14. Current Documentation State

| Document | Location | Status |
|----------|----------|--------|
| README.md | Root | ✅ Good — architecture overview, API table, crypto notes |
| judge-todo.md | Root | ✅ Good — MoSCoW backlog, 18 must-have items |
| focus.md | Root | ✅ Good — implementation focus, P0 status, runtime verification |
| ARCHITECTURE.md | docs/ | ⚠️ Exists — needs review against actual code |
| THREAT_MODEL.md | docs/ | ⚠️ Exists — needs review |
| DECISIONS.md | docs/ | ⚠️ Exists — needs review |
| LOCAL_DEPLOYMENT.md | docs/ | ⚠️ Exists — needs review |
| ROADMAP.md | docs/ | ⚠️ Exists — needs review |
| PRD.md | docs/ | ⚠️ Exists — needs review |
| TRD.md | docs/ | ⚠️ Exists — needs review |
| ARCHITECTURE_AUDIT.md | ST02_Project_Docs/ | 🆕 This file — initial baseline |

---

## 15. Recommendations for Next Steps (Not Action Items Yet)

1. **Create `docs/ARCHITECTURE.md`** — consolidated architecture doc replacing/augmenting scattered docs
2. **Create `docs/SECURITY_ARCHITECTURE.md`** — detailed security pipeline documentation
3. **Create `docs/API_CONTRACTS.md`** — all backend endpoints with trust zones
4. **Create `docs/THREAT_MODEL.md`** — consolidated threat model (move from `docs/THREAT_MODEL.md` + `ST02_Project_Docs/THREAT_MODEL.md`)
5. **Create `docs/DEMO_RUNBOOK.md`** — judge demonstration step-by-step
6. **Create `docs/DEVELOPMENT.md`** — developer setup, commands, troubleshooting
7. **Create `docs/TESTING.md`** — test documentation
8. **Create `docs/TEAM_WORKFLOW.md`** — four-developer ownership model
9. **Create `docs/CODE_OWNERSHIP.md`** — file-level ownership and risk classification
10. **Create `docs/DECISIONS/ADR-*` — architectural decision records
11. **Consider moving `src/gateway/` to `backend/src/gateway/`** — but ONLY after understanding all import paths and verifying tests still pass. This is a high-risk move.
12. **Consider adding build-time guard** to prevent `src/ground_station/client.ts` from being imported by browser code
