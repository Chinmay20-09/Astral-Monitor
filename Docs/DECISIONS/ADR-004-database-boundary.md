# ADR-004: Database Boundary and Persistence

**Status:** Accepted
**Date:** 2026-10-06
**Owner:** Developer 1 (Security/Backend)

---

## Context

The ST-02 competition requires persistent security state that survives restarts. We needed to decide:
- What database technology?
- Where does it live?
- What is persisted?
- How do we ensure the browser never accesses it directly?
- How do we ensure anti-replay state survives restarts?

---

## Decision

### Database Technology

**SQLite** via `better-sqlite3` (synchronous, embedded, file-based).

Chosen over:
- **PostgreSQL** — rejected (WON'T per judge-todo.md, deployment complexity)
- **In-memory only** — rejected (state wouldn't survive restarts)
- **JSON files** — rejected (no transactional guarantees, no query capability)

### Location

`backend/data/orbitshield.db` — lives in the backend directory, never exposed to frontend.

Configuration via `backend/.env`:
```env
DATABASE_PATH=data/orbitshield.db
```

### Tables

| Table | Purpose | Population |
|-------|---------|------------|
| `ground_stations` | Seeded credential registry snapshot | Seeded from `AUTHORIZED_GROUND_STATIONS` at startup |
| `commands` | Persisted command envelopes (with decrypted parameters for encrypted commands) | Inserted on every command processing |
| `security_events` | Full pipeline evidence as JSON (complete AuditEvent) | Inserted on every command processing |
| `spacecraft_state` | Last known vehicle state | Saved on every command processing |
| `mission_state` | Last known mission state | Saved when mission phase changes |
| `replay_state` | Per-(spacecraft_id, key_id) sequence counters | Upserted on every command processing |
| `sessions` | Operator sessions | Created/activated by session management |

### Persistence Guarantees

1. **Transactional writes** — Command insert + audit event insert + replay state upsert + spacecraft state save happen in ONE SQLite transaction inside `CommandService.processCommand()`:

```typescript
const persist = getDatabase().transaction(() => {
  if (isWellFormedEnvelope(envelope)) {
    this.commandRepository.insert(effectiveEnvelope);
    this.replayStateRepository.upsert(...);
  }
  this.eventRepository.insert(result.audit_event);
  this.spacecraftRepository.save(result.spacecraft_state);
});
persist();
```

2. **Persistence failure → HTTP 503** — If the transaction fails, `PersistenceError` is thrown and the route returns 503. The decision is NOT silently converted to a success.

3. **Migrations applied automatically** — `backend/src/db/migrations/` contains numbered SQL migration files applied at startup.

4. **Anti-replay state survives restarts** — On startup, `CommandService.rehydrateGatewayState()`:
   - Loads per-(spacecraft_id, key_id) sequence counters from `replay_state` table
   - Seeds nonce cache from recent command nonces in `commands` table
   - Rebuilds behavioral history from recent `security_events`

### Browser Boundary

**The browser NEVER accesses SQLite directly.**

- Frontend communicates with backend ONLY via HTTP API (`src/api/client.ts`)
- No direct file access, no WebSocket to database, no exposed database port
- Vite dev server proxies `/api` requests to backend, but browser never sees database
- Build check verifies no credential material leaks to frontend bundle

---

## Consequences

### Positive
- Audit trail, vehicle state, mission state survive browser refreshes and server restarts
- Replay of a command captured before a restart is still blocked after restart
- Transactional writes ensure decision durability — no partial persists
- SQLite is zero-configuration, single file, easy to back up/inspect
- Browser is pure operator console — no database access possible

### Negative
- SQLite is a single file — no concurrent write scaling (not needed for local demo)
- Database file is on localhost filesystem — not encrypted at rest (not required for demo)
- Database path is configurable but defaults to backend/data/ — must ensure directory exists
- Migration errors at startup can prevent backend from starting (handled with fatal error in server.ts)

### Neutral
- `better-sqlite3` is synchronous — doesn't block event loop for simple queries, but could for complex ones (not an issue at demo scale)
- Database is recreated from migrations if deleted (loss of all persisted data)
- Replay state is per-(spacecraft_id, key_id) — not global (multiple ground stations don't starve each other's sequence space)

---

## Compliance

- PRD Section 6: Local simulation only, no cloud infrastructure
- TRD Section 11: Audit event — every security decision records full evidence
- TRD Section 13: Reliability — logging failure must not silently change security decision
- ADR-001: Service boundaries (database is backend-only, not accessible from frontend)
- ADR-002: Security gateway (pipeline produces audit events persisted to database)
- judge-todo.md Section 16: Database boundary — database remains internal, attacker cannot access it, browser cannot directly access it, security events persisted, command history persisted, replay state persisted appropriately
