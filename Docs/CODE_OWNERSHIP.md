# OrbitShield — Code Ownership Classification

**Status:** Current as of 2026-10-06
**Purpose:** Identify who owns what, and which files are risky to modify
**Rule:** Check this before touching any file. When in doubt, ask the owner.

---

## 🔴 HIGH RISK — DO NOT MODIFY WITHOUT OWNER

These files are critical to security, correctness, or system operation. Only the listed owner should modify them. Other developers submit a request/patch instead.

### Security Pipeline (Owner: Developer 1 — Security/Backend)

| File | Why High-Risk | Owner |
|------|---------------|-------|
| `src/gateway/gateway.ts` | Main pipeline orchestration — affects ALL security decisions | Dev1 |
| `src/gateway/policy.ts` | Deterministic safety rules — SAFE_MODE triggers, recovery logic, hard constraints | Dev1 |
| `src/gateway/authentication.ts` | Credential registry — defines who can send commands, role authorization | Dev1 |
| `src/gateway/integrity.ts` | HMAC verification — tamper detection, AES-GCM decryption | Dev1 |
| `src/gateway/replay.ts` | Anti-replay state — nonce cache, sequence tracking, clock skew | Dev1 |
| `src/gateway/behavioral.ts` | Anomaly detection — behavioral patterns, risk contribution | Dev1 |
| `src/gateway/context.ts` | Mission context — eclipse, thruster, wheel rule evaluation | Dev1 |
| `src/gateway/risk.ts` | Risk engine — multi-factor scoring, severity thresholds | Dev1 |
| `src/gateway/crypto_utils.ts` | Cryptographic primitives — HMAC, AES-GCM, canonical JSON. Any change breaks signature compatibility | Dev1 |
| `src/ground_station/client.ts` | Credential holder — contains secret_key and encryption_key. MUST NOT be imported by browser code | Dev1 |
| `src/models/command.ts` | Core data contract — CommandEnvelope structure, affects all importers | Dev1 (additive only for Dev2/Dev3) |
| `src/models/audit.ts` | Audit contract — all check result structures, affects all importers | Dev1 (additive only for Dev2/Dev3) |

### Backend Core (Owner: Developer 1 — Security/Backend)

| File | Why High-Risk | Owner |
|------|---------------|-------|
| `backend/src/services/commandService.ts` | Central orchestrator — persistence transaction, gateway lifecycle, credential access, sequence management | Dev1 |
| `backend/src/services/attackService.ts` | Attack scenario execution — runs hostile envelopes through pipeline | Dev1 |
| `backend/src/services/spacecraftService.ts` | Spacecraft state management | Dev1 |
| `backend/src/services/missionService.ts` | Mission state management | Dev1 |
| `backend/src/services/securityEventService.ts` | Security event queries | Dev1 |
| `backend/src/services/sessionService.ts` | Session management | Dev1 |
| `backend/src/middleware/security.ts` | Perimeter security — trust zone enforcement, attacker blocking, origin checks | Dev1 |
| `backend/src/middleware/errorHandler.ts` | Error handling — affects all route responses | Dev1 |
| `backend/src/middleware/requestLogger.ts` | Request logging | Dev1 |
| `backend/src/app.ts` | Service wiring — connects all routes, services, middleware. Changes affect entire backend | Dev1 |
| `backend/src/config.ts` | Configuration — ports, DB path, spacecraft ID, clock skew. Affects all services | Dev1 |
| `backend/src/server.ts` | Server entry — graceful shutdown, startup errors | Dev1 |
| `backend/src/routes/*.ts` | All HTTP endpoints — request/response contracts | Dev1 |
| `backend/src/db/database.ts` | SQLite initialization, migrations, connection management | Dev1 |
| `backend/src/db/schema.sql` | Database schema — table structure | Dev1 |
| `backend/src/db/migrations/*.sql` | Schema migrations — data integrity across versions | Dev1 |
| `backend/src/db/repositories/*.ts` | Data access — all database queries | Dev1 |

### Frontend Shell (Owner: Developer 2 — Frontend/Dashboard)

