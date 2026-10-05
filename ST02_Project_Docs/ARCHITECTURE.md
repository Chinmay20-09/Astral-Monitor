# OrbitShield — System Architecture

## 1. High-Level Diagram

```text
                         ┌───────────────────────────┐
                         │        ORBITSHIELD         │
                         │       Ground Server        │
                         │         PORT 3000          │
                         └─────────────┬─────────────┘
                                       │
                                  ALLOWED LINK
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │       SpaceTwin Server    │
                         │         PORT 3100          │
                         └─────────────┬─────────────┘
                                       │
                              DATA / SESSION LINK
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │       Database Layer      │
                         │   ONLY DATABASE CONNECTION │
                         │      INTERNAL / PRIVATE   │
                         └───────────────────────────┘

        UNTRUSTED / UNWANTED
                 │
                 ▼
        ┌───────────────────┐
        │     ATTACKER      │
        │     PORT 3500     │
        │   UNTRUSTED ZONE  │
        └─────────┬─────────┘
                  │
             BLOCK / DETECT
                  │
                  ▼
        ┌───────────────────┐
        │ OrbitShield       │
        │ Security Layer    │
        │ Detect → Isolate  │
        │ Recover → Restore │
        └───────────────────┘

        Backend reservation:
        PORT 4000
        --------------------------------
        Reserved for backend services.
        Do not allow attacker or
        frontend services to freely
        access it.
```

## 2. Trust Boundaries

### Boundary 1: Ground (3000) ↔ SpaceTwin (3100)
- TRUSTED services
- Explicit application-level link
- Service identity via SERVICE_TOKEN
- CORS allows both origins

### Boundary 2: Trusted Services → Backend (4000)
- Ground and SpaceTwin may call backend APIs
- Backend validates service identity
- Backend is enforcement point

### Boundary 3: Attacker (3500) → Everything
- UNTRUSTED zone
- All access DENIED by default
- Security events generated on attempt
- Attacker cannot access backend or database

### Boundary 4: Database
- PRIVATE / INTERNAL only
- Accessed through backend/data layer
- Never exposed to browser or attacker

## 3. Enforcement Principle

Only the security layer can authorize execution.

Trusted services:
```
 Ground ↔ SpaceTwin ↔ Backend
```

Untrusted:
```
 Attacker → BLOCK/DETECT
```

## 4. Modular Dependency Direction

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

## 5. Service Isolation

Each service runs as independent process:

```text
services/
  ground/      → Port 3000, TRUSTED
  spacetwin/   → Port 3100, TRUSTED
  attacker/    → Port 3500, UNTRUSTED
  backend/     → Port 4000, INTERNAL
```

Services must not directly import each other's internal code.

## 6. Communication Policy

```text
GROUND 3000  ────────►  SPACETWIN 3100  ALLOW
GROUND 3000  ◄────────  SPACETWIN 3100  ALLOW
GROUND 3000  ────────►  BACKEND 4000    ALLOW
SPACETWIN   ──────────►  BACKEND 4000    ALLOW
ATTACKER 3500 ─────X────►  GROUND        DENY
ATTACKER 3500 ─────X────►  SPACETWIN     DENY
ATTACKER 3500 ─────X────►  BACKEND       DENY
ATTACKER 3500 ─────X────►  DATABASE      DENY
BROWSER ─────────────►  Ground UI        ALLOW
BROWSER ─────────────►  SpaceTwin UI     ALLOW
DATABASE ◄────────────  Backend only     PRIVATE
```

## 7. Service Identity

Trusted services identify themselves:

```json
{
  "service": "ground",
  "zone": "TRUSTED",
  "capabilities": ["spacetwin.read", "spacetwin.command"]
}
```

```json
{
  "service": "spacetwin",
  "zone": "TRUSTED",
  "capabilities": ["ground.telemetry"]
}
```

Lightweight local development: `SERVICE_TOKEN` in environment.

## 8. Security States

```
NORMAL → SUSPICIOUS → THREAT_DETECTED → ISOLATED → RECOVERING → RESTORED
```

Attacker cannot self-transition to NORMAL.

## 9. Security Events

Event types:
- SERVICE_STARTED
- SERVICE_STOPPED
- UNAUTHORIZED_ACCESS
- AUTHENTICATION_FAILED
- RATE_LIMIT_EXCEEDED
- THREAT_DETECTED
- ATTACKER_QUARANTINED
- RECOVERY_STARTED
- SERVICE_VERIFIED
- SYSTEM_RECOVERED

## 10. Existing Backend (Phase 7.5)

The gateway pipeline runs in local Node.js/Express backend (`backend/`) with SQLite persistence via `better-sqlite3`.

### What moved where
- `backend/` hosts security pipeline, spacecraft simulator, models at runtime
- Browser dashboard is pure operator console
- Credential registry lives only in backend process
- Trust boundaries unchanged: backend is single enforcement point
