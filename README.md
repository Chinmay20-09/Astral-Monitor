# OrbitShield (ST-02)

Cyber Attack Detection & Safe-Command Gateway for Satellite Ground Stations

OrbitShield is a security control plane and modular gateway positioned between satellite ground stations and spacecraft flight software. It validates structured command traffic, detects suspicious behavior, halts replay and tampering attacks, and places the spacecraft into a protected safe mode for high-confidence threats while maintaining essential telemetry carrier downlinks.

> **Local simulation only.** OrbitShield is a controlled, fully local spacecraft-security
> simulation for research/demonstration (hackathon ST-02). It contains no real satellite
> integrations, no cloud infrastructure, and no real credentials. It is **not** production
> security software.

---

## Architecture Overview

OrbitShield runs as a **local two-process system with a real service boundary**:

```text
BROWSER (operator console)                LOCAL BACKEND (enforcement point)
┌────────────────────────────┐            ┌────────────────────────────────────────┐
│  React dashboard           │            │  Node.js + Express (backend/)          │
│  - command terminal        │  HTTP API  │                                        │
│  - telemetry / flight rules│ ─────────► │  Command Service                       │
│  - live command stream     │            │    ├─ envelope origination (per key)   │
│  - incident inspector      │            │    ├─ credential registry (secrets!)   │
│  - attack simulator panel  │            │    └─ ▼ SECURITY GATEWAY PIPELINE ▼    │
│                            │            │   1. Receive & structured parse        │
│  Sends command INTENTS and │            │   2. Authentication (key registry)     │
│  attack scenario INTENTS.  │            │   3. HMAC-SHA256 integrity tag         │
│  It holds NO keys, does NO │            │      + AES-GCM authenticated decrypt   │
│  signing, and sees NO      │            │   4. Replay (per spacecraft+key scope) │
│  credential material.      │            │   5. Behavioral sequence analysis      │
│                            │            │   6. Mission context / flight rules    │
│                            │            │   7. Contextual risk engine (0–100)    │
│                            │            │   8. Deterministic safety policy       │
│                            │            │   9. Response dispatch                 │
│                            │            │  10. Explainable audit → SQLite        │
└────────────────────────────┘            └───────────────┬────────────────────────┘
                                                          │
                                          SQLITE (backend/data/orbitshield.db)
                                          commands · security_events (full evidence)
                                          spacecraft_state · mission_state
                                          ground_stations · replay_state
```

**Security boundary (the important part):**

- The **backend owns the authoritative credential registry**, credential lookup, HMAC
  signing, AES-GCM encryption/decryption, replay state, the full security pipeline, and
  audit persistence.
- The browser is a pure **operator console**: it sends command *intents*
  (`POST /api/commands/operator`) and attack scenario *intents* (`POST /api/attacks`).
  The production frontend bundle contains **no secret material** (verified by build check).
- Every decision + its audit record + replay state + vehicle state are persisted in **one
  SQLite transaction** — a persistence failure surfaces as HTTP 503 and never silently
  converts a decision into a success.
- Replay protection is tracked **per (spacecraft_id, key_id)** and is rehydrated from
  SQLite at startup, so a command replayed across a server restart is still rejected.

The gateway pipeline modules (`src/gateway/*`) are unchanged domain logic — they run
inside the backend via `CommandService`.

---

## Threat Model & Supported Attack Scenarios

| Attack Vector | Attacker Action | Gateway Defense Mechanism | Result |
| --- | --- | --- | --- |
| **In-Transit Tampering** | Modifies payload parameters (e.g. injects illegal thruster burn) without the key | HMAC-SHA256 integrity/authentication tag over canonical envelope | **BLOCK** |
| **Unauthorized Injection** | Injects command signed with rogue key ID (`ATTACKER-ROGUE-GS`) | Key Registry Authentication & Role Clearance Check | **BLOCK** |
| **Replay Attack** | Replays captured valid command with stale sequence and used nonce | Bounded nonce cache + per-sender monotonic sequence + 60s skew window | **BLOCK** |
| **Compromised Credentials** | Attacker has authentic key, but issues imaging command during eclipse | Behavioral Sequence Analysis + Mission Rule OPT-02 Resolver | **BLOCK / SAFE MODE** |
| **Destructive Orbit Burn** | Attacker commands 6.2 m/s burn with authentic key | Contextual Risk Engine (Score >= 75) + Deterministic Safety Policy | **AUTONOMOUS SAFE MODE** |
| **Passive Eavesdropping** | Attacker sniffs downlink/uplink channel | AES-GCM-256 transport encryption (ciphertext authoritative; server-side authenticated decryption) | Confidentiality Maintained |

Anti-replay state only advances for cryptographically verified commands, so unauthenticated
traffic cannot poison the sequence stream.

---

## Multi-Stage Hackathon Demonstration (PRD Section 5)

Click **"Run 5-Stage Live Attack Demo"** in the Attack Simulator to execute:

1. **Normal Operation:** Routine telemetry query processed and acknowledged.
2. **Interception & Tampering:** Attacker modifies payload; blocked by HMAC integrity.
3. **Rogue Injection:** Attacker introduces unauthorized key; blocked by authentication.
4. **Credential Compromise:** Attacker uses legitimate key during orbital eclipse; detected by mission context rules.
5. **Critical Escalation:** Hazardous thruster fire triggers Autonomous Safe Mode; dangerous commands locked; essential telemetry preserved.

Every stage is executed by the backend pipeline and persisted — refresh the browser or
restart the backend and the full audit trail, vehicle state (including SAFE_MODE) and
replay history remain.

---

## Running the Application

### 1. Install Dependencies (frontend + backend)

```bash
npm install
npm --prefix backend install
```

### 2. Database Initialization

Nothing to do manually: on first backend start, migrations in
`backend/src/db/migrations/` are applied automatically to
`backend/data/orbitshield.db` (created if missing; WAL mode).

### 3. Run Everything (backend + frontend)

```bash
npm run dev
```

Or individually:

```bash
npm run dev:backend   # security gateway API on http://127.0.0.1:4000
npm run dev:frontend  # dashboard on http://localhost:3000 (proxies /api → :4000)
```

### 4. Tests

```bash
npm test             # all suites: gateway pipeline (10) + backend HTTP (17)
npm run test:gateway # original TRD Section 14 gateway suite
npm run test:backend # backend API/persistence/secret-boundary suite
```

### 5. TypeScript Checks

```bash
npm run typecheck          # frontend
npm run typecheck:backend  # backend
```

### 6. Production Build

```bash
npm run build   # typecheck + vite build → dist/
```

---

## Backend HTTP API (local only)

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Liveness + persistence statistics |
| `/api/commands` | POST | Run a raw (possibly hostile) command envelope through the full pipeline |
| `/api/commands/operator` | POST | **Operator console:** send a command intent; backend signs/encrypts server-side |
| `/api/commands` | GET | Recently processed commands (persisted trail, bounded limit) |
| `/api/commands/next-sequence` | GET | Monotonic sequence sync (per `key_id` or global) |
| `/api/attacks` | POST | Controlled local attack simulation: `TAMPERING`, `INJECTION`, `REPLAY`, `CREDENTIAL_COMPROMISE`, `DESTRUCTIVE_BURN`, `EAVESDROP` |
| `/api/security-events` | GET | Filterable explainable audit trail (bounded limit) |
| `/api/security-events/:eventId` | GET | One complete security event with all evidence |
| `/api/spacecraft` | GET | Current vehicle state + essential telemetry |
| `/api/spacecraft/:spacecraftId` | GET | Same, for a specific vehicle id |
| `/api/spacecraft/:spacecraftId/recovery` | POST | Operator recovery from SAFE_MODE (through the full pipeline) |
| `/api/spacecraft/tick` | POST | Advance the physics simulation (eclipse-aware) |
| `/api/spacecraft/reset` | POST | Operator full session reset (vehicle, mission, audit) |
| `/api/mission` | GET | Structured mission state (phases, constraints, documents) |
| `/api/mission/:spacecraftId` | GET | Same, for a specific vehicle id |
| `/api/mission/phase` | POST | Switch the active orbital phase (persisted) |
| `/api/ground-stations` | GET | Sanitized registry snapshot (metadata only — no keys) |

Configuration lives in `backend/.env` (see `backend/.env.example`):
`PORT`, `HOST`, `DATABASE_PATH`, `SPACECRAFT_ID`, `MAX_CLOCK_SKEW_SECONDS`.

---

## Cryptography (honest terminology)

- **Integrity & authentication:** HMAC-SHA256 authentication tag over the canonical JSON
  envelope, computed/verified with standard Web Crypto (`SubtleCrypto`). This is a
  *symmetric MAC* — OrbitShield does **not** claim asymmetric digital signatures.
- **Confidentiality:** AES-GCM-256. When a command is marked encrypted, the plaintext
  parameters exist **only** as ciphertext on the wire (the payload carries a redacted
  marker), the ciphertext is bound into the HMAC tag, and the backend validates
  authenticated encryption with the server-side credential before plaintext parameters
  enter the security/policy path.
- **Replay protection:** random 128-bit nonce (bounded cache) + per-sender monotonic
  sequence + timestamp skew window.
- Keys are **simulated local demo credentials** for the hackathon (TRD Section 5) and
  live only in the backend process (`src/gateway/authentication.ts`, imported exclusively
  by backend/test code). Never commit real secrets.

---

## Environment Variables

See `.env.example` (frontend, non-sensitive):

- `VITE_SPACECRAFT_ID`: Target spacecraft identifier (default: `SAT-01`)
- `VITE_DEFAULT_GROUND_STATION`: Default uplink station (default: `GS-PRIMARY-01`)
- `VITE_MAX_CLOCK_SKEW_SECONDS`: Maximum clock tolerance (default: `60`)

And `backend/.env.example` (server configuration only — no credentials):
`PORT`, `HOST`, `DATABASE_PATH`, `SPACECRAFT_ID`, `MAX_CLOCK_SKEW_SECONDS`.