| File | Why High-Risk | Owner |
|------|---------------|-------|
| `src/App.tsx` | App shell — screen routing, shared layout. Affects all screens | Dev2 |
| `src/main.tsx` | Ground entry point — renders Ground screen | Dev2 |
| `src/main.twin.tsx` | SpaceTwin entry point — renders Twin screen | Dev2 |
| `src/main.attacker.tsx` | Attacker entry point — renders Attacker screen | Dev3 (coordination with Dev2) |
| `src/index.css` | Global styles — Tailwind import, global CSS | Dev2 |

### Configuration (Owner: Developer 3 — Attacker/Demo/Integration + Dev1 for security config)

| File | Why High-Risk | Owner |
|------|---------------|-------|
| `package.json` | Dependencies, scripts — affects entire build and runtime | Dev1 + Dev2 + Dev3 (coordination) |
| `vite.config.ts` | Default Vite config — port 3000, proxy, plugins | Dev2 |
| `vite.ground.config.ts` | Ground Vite config — port 3000, proxy, Origin header for recovery | Dev2 |
| `vite.twin.config.ts` | Twin Vite config — port 3100, proxy | Dev2 |
| `vite.attacker.config.ts` | Attacker Vite config — port 3500, proxy, Origin header | Dev3 |
| `start.bat` | Service startup — port management, process launching | Dev3 |
| `stop.bat` | Service shutdown — process termination | Dev3 |
| `backend/.env` | Backend configuration — ports, DB path, spacecraft ID | Dev1 |
| `.env` | Frontend configuration — spacecraft ID, ground station, clock skew | Dev2 |

### Attacker/Demo Core (Owner: Developer 3 — Attacker/Demo/Integration)

| File | Why High-Risk | Owner |
|------|---------------|-------|
| `src/attacker/attackerClient.ts` | Browser-side attack envelope generation — affects demo flow, attack scenarios | Dev3 |
| `src/attacker/simulator.ts` | Server-side attack scenario generation — affects attack service | Dev3 (coordinate with Dev1) |
| `src/components/AttackSimulator.tsx` | Attacker UI — attack buttons, run log, standalone attacks | Dev3 |
| `src/components/AttackSimulatorPanel.tsx` | Attack panel display | Dev3 |
| `src/components/GroundConsole.tsx` | Ground UI + demo mode — operator commands, guided demo flow | Dev2 (UI) + Dev3 (demo logic) |

---

## 🟡 SHARED — Coordinate Before Changing

These files are shared across multiple domains. Changes affect multiple developers. Coordinate before modifying.

### Shared Types (Owner: Developer 1, additive changes OK for others)

| File | Notes |
|------|-------|
| `src/models/command.ts` | Command envelope contract. Additive changes (new fields) OK with coordination. Breaking changes require Dev1. |
| `src/models/audit.ts` | Audit event contract. Additive changes OK. Breaking changes require Dev1. |
| `src/models/spacecraft.ts` | Spacecraft state contract. Additive changes OK. Breaking changes require Dev1. |
| `src/models/mission.ts` | Mission state contract. Additive changes OK. Breaking changes require Dev1. |
| `src/models/attacks.ts` | Attack scenario metadata. Dev3 can update scenario descriptions. Dev1 owns gateway processing. |

### Shared Simulator (Owner: Developer 1, used by Dev2 and Dev3)

| File | Notes |
|------|-------|
| `src/spacecraft/simulator.ts` | Spacecraft simulator class. Used by gateway pipeline (backend) and frontend bundle. Dev1 owns the logic. Dev2/Dev3 can read state. |

### API Client (Owner: Developer 2, updates required when Dev1 changes routes)

| File | Notes |
|------|-------|
| `src/api/client.ts` | Typed HTTP client. Dev2 owns the client. Must be updated when Dev1 changes backend routes. Dev1 should notify Dev2 of route changes. |

### Attack Scenario Metadata (Owner: Developer 3, coordinate with Dev1 for processing)

| File | Notes |
|------|-------|
| `src/models/attacks.ts` | UI-safe attack scenario metadata. Dev3 owns the descriptions. Dev1 owns how scenarios are processed by the gateway. |

