# OrbitShield — Team Workflow & Ownership

**Status:** Current as of 2026-10-06
**Audience:** Development team of 4
**Rule:** Clear ownership prevents conflicts. Read this before touching any file.

---

## 1. Four-Developer Ownership Model

### Developer 1 — Security / Backend

**Primary ownership:**
```text
backend/src/gateway/          (shared security pipeline modules)
backend/src/middleware/        (security.ts, errorHandler.ts, requestLogger.ts)
backend/src/services/command*.ts
backend/src/services/security*.ts
backend/src/services/spacecraftService.ts
backend/src/services/missionService.ts
backend/src/services/sessionService.ts
backend/src/services/attackService.ts
backend/src/spacecraft/        (simulator — shared)
backend/src/db/                (database, migrations, repositories)
src/gateway/                   (security pipeline — shared, owned by Dev1)
src/models/command.ts          (command envelope contract)
src/models/audit.ts            (audit event contract)
src/models/spacecraft.ts       (spacecraft state contract)
src/models/mission.ts          (mission state contract)
src/ground_station/client.ts   (credential holder — Node-only)
src/spacecraft/simulator.ts    (spacecraft simulator — shared)
```

**Responsibilities:**
- Authentication (key registry, credential validation)
- HMAC-SHA256 integrity verification
- AES-GCM-256 decryption
- Anti-replay protection (nonce cache, sequence tracking, timestamp freshness)
- Behavioral analysis (anomaly detection patterns)
- Mission context (eclipse, thruster, wheel rules)
- Risk engine (multi-factor scoring, severity thresholds)
- Safety policy (deterministic rules, SAFE_MODE triggers)
- SAFE_MODE activation and exit
- Recovery workflow (OPERATOR_RECOVER processing)
- Security events (audit trail persistence)
- Backend HTTP API (routes, middleware, service wiring)
- Database schema and migrations
- Backend tests (6 tests)

**Must NOT modify without understanding impact:**
- `src/gateway/gateway.ts` — pipeline orchestration (affects ALL decisions)
- `src/gateway/policy.ts` — SAFE_MODE triggers, recovery rules
- `src/gateway/authentication.ts` — credential registry
- `src/gateway/integrity.ts` — HMAC verification
- `src/gateway/replay.ts` — anti-replay state
- `backend/src/services/commandService.ts` — central orchestrator
- `backend/src/middleware/security.ts` — perimeter enforcement

---

### Developer 2 — Frontend / Security Dashboard

**Primary ownership:**
```text
src/components/               (all React components)
src/hooks/                     (if created)
src/services/                  (if created — frontend service layer)
src/utils/                     (if created — frontend utilities)
src/App.tsx                    (app shell, screen routing)
src/main.tsx                   (Ground entry point)
src/main.twin.tsx              (SpaceTwin entry point)
src/index.css                  (Tailwind styles)
src/api/client.ts              (typed HTTP client — browser-safe)
```

**Responsibilities:**
- Ground Console UI (operator command dispatch, vehicle state display, demo mode)
- SpaceTwin visualization (orbit, telemetry, security posture)
- Security dashboard (overview, status cards, event log, service topology)
- Live command stream
- Explainable incident panel
- Session view
- Backend monitor
- Operator shell (navigation, layout)
- Frontend API client (`src/api/client.ts`)
- Frontend TypeScript types (derived from backend contracts)
- Frontend build and bundle optimization

**Must NOT modify:**
- `src/gateway/*` — security pipeline logic (Dev1 owns)
- `src/ground_station/client.ts` — credential holder (Dev1 owns)
- `src/models/command.ts`, `src/models/audit.ts` — core contracts (Dev1 owns, Dev2 can add derived types)
- Backend source files (`backend/src/**/*`)
- Security algorithms (HMAC, replay, risk scoring, policy)

**Can do:**
- Add new UI components
- Modify existing component styling and layout
- Add frontend state management
- Add frontend hooks and utilities
- Update `src/api/client.ts` when backend API changes (coordinate with Dev1)
- Add derived types from backend contracts

---

### Developer 3 — Attacker / Demo / Integration

