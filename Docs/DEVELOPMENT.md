# OrbitShield — Developer Documentation

**Status:** Current as of 2026-10-06
**Audience:** Developers working on the OrbitShield repository

---

## 1. Prerequisites

- **Node.js:** Version 22+ (package.json specifies `@types/node: ^22.0.0`, vitest 2.1.8, tailwindcss 4.0.0)
- **npm:** Any recent version
- **Operating System:** Windows (start.bat/stop.bat) or Unix (manual startup)
- **Git:** For version control

No additional runtime dependencies (Redis, Docker, PostgreSQL, etc.) are required. The system is fully local.

---

## 2. Repository Structure

```
OrbitShield/
├── README.md                      # Product overview, architecture, API table
├── judge-todo.md                  # MoSCoW backlog, 18 must-have items
├── focus.md                       # Implementation focus, P0 status
├── package.json                   # Root dependencies + scripts
├── start.bat / stop.bat           # Windows service management
├── docs/                          # Documentation (see docs/README.md)
│   ├── ARCHITECTURE.md
│   ├── SECURITY_ARCHITECTURE.md
│   ├── API_CONTRACTS.md
│   ├── THREAT_MODEL.md
│   ├── DEMO_RUNBOOK.md
│   ├── DEVELOPMENT.md             # This file
│   ├── TESTING.md
│   ├── TEAM_WORKFLOW.md
│   ├── CODE_OWNERSHIP.md
│   └── DECISIONS/                 # Architectural Decision Records
│       ├── ADR-001-service-boundaries.md
│       ├── ADR-002-security-gateway.md
│       ├── ADR-003-attacker-boundary.md
│       └── ADR-004-database-boundary.md
├── ST02_Project_Docs/            # Competition-specific docs
│   ├── ARCHITECTURE_AUDIT.md
│   └── THREAT_MODEL.md           # Legacy — see docs/THREAT_MODEL.md
├── src/                          # Frontend source (shared across all Vite configs)
│   ├── main.tsx                  # Ground entry (port 3000)
│   ├── main.twin.tsx             # SpaceTwin entry (port 3100)
│   ├── main.attacker.tsx         # Attacker entry (port 3500)
│   ├── App.tsx                   # Shared app shell
│   ├── index.css                 # Tailwind import
│   ├── api/client.ts             # Typed HTTP client (browser-safe)
│   ├── components/               # React components
│   ├── gateway/                  # ⚠️ Security pipeline (shared, imported by backend too)
│   ├── attacker/                 # Attacker simulator (browser-side)
│   ├── ground_station/           # ⚠️ Node-only credential holder
│   ├── models/                   # Shared types
│   ├── spacecraft/               # Spacecraft simulator (shared)
│   └── tests/                    # Gateway pipeline tests (10 tests)
├── backend/                      # Backend source (Express + SQLite)
│   ├── src/
│   │   ├── server.ts             # Express server entry
│   │   ├── app.ts                # createApp() — service wiring
│   │   ├── config.ts             # Environment config
│   │   ├── middleware/           # security.ts, errorHandler.ts, requestLogger.ts
│   │   ├── routes/               # All HTTP endpoints
│   │   ├── services/             # commandService, attackService, etc.
│   │   ├── db/                   # SQLite, migrations, repositories
│   │   └── tests/                # Backend HTTP tests (6 tests)
│   └── package.json              # Backend dependencies
└── data/                         # SQLite database (created at runtime)
    └── orbitshield.db
```

---

## 3. Installation

```bash
# Install all dependencies (frontend + backend)
npm install
npm --prefix backend install
```

This installs:
- **Root:** React, Vite, TailwindCSS, vitest, lucide-react, concurrently
- **Backend:** Express, better-sqlite3, dotenv

---

## 4. Startup

### All Services (Recommended for Demo)

```bash
npm run dev:demo
```

Starts 4 concurrent processes:
- Ground Console: http://localhost:3000
- SpaceTwin: http://localhost:3100
- Attacker Simulator: http://localhost:3500
- Backend: http://127.0.0.1:4000

### Individual Services

```bash
npm run dev:backend    # Backend only (:4000)
npm run dev:frontend   # Ground only (:3000)
npm run dev:twin       # Twin only (:3100)
npm run dev:attacker   # Attacker only (:3500)
```

### Combined (Backend + Ground)

```bash
npm run dev
```

### Windows Service Scripts

```bash
start.bat   # Starts all services with port collision detection
stop.bat    # Stops all services
```

### Verifying Startup

```bash
# Check all ports respond
curl -s http://127.0.0.1:4000/api/health
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/
curl -s -o /dev/null -w "%{http_code}" http://localhost:3500/
```