### Legacy/Status Docs (Owner: Developer 4, coordinate with team for status updates)

| File | Notes |
|------|-------|
| `README.md` | Product overview. Dev4 maintains. Team coordinates on product description. |
| `judge-todo.md` | MoSCoW backlog. Dev4 maintains. Team coordinates on priority status. |
| `focus.md` | Implementation focus. Dev4 maintains. Team coordinates on completion status. |
| `current-state.md` | Current state summary. Dev4 maintains. |
| `ST02_Project_Docs/ARCHITECTURE_AUDIT.md` | Architecture audit baseline. Dev4 created. |
| `ST02_Project_Docs/THREAT_MODEL.md` | Legacy threat model. See `docs/THREAT_MODEL.md`. Dev4 can archive. |

---

## 🟢 LOW CONFLICT — Safe to Modify Independently

These files are developer-specific or presentation-only. Safe to modify within your ownership domain without coordination.

### Developer 2 — Frontend Components (Presentation)

| File | Notes |
|------|-------|
| `src/components/SecurityStatusCards.tsx` | Status card display only |
| `src/components/ServiceTopology.tsx` | Topology visualization only |
| `src/components/BackendMonitor.tsx` | Backend status display only |
| `src/components/SessionView.tsx` | Session display only |
| `src/components/Header.tsx` | Header/navigation only |
| `src/components/OperatorShell.tsx` | Layout shell only |
| `src/components/SpacecraftTwin.tsx` | Twin visualization (display + data binding) |
| `src/components/FlightRulesView.tsx` | Flight rules display only |
| `src/components/GroundStationTerminal.tsx` | Terminal display only |
| `src/components/LiveCommandStream.tsx` | Command stream display only |
| `src/components/ExplainableIncidentPanel.tsx` | Incident display only |
| `src/components/SpacecraftTelemetry.tsx` | Telemetry display only |
| `src/components/SecurityEventLog.tsx` | Event log display only |
| `src/components/SecurityOverview.tsx` | Dashboard overview only |

### Developer 3 — Attacker/Demo

| File | Notes |
|------|-------|
| `src/components/AttackSimulator.tsx` | Attacker UI (standalone attacks, not demo mode) |
| `src/components/AttackSimulatorPanel.tsx` | Attack panel display |

### Developer 4 — Documentation

| File | Notes |
|------|-------|
| `docs/*.md` | All documentation files |
| `docs/DECISIONS/*.md` | Architectural decision records |
| `ST02_Project_Docs/*.md` | Competition-specific docs |

---

## Ownership Quick Reference

| Developer | Primary Domain | Key Files |
|-----------|---------------|-----------|
| **Dev1** | Security/Backend | `src/gateway/*`, `backend/src/services/commandService.ts`, `backend/src/middleware/security.ts`, `src/ground_station/client.ts`, `src/models/command.ts`, `src/models/audit.ts` |
| **Dev2** | Frontend/Dashboard | `src/components/*`, `src/App.tsx`, `src/api/client.ts`, `src/main.tsx`, `src/main.twin.tsx`, `vite.config.ts`, `vite.ground.config.ts`, `vite.twin.config.ts` |
| **Dev3** | Attacker/Demo/Integration | `src/attacker/*`, `src/components/AttackSimulator.tsx`, `vite.attacker.config.ts`, `start.bat`, `stop.bat` |
| **Dev4** | Docs/QA/Presentation | `docs/*`, `ST02_Project_Docs/*`, `README.md`, `judge-todo.md`, `focus.md` |

---

## Rules for Modifying High-Risk Files

1. **Identify the owner.** Check this file.
2. **Check git status.** Is someone else working on it?
3. **Understand imports/dependencies.** What else depends on this file?
4. **Make the smallest safe change.** Don't refactor while fixing.
5. **Run typecheck.** `npm run typecheck && npm run typecheck:backend`
6. **Run tests.** `npm test`
7. **Run git diff --check.**
8. **Notify the owner.** Even if you're the owner, let the team know.

If a change causes unrelated failures: **STOP and revert.** Do not keep modifying unrelated code to compensate.