**Primary ownership:**
```text
src/attacker/                   (attacker simulator)
  ├── attackerClient.ts         (browser-side attack envelope generator)
  └── simulator.ts              (server-side attack scenario generator)
src/components/AttackSimulator.tsx       (attacker UI)
src/components/AttackSimulatorPanel.tsx  (attack panel display)
vite.attacker.config.ts         (attacker Vite config)
start.bat                       (service startup)
stop.bat                        (service shutdown)
scripts/                        (utility scripts — if created)
tests/integration/              (integration tests — if created)
tests/e2e/                      (end-to-end tests — if created)
```

**Responsibilities:**
- Attacker simulator (attack envelope generation, attack scenarios)
- Attack Simulator UI (attack buttons, attack run log, standalone attack execution)
- Demo flow (guided judge demonstration, stage verification)
- Integration testing (cross-service flows)
- End-to-end testing (full demo sequence)
- Service startup/shutdown scripts
- Port management and collision detection
- Attack scenario definitions (coordinate with Dev1 on gateway processing)

**Must NOT modify without Dev1 agreement:**
- Security algorithms (HMAC, replay, risk scoring, policy)
- Credential material or registry
- Gateway pipeline modules (`src/gateway/*`)
- Backend routes or middleware

**Can do:**
- Add new attack scenarios (uses existing gateway pipeline)
- Modify attackerClient.ts (browser-side generation logic)
- Modify simulator.ts (server-side scenario generation — coordinate with Dev1)
- Update demo flow and stage verification logic
- Add integration/e2e tests
- Modify startup scripts and port configuration

---

### Developer 4 — Documentation / QA / Presentation

**Primary ownership:**
```text
docs/                          (all documentation)
  ├── README.md
  ├── ARCHITECTURE.md
  ├── SECURITY_ARCHITECTURE.md
  ├── API_CONTRACTS.md
  ├── THREAT_MODEL.md
  ├── DEMO_RUNBOOK.md
  ├── DEVELOPMENT.md
  ├── TESTING.md
  ├── TEAM_WORKFLOW.md          (this file)
  ├── CODE_OWNERSHIP.md
  └── DECISIONS/                (ADRs)
      ├── ADR-001-service-boundaries.md
      ├── ADR-002-security-gateway.md
      ├── ADR-003-attacker-boundary.md
      └── ADR-004-database-boundary.md
ST02_Project_Docs/             (competition-specific docs)
README.md                      (product overview — coordinate with Dev4)
judge-todo.md                  (backlog — coordinate with team)
focus.md                       (implementation focus — coordinate with team)
```