Expected: 200 on all four.

---

## 5. Stopping

### Manual

Press `Ctrl+C` in each terminal window, or:

```bash
# Kill all node processes (careful — kills ALL node processes)
pkill -f node
```

### Windows

```bash
stop.bat
```

---

## 6. Test Commands

```bash
# Run all test suites (gateway + backend)
npm test

# Gateway pipeline tests only (10 tests — TRD Section 14)
npm run test:gateway

# Backend HTTP tests only (6 tests)
npm run test:backend
```

### Test Files

| Suite | Command | File | Tests |
|-------|---------|------|-------|
| Gateway pipeline | `npm run test:gateway` | `src/tests/gateway.test.ts` | 10 |
| Backend HTTP | `npm run test:backend` | `backend/src/tests/backend.test.ts` | 6 |

### What the Gateway Tests Cover

1. Valid command passes all checks and executes
2. Modified payload fails integrity check and is blocked
3. Unknown/rogue credential fails authentication and is blocked
4. Replayed nonce/sequence fails replay check and is blocked
5. Malformed command is gracefully rejected at parser boundary
6. High-risk dangerous command violating mission constraints is blocked
7. Critical attack scenario triggers autonomous SAFE_MODE transition
8. Essential telemetry queries remain operational in SAFE_MODE
9. Deterministic policy engine overrides advisory behavioral layer
10. Complete explainable audit record contains all required forensic fields

### What the Backend Tests Cover

1. Onboarding creates a spacecraft entity + active session
2. GET /api/sessions returns all sessions plus the active one
3. POST /api/sessions/:id/activate switches the active session
4. GET /api/spacecraft returns the current active spacecraft
5. GET /api/spacecraft/:id/twin returns a valid deterministic visualization payload
6. Existing SAT-01 demo behavior is unchanged

---

## 7. TypeScript Checks

```bash
# Frontend typecheck
npm run typecheck

# Backend typecheck
npm run typecheck:backend
```

Or run both:

```bash
npm run typecheck && npm run typecheck:backend
```

---

## 8. Build

```bash
# Frontend build (typecheck + Vite build → dist/)
npm run build

# Twin build
npm run build:twin

# Attacker build
npm run build:attacker
```

The build process includes a check that verifies no credential material leaks to the frontend bundle.

---

## 9. Port Requirements

| Port | Service | Protocol | Accessible From |
|------|---------|----------|-----------------|
| 3000 | Ground Console | HTTP (Vite) | Browser |
| 3100 | SpaceTwin | HTTP (Vite) | Browser |
| 3500 | Attacker Simulator | HTTP (Vite) | Browser |
| 4000 | Backend / Gateway | HTTP (Express) | Browser (via proxy), other services |

### Port Conflicts

If a port is already in use:

**Windows:**
```bash
# Find process using port
netstat -ano | findstr :3000

# Kill by PID
taskkill /PID <pid> /F
```

**Unix:**
```bash
lsof -i :3000
kill -9 <pid>
```

`start.bat` includes port collision detection and will warn if ports are in use.

---

## 10. Environment Variables

### Root `.env` (frontend — non-sensitive)

See `.env.example`:
```env
VITE_SPACECRAFT_ID=SAT-01
VITE_DEFAULT_GROUND_STATION=GS-PRIMARY-01
VITE_MAX_CLOCK_SKEW_SECONDS=60
```

These are Vite environment variables (prefixed with `VITE_`) and are embedded in the frontend bundle. They are non-sensitive configuration only.

### Backend `.env` (server configuration — non-sensitive)

See `backend/.env.example`:
```env
PORT=4000
HOST=127.0.0.1
DATABASE_PATH=data/orbitshield.db
SPACECRAFT_ID=SAT-01
MAX_CLOCK_SKEW_SECONDS=60
```

These configure the backend server. No credentials are stored in `.env` files — all credential material is in code (simulated demo credentials).

### No Real Secrets

All credentials in this repository are simulated demo credentials for the hackathon (TRD Section 5). The credential registry is defined in `src/gateway/authentication.ts`:
- `GS-PRIMARY-01`: `orbitshield-svalbard-primary-sign-key-demo-2026`
- `GS-BACKUP-02`: `orbitshield-santiago-backup-sign-key-demo-2026`
- `GS-PAYLOAD-03`: `orbitshield-toulouse-payload-sign-key-demo-2026`

---

## 11. Common Failures

### Port Already in Use

**Symptom:** `EADDRINUSE: address already in use 127.0.0.1:4000`

**Fix:**
1. Run `stop.bat` or kill the process on the conflicting port
2. Or change the port via environment variable: `PORT=4001 npm run dev:backend`

