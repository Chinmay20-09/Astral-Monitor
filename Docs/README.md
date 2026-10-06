# OrbitShield Documentation

**Status:** Current as of 2026-10-06

This directory contains all project documentation organized by purpose.

---

## Documentation Index

### Architecture

| Document | Purpose | Owner |
|----------|---------|-------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture — services, ports, directory structure, dependency direction, technical debt | Dev1 + Dev2 |
| [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) | Security pipeline details — all 10 layers, modules, rules, events | Dev1 |

### API

| Document | Purpose | Owner |
|----------|---------|-------|
| [API_CONTRACTS.md](API_CONTRACTS.md) | All backend endpoints — trust zones, request/response formats, errors, owners | Dev1 + Dev2 |

### Security

| Document | Purpose | Owner |
|----------|---------|-------|
| [THREAT_MODEL.md](THREAT_MODEL.md) | Threat catalog — 7 threats with attack vector, detection, prevention, response, recovery | Dev1 |
| [ADR-002-security-gateway.md](DECISIONS/ADR-002-security-gateway.md) | Pipeline decision record — 10-layer sequential processing | Dev1 |
| [ADR-003-attacker-boundary.md](DECISIONS/ADR-003-attacker-boundary.md) | Attacker access policy — what attacker can/cannot do | Dev1 + Dev3 |
| [ADR-004-database-boundary.md](DECISIONS/ADR-004-database-boundary.md) | Database boundary — SQLite persistence, browser isolation | Dev1 |

### Demo & Testing

| Document | Purpose | Owner |
|----------|---------|-------|
| [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md) | Step-by-step judge demonstration — 13 steps with expected results | Dev3 |
| [TESTING.md](TESTING.md) | Test suites, manual security tests, verification procedures | Dev1 + Dev4 |

### Development

| Document | Purpose | Owner |
|----------|---------|-------|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Developer setup — prerequisites, install, startup, tests, typecheck, build, troubleshooting | Dev2 + Dev4 |
| [TEAM_WORKFLOW.md](TEAM_WORKFLOW.md) | Four-developer ownership model, collaboration rules, architectural rules | All |
| [CODE_OWNERSHIP.md](CODE_OWNERSHIP.md) | File-by-file ownership classification — high-risk, shared, low-conflict | All |

### Architecture Decisions

| Document | Purpose | Owner |
|----------|---------|-------|
| [DECISIONS/ADR-001-service-boundaries.md](DECISIONS/ADR-001-service-boundaries.md) | Why 4 services on localhost with logical segmentation | Dev1 + Dev3 |
| [DECISIONS/ADR-002-security-gateway.md](DECISIONS/ADR-002-security-gateway.md) | Why 10-layer sequential pipeline with deterministic policy as final authority | Dev1 |
| [DECISIONS/ADR-003-attacker-boundary.md](DECISIONS/ADR-003-attacker-boundary.md) | Why attacker is UNTRUSTED with limited `/api/commands` exception | Dev1 + Dev3 |
| [DECISIONS/ADR-004-database-boundary.md](DECISIONS/ADR-004-database-boundary.md) | Why SQLite, backend-only, transactional persistence | Dev1 |

### Competition

| Document | Purpose | Owner |
|----------|---------|-------|
| `../README.md` | Product overview — architecture diagram, threat model summary, running instructions | Dev4 (coordinate with team) |
| `../judge-todo.md` | MoSCoW backlog — 18 must-have items, should/could/won't | Dev4 (coordinate with team) |
| `../focus.md` | Implementation focus — P0 status, runtime verification, known risks | Dev4 (coordinate with team) |
| `../ST02_Project_Docs/ARCHITECTURE_AUDIT.md` | Architecture audit baseline — pre-refactoring inspection | Dev4 |

---

## Documentation Rules

1. **Docs are source of truth.** If code changes, update the relevant doc.
2. **Don't duplicate.** If content exists in one doc, link to it instead of copying.
3. **Docs are owned.** Each doc has an owner responsible for its accuracy.
4. **Docs are versioned with code.** Documentation changes follow the same commit process as code.
5. **Docs reflect reality.** Never document planned behavior as implemented behavior. Label future work as "Future / Not Currently Implemented".

---

## Quick Start for New Developers

1. Read `../README.md` for product overview
2. Read `DEVELOPMENT.md` for setup instructions
3. Read `ARCHITECTURE.md` for system structure
4. Read `API_CONTRACTS.md` for backend endpoints
5. Read `CODE_OWNERSHIP.md` to know what you can safely modify
6. Read `TEAM_WORKFLOW.md` for team rules
7. Read `DEMO_RUNBOOK.md` before demonstrating to judges
8. Read `TESTING.md` to verify your changes don't break anything
