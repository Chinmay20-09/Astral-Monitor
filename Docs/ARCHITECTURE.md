# ST-02 — System Architecture

## 1. High-Level Diagram

```text
                     GROUND STATION
                    Legitimate Client
                           |
                           | encrypted + signed
                           v
                +------------------------+
                |    SECURITY GATEWAY    |
                |                        |
                | Integrity              |
                | Authentication         |
                | Replay Protection      |
                | Behavioral AI           |
                | Mission Context        |
                | Risk Engine             |
                | Safety Policy           |
                | Response Engine        |
                | Audit Logger            |
                +-----------+------------+
                            |
                    ALLOW / BLOCK / SAFE
                            |
                            v
                   +----------------+
                   |   SPACECRAFT   |
                   |   SIMULATOR    |
                   +----------------+

                   +----------------+
                   | ATTACK          |
                   | SIMULATOR       |
                   +--------+--------+
                            |
                            +-----> SECURITY GATEWAY
```

## 2. Trust Boundaries

Boundary 1: Ground Station → Gateway

- Assume network may be observed or manipulated.

Boundary 2: Gateway → Spacecraft

- Gateway is the enforcement point.

Boundary 3: AI/Context → Risk Engine

- AI is untrusted advisory evidence.

Boundary 4: Attack Simulator → Gateway

- Treat all simulator traffic as hostile test traffic.

## 3. Enforcement Principle

Only the Response/Safety Policy layer can authorize execution.

AI output:

```text
evidence + anomaly assessment + explanation
```

Policy output:

```text
ALLOW / BLOCK / SAFE_MODE
```

## 4. Modular Dependency Direction

Preferred:

```text
models
  ↓
security modules
  ↓
analysis modules
  ↓
risk/policy
  ↓
response
  ↓
interfaces/adapters
```

Avoid circular dependencies.

## 5. Future Event-Driven Evolution

MVP:

```text
Module A → Module B → Module C
```

Future:

```text
Module A → SecurityEventBus
Module B → SecurityEventBus
Module C → SecurityEventBus
```

Do not implement an event bus merely for appearance during MVP.

## 6. Suggested Repository Structure

```text
st02/
├── README.md
├── docs/
│   ├── PRD.md
│   ├── TRD.md
│   ├── ARCHITECTURE.md
│   ├── THREAT_MODEL.md
│   ├── ROADMAP.md
│   └── AGENT_RULES.md
│
├── src/
│   ├── models/
│   ├── gateway/
│   │   ├── integrity.py
│   │   ├── authentication.py
│   │   ├── replay.py
│   │   ├── behavioral.py
│   │   ├── context.py
│   │   ├── risk.py
│   │   ├── policy.py
│   │   └── response.py
│   ├── spacecraft/
│   ├── ground_station/
│   ├── attacker/
│   └── audit/
│
├── mission/
├── tests/
└── config/
```

The stack is intentionally not locked by this document. Agents may recommend implementation technologies, but they MUST preserve the architecture and requirements.

---

## 7. Addendum: Local Backend + Persistent Storage (Implemented)

The gateway pipeline was previously hosted entirely in the browser. It now runs in a
local Node.js/Express backend (`backend/`) with SQLite persistence via `better-sqlite3`.
This is a deployment, durability, and trust-boundary change — the security pipeline
modules, their order, and their responsibilities are unchanged.

### What moved where

- `backend/` hosts `src/gateway/*`, `src/spacecraft/*`, and `src/models/*` at runtime
  (imported directly, unmodified).
- The browser dashboard is a pure **operator console**: it sends command *intents*
  (`POST /api/commands/operator`) and attack scenario *intents* (`POST /api/attacks`)
  over the local HTTP API. The backend originates, HMAC-signs, and (optionally)
  AES-GCM-encrypts the actual envelopes server-side.
- The authoritative credential registry (simulated ground-station keys) lives **only in
  the backend process**. The frontend production bundle contains no secret material —
  `src/ground_station/client.ts` and `src/attacker/simulator.ts` (which hold credential
  material) are server-side/test-only modules.
- Trust boundaries are unchanged: the backend is the single enforcement point,
  and the deterministic policy engine remains the final authority.

### Persistence layer

Tables (see `backend/src/db/schema.sql`): `ground_stations`, `commands`,
`security_events` (full pipeline evidence as JSON), `spacecraft_state`, `mission_state`,
and `replay_state` (per-sender anti-replay state).
All SQL is parameterized; migrations live in `backend/src/db/migrations/` and are
applied automatically at startup. Command + audit event + replay state + vehicle state
are written in **one transaction** per decision; a persistence failure returns HTTP 503
and never silently converts a decision into a success.

### Cross-restart security state

On startup the backend rehydrates the gateway from SQLite so the security guarantees
survive restarts:

- replay protection (bounded nonce cache + monotonic sequence **per spacecraft_id + key_id**),
- behavioral analysis command history,
- mission phase and vehicle state (including SAFE_MODE).

A replayed command captured before a server restart is still rejected after it.
Anti-replay state only advances for cryptographically verified commands, so unauthenticated
traffic cannot poison the sequence stream.

### Consequences

- Audit trail, threat statistics, and vehicle state survive browser refreshes and
  server restarts.
- Command origination/signing, credential lookup, validation, execution, encryption,
  and audit are all server-side; the browser only observes and requests.
- No cloud, container, or networked infrastructure is introduced; the system remains
  a fully local simulation (PRD Section 6, AGENT_RULES Section 3).