### Database Cannot Be Opened

**Symptom:** `FATAL: OrbitShield backend failed to initialize. Most likely cause: SQLite database could not be opened`

**Fix:**
1. Check `backend/data/` directory exists and is writable
2. Check `DATABASE_PATH` in `backend/.env` points to a valid location
3. Delete `backend/data/orbitshield.db` to reset (loss of all persisted data)

### Frontend Can't Reach Backend

**Symptom:** Fetch errors in browser console, 404 or connection refused

**Fix:**
1. Verify backend is running on port 4000
2. Check Vite proxy configuration in the relevant `vite.*.config.ts`
3. Verify CORS headers in backend response

### Attacker Can't Launch Attacks

**Symptom:** Attacks fail to send from port 3500

**Fix:**
1. Verify `vite.attacker.config.ts` has the `/api` proxy to `http://127.0.0.1:4000`
2. Check that `security.ts` middleware allows `/api/commands` from untrusted origins
3. Check browser console for CORS or fetch errors

### SAFE_MODE Doesn't Trigger

**Symptom:** Credential compromise attack doesn't trigger SAFE_MODE

**Fix:**
1. Verify mission phase is `UMBRA_ECLIPSE` (not `FULL_SUN_IMAGING`)
2. Check that the attack uses valid GS-PRIMARY-01 credentials with correct HMAC
3. Verify risk score reaches >= 75 (check audit event risk.total_score)
4. Check behavioral module detects the anomaly pattern

### Recovery Fails

**Symptom:** OPERATOR_RECOVER returns BLOCK instead of ALLOW

**Fix:**
1. Verify request includes `Origin: http://localhost:3000` header (trusted zone)
2. Check recovery token matches `GROUND-SECURE-RECOVERY-CHANNEL`
3. Check clearance_level is `FLIGHT_DIRECTOR`
4. Verify spacecraft is actually in SAFE_MODE (battery >= 40%)
5. Check replay sequence — recovery envelope must have fresh nonce + valid sequence

### Tests Fail After Refactoring

**Symptom:** `npm test` shows failures

**Fix:**
1. Run typecheck: `npm run typecheck && npm run typecheck:backend`
2. Check import paths — especially `src/gateway/` imports from backend (`../../../src/gateway/`)
3. Check that `src/ground_station/client.ts` is not imported by browser code
4. Revert the refactor if failures are unrelated to the change

---

## 12. Development Workflow

1. **Before changes:** Run `npm test` and `npm run typecheck && npm run typecheck:backend`
2. **Make changes:** Stay within your ownership domain (see `docs/TEAM_WORKFLOW.md`)
3. **After changes:** Run `npm test` and `npm run typecheck && npm run typecheck:backend`
4. **Before commit:** Run `git diff --check`
5. **Commit:** Use conventional commit format (see `docs/TEAM_WORKFLOW.md`)

### Critical: Test Before AND After

```bash
# Before
npm test
npm run typecheck && npm run typecheck:backend

# Make your changes...

# After
npm test
npm run typecheck && npm run typecheck:backend
git diff --check
```

If a refactor causes unrelated failures: **STOP and revert.** Do not keep modifying unrelated code to compensate.

---

## 13. Import Rules

### Do
```typescript
// Frontend components import from api/client.ts
import { orbitShieldApi } from '../api/client';

// Shared types from models/
import { CommandEnvelope } from '../models/command';

// Gateway modules (shared, used by both frontend bundle and backend)
import { canonicalJsonStringify } from '../gateway/crypto_utils';
```

### Don't
```typescript
// ❌ Browser components must NOT import credential holder
import { GroundStationClient } from '../ground_station/client';  // NEVER in src/components/

// ❌ Backend should not import React components
import { GroundConsole } from '../components/GroundConsole';  // NEVER in backend/

// ❌ No circular dependencies between components
import { ComponentA } from './ComponentA';  // ComponentA imports ComponentB
import { ComponentB } from './ComponentB';  // ComponentB imports ComponentA
```

---

## 14. Build-Time Credential Check

The build process verifies that no credential material leaks to the frontend bundle. This is a safety net — the primary defense is the import rule above.

If you add code that imports `src/ground_station/client.ts` from browser-accessible code, the build check should catch it. If it doesn't, the credential would be bundled into the frontend and exposed.

**Always verify:** After adding any import, check that `src/ground_station/client.ts` is only imported by:
- `backend/src/services/commandService.ts` (server-side)
- `src/tests/gateway.test.ts` (test code, Node runtime)
- `src/attacker/simulator.ts` (server-side attack generator, Node runtime)
