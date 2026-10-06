# ADR-001: Service Boundaries and Ports

**Status:** Accepted
**Date:** 2026-10-06
**Owner:** Developer 1 (Security/Backend) + Developer 3 (Attacker/Demo)

---

## Context

The ST-02 competition requires a security gateway between satellite ground stations and spacecraft flight software. The system must demonstrate:
- Trusted operator commands (Ground station)
- Read-only visualization (SpaceTwin)
- Untrusted attack simulation (Attacker)
- Central security enforcement (Backend)

We needed to decide: how many services, what ports, and how to enforce boundaries.

---

## Decision

We use **four independent services on localhost**, logically segmented by port and origin:

| Service | Port | Trust Zone | Technology |
|---------|------|------------|------------|
| Ground Station | 3000 | TRUSTED | Vite + React |
| SpaceTwin | 3100 | TRUSTED | Vite + React |
| Attacker Simulator | 3500 | UNTRUSTED | Vite + React |
| Backend / Gateway | 4000 | INTERNAL | Node + Express + SQLite |

**Network segmentation is logical, not physical.** All services run on localhost. Boundaries are enforced by:
1. Origin header validation in `backend/src/middleware/security.ts`
2. Port-based trust zone assignment
3. CORS headers set dynamically based on trust zone

---

## Consequences

### Positive
- Clear separation of concerns — each service has a distinct role
- Attacker is demonstrably untrusted — blocked from all endpoints except `/api/commands`
- Trusted services (Ground, SpaceTwin) have full backend access
- Easy to run locally — no Docker, no cloud, no network config
- Competition-friendly — judges see 4 distinct services on 4 ports

### Negative
- All services on localhost — not physically isolated
- Trust zone enforcement is software-only — a compromised localhost could bypass it
- Service tokens in `.env` are not enforced (origin is used instead)
- Vite proxy introduces a subtle trust boundary issue (browser → Vite → backend)

### Neutral
- Frontend source code is shared across all three Vite configs (same `src/` directory)
- Gateway modules live in `src/gateway/` (frontend tree) but are imported by backend
- Three nearly-identical Vite configs (differing only in port and proxy headers)

---

## Alternatives Considered

### Alternative A: Single service, all ports on one process
Rejected — doesn't demonstrate service boundaries or trust zone separation.

### Alternative B: Docker containers per service
Rejected — adds deployment complexity, not required for competition (WON'T per judge-todo.md).

### Alternative C: Backend-only security, frontend is pure UI
Accepted — this is what we implemented. Frontend is operator console, backend is enforcement point.

---

## Compliance

- PRD Section 6: Local simulation only, no cloud/network infrastructure
- TRD Section 2: Modular architecture with explicit interfaces
- judge-todo.md Section 17: Required ports (3000, 3100, 3500, 4000)