**Responsibilities:**
- Architecture documentation (ARCHITECTURE.md, SECURITY_ARCHITECTURE.md)
- API documentation (API_CONTRACTS.md — update when routes change)
- Threat model (THREAT_MODEL.md — update when threats/defenses change)
- Demo runbook (DEMO_RUNBOOK.md — update when demo flow changes)
- Developer documentation (DEVELOPMENT.md — update when setup changes)
- Testing documentation (TESTING.md — update when tests change)
- Team workflow and ownership docs (TEAM_WORKFLOW.md, CODE_OWNERSHIP.md)
- Architectural Decision Records (docs/DECISIONS/*.md)
- Competition documentation (ST02_Project_Docs/*)
- README.md (coordinate with team — product overview)
- QA checklist and verification procedures
- Troubleshooting documentation
- Final presentation material

**Must NOT modify without justification:**
- Implementation files (src/**, backend/src/**)
- Configuration files (package.json, vite configs) — except documentation references
- Test files — except documentation references

**Can do:**
- Update documentation to reflect implementation changes
- Fix documentation errors and omissions
- Add new documentation files
- Update README.md product overview (coordinate with team)
- Update judge-todo.md and focus.md status (coordinate with team)
- Create ADRs for architectural decisions

---

## 2. Ownership Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                     SHARED (coordinate)                      │
│  src/models/*  (contracts — additive only)                  │
│  src/spacecraft/simulator.ts  (simulator — shared)          │
│  src/gateway/*  (security pipeline — Dev1 owns)             │
└─────────────────────────────────────────────────────────────┘
         ↓                         ↓                          ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  Dev1: Security  │  │  Dev2: Frontend  │  │  Dev3: Attacker/Demo │
│  Backend         │  │  Dashboard       │  │  Integration         │
│                  │  │                  │  │                      │
│  backend/src/    │  │  src/components/ │  │  src/attacker/       │
│  src/gateway/    │  │  src/api/client  │  │  vite.attacker.config │
│  src/ground_stn/ │  │  src/App.tsx     │  │  start.bat/stop.bat  │
│  src/models/     │  │  src/main*.tsx   │  │  scripts/            │
│  src/spacecraft/ │  │                  │  │  tests/integration/  │
│                  │  │                  │  │  tests/e2e/          │
└──────────────────┘  └──────────────────┘  └──────────────────────┘
                                                  ↓
                                        ┌──────────────────────┐
                                        │  Dev4: Docs/QA       │
                                        │  Presentation        │
                                        │                      │
                                        │  docs/               │
                                        │  ST02_Project_Docs/  │
                                        │  README.md           │
                                        │  judge-todo.md       │
                                        │  focus.md            │
                                        └──────────────────────┘
```

---

## 3. Cross-Domain Collaboration

### Dev1 + Dev2: API Contract Changes

When Dev1 changes a backend route (request/response format):
1. Dev1 updates the route handler
2. Dev1 updates `backend/src/services/*` if needed
3. Dev1 notifies Dev2
4. Dev2 updates `src/api/client.ts` to match new contract
5. Dev2 updates components that use the changed endpoint

### Dev1 + Dev3: Attack Scenario Changes

When Dev3 adds a new attack scenario:
1. Dev3 defines the attack envelope structure
2. Dev3 implements generation in `attackerClient.ts` (browser) and/or `simulator.ts` (server)
3. Dev1 verifies the attack flows through the pipeline correctly
4. Dev1 may need to adjust risk scoring or policy rules
5. Dev3 updates demo flow if needed

### Dev2 + Dev3: Demo Flow

The demo mode lives in `GroundConsole.tsx` (Dev2's component) but is owned by Dev3's domain (demo/integration). Coordination:
- Dev3 defines the demo stages and verification criteria
- Dev2 implements the UI in GroundConsole.tsx
- Dev3 verifies the demo flow end-to-end
- Changes to demo stages require both Dev2 (UI) and Dev3 (verification logic)

### Dev4 + Everyone: Documentation Updates

When any developer makes implementation changes:
1. Developer makes the code change
2. Developer notifies Dev4 of what changed
3. Dev4 updates relevant documentation
4. Dev4 commits documentation changes

---

## 4. File Ownership Classification

See `docs/CODE_OWNERSHIP.md` for the complete file-by-file classification.

### Quick Reference

| Classification | Meaning | Action |
|---------------|---------|--------|
| 🔴 HIGH RISK | Do not modify without owner | Find owner, submit request/patch |
| 🟡 SHARED | Coordinate before changing | Talk to affected developers |
| 🟢 LOW CONFLICT | Safe to modify independently | Just go ahead (within your domain) |

---

## 5. Architectural Rules

### Rule 1 — No Blind Refactors

Do not refactor a file simply because it "looks messy." First prove the refactor provides value:
- Does it improve correctness?
- Does it improve testability?
- Does it reduce conflict risk?
- Does it clarify ownership?

If the answer is "no" to all of these, leave it alone.

### Rule 2 — Preserve Public Contracts

Do not silently change:
- API paths (`/api/commands`, `/api/spacecraft/SAT-01/recovery`, etc.)
- Request formats (JSON structure)
- Response formats (JSON structure)
- Ports (3000, 3100, 3500, 4000)
- Service names (Ground, SpaceTwin, Attacker, Backend)
- Environment variable names (PORT, DATABASE_PATH, SPACECRAFT_ID, etc.)

If you must change a contract:
1. Update the implementation
2. Update `docs/API_CONTRACTS.md`
3. Update `src/api/client.ts` (frontend client)
4. Update tests
5. Notify affected developers

### Rule 3 — Prefer Additive Changes

Instead of rewriting:
```typescript
// ❌ Don't do this
function processCommand(envelope) { ... massive rewrite ... }
```

Prefer adding:
```typescript
// ✅ Do this
function processCommand(envelope) { ... existing logic ... }
function processCommandWithNewCheck(envelope) { ... new behavior ... }
```

When practical, keep existing functions working and add new ones. Deprecate old ones gradually.

### Rule 4 — One Owner Per Critical Subsystem

No shared ownership ambiguity. For each critical subsystem, exactly one developer is the primary owner:
- Security pipeline → Dev1
- Frontend UI → Dev2
- Attacker/demo → Dev3
- Documentation → Dev4

Others can submit patches, but the owner reviews and merges.

### Rule 5 — No Cross-Domain Edits

A developer should not modify another developer's subsystem casually.

| From | To | Allowed? |
|------|----|----------|
| Dev2 | Dev1 (gateway) | ❌ No — submit issue/request |
| Dev3 | Dev1 (credentials) | ❌ No — submit issue/request |
| Dev4 | Dev1/Dev2/Dev3 (code) | ❌ No — only documentation |
| Dev1 | Dev2 (components) | ❌ No — unless bug fix needed, coordinate |
| Dev1 | Dev3 (attacker) | ⚠️ Only security-related changes, coordinate |
| Dev2 | Dev3 (demo UI) | ⚠️ Only if co-owned (GroundConsole demo mode) |

### Rule 6 — Test Before and After Refactoring

Before:
```bash
npm test
npm run typecheck && npm run typecheck:backend
```

After (same checks):
```bash
npm test
npm run typecheck && npm run typecheck:backend
```

If tests fail after a refactor, the refactor introduced a regression. Fix it or revert it.

### Rule 7 — Small Commits

Use commits like:
```
docs: add security architecture
refactor: isolate attacker client sequence sync
fix: persist security event for blocked attacker requests
ui: improve security timeline display
test: add replay integration test
feat: add credential compromise behavioral pattern
```

Avoid:
```
BIG FINAL CHANGES
everything fixes
major update
```

### Rule 8 — Never Mix Refactor + Feature + Styling in One Commit

One commit = one purpose.

| Commit | Purpose |
|--------|---------|
| `refactor: ...` | Code structure change, no behavior change |
| `fix: ...` | Bug fix, behavior correction |
| `feat: ...` | New feature or capability |
| `docs: ...` | Documentation only |
| `test: ...` | Test addition or update |
| `ui: ...` | Styling or presentation change |
| `chore: ...` | Build, config, dependency changes |

If you have a refactor AND a feature, make two commits:
1. `refactor: extract envelope validation logic`
2. `feat: add credential compromise behavioral detection`

---

## 6. Collaboration Workflow

### Before Starting Work

1. Read `docs/CODE_OWNERSHIP.md` to confirm file ownership
2. Check `git status` — is someone else modifying the file?
3. Check recent commits — what changed recently?
4. Understand imports and dependencies
5. Identify your owner (if changing shared code)

### During Work

1. Make the smallest safe change
2. Stay within your ownership domain
3. If you must touch another domain, coordinate first
4. Run typecheck periodically

### Before Committing

1. Run `npm test`
2. Run `npm run typecheck && npm run typecheck:backend`
3. Run `git diff --check`
4. Verify no credential material leaks to browser bundle
5. Write a conventional commit message

### After Committing

1. Push (if using remote)
2. Notify affected developers if you changed shared contracts
3. Update documentation if needed (Dev4)

---

## 7. Conflict Resolution

If two developers need to modify the same file:

1. **Talk first.** The owner has priority.
2. **Submit a patch.** Non-owners submit their change as a patch/PR for the owner to review.
3. **Split the change.** If possible, move the change to a file the developer owns.
4. **Escalate.** If there's genuine ambiguity, the team decides together.

---

## 8. Emergency Changes

If an emergency requires modifying a high-risk file owned by someone else:

1. Inform the owner immediately (before or immediately after the change)
2. Explain why the change was urgent
3. Document the change and rationale
4. The owner reviews and either accepts or reverts

Emergency changes are exceptions, not the norm.
