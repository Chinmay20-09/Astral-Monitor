# OrbitShield — Local Deployment Guide

## Overview

OrbitShield ST-02 is a locally deployable multi-service security demonstration. Double-click `start.bat` to launch the entire environment.

## Service Topology

```
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

## Port Assignment

| Service | Port | Trust Zone | Purpose |
|---------|------|------------|---------|
| Ground Server | 3000 | TRUSTED | Main OrbitShield control/ground interface |
| SpaceTwin | 3100 | TRUSTED | Spacecraft digital twin / simulator |
| Alternate SpaceTwin | 3010 | RESERVED FALLBACK | Use only if 3100 cannot be used |
| Attacker Simulator | 3500 | UNTRUSTED | Simulated malicious/unwanted guest |
| Backend | 4000 | INTERNAL | Reserved backend/API service |
| Database | internal/private | INTERNAL | Persistent state only (SQLite) |

## Quick Start

### Windows (Double-Click)

1. Ensure Node.js (v18+) and npm are installed
2. Double-click `start.bat`
3. Wait for all services to start (approximately 10-15 seconds)
4. Browser windows will open automatically:
   - Ground Console: http://localhost:3000
   - SpaceTwin: http://localhost:3100/twin
   - Attack Simulator: http://localhost:3500/attacker

### Manual Start (Command Line)

```bash
# From repository root
npm run dev:ground    # Port 3000
npm run dev:twin      # Port 3100
npm run dev:attacker  # Port 3500
npm run dev:backend   # Port 4000
```

### Shutdown

Double-click `stop.bat` or press Ctrl+C in each service window.

## Configuration

See `.env.example` for available configuration options. Copy to `.env` to customize:

```env
GROUND_PORT=3000
SPACETWIN_PORT=3100
SPACETWIN_FALLBACK_PORT=3010
ATTACKER_PORT=3500
BACKEND_PORT=4000

GROUND_ORIGIN=http://localhost:3000
SPACETWIN_ORIGIN=http://localhost:3100
ATTACKER_ORIGIN=http://localhost:3500
BACKEND_ORIGIN=http://localhost:4000

TRUSTED_SERVICE_MODE=development
```

## Trust Zones

### TRUSTED (Ground :3000, SpaceTwin :3100)

- Authorized to communicate with each other
- Authorized to communicate with backend :4000
- Identified by `SERVICE_TOKEN` in environment
- CORS allows their origins

### INTERNAL (Backend :4000)

- Reserved for backend services
- Only accessible by trusted services
- Never exposed as public UI
- Database connection is private

### UNTRUSTED (Attacker :3500)

- NOT trusted
- NOT authorized to access any backend services
- Explicitly blocked at service layer
- Security events generated when attempts detected

### PRIVATE (Database)

- Only accessible through backend/data layer
- Never directly exposed to browser or attacker
- SQLite file stored in `backend/data/`

## Communication Matrix

| Source | Destination | Result |
|--------|-------------|--------|
| Ground :3000 | SpaceTwin :3100 | ALLOW |
| SpaceTwin :3100 | Ground :3000 | ALLOW where endpoint permits |
| Ground :3000 | Backend :4000 | ALLOW |
| SpaceTwin :3100 | Backend :4000 | ALLOW where required |
| Ground | Database | Through approved data layer only |
| SpaceTwin | Database | Through approved data layer only |
| Attacker :3500 | Ground | DENY |
| Attacker :3500 | SpaceTwin | DENY |
| Attacker :3500 | Backend | DENY |
| Attacker :3500 | Database | DENY |
| Browser | Database | DENY |
| Browser | privileged Backend operations | DENY unless explicitly authorized |

**Principle**: DEFAULT DENY, EXPLICIT ALLOW, LEAST PRIVILEGE

## Attack Simulation

The Attacker Simulator (port 3500) provides controlled attack scenarios:

### Scenario A — Unauthorized Ground Request
```
ATTACKER → Ground
GET /api/internal/...
```
Expected: `403 Forbidden` + security event

### Scenario B — SpaceTwin Access Attempt
```
ATTACKER → SpaceTwin
```
Expected: `403` + threat event

### Scenario C — Backend Discovery Attempt
```
ATTACKER → Backend 4000
```
Expected: `blocked` (no implementation details exposed)

### Scenario D — Invalid Authentication
Send intentionally invalid/expired token
Expected: `401 Unauthorized` + security telemetry

### Scenario E — Request Flood Simulation
20 controlled requests within short interval
Expected: Detection of excessive frequency, temporary quarantine

## Security States

```
NORMAL
  ↓
SUSPICIOUS
  ↓
THREAT_DETECTED
  ↓
ISOLATED
  ↓
RECOVERING
  ↓
RESTORED
```

Only the security/control layer can restore trust. Attacker cannot transition itself back to NORMAL.

## Quarantine

When attacker crosses configured threshold:

```json
{
  "serviceId": "attacker-sim",
  "trustLevel": "UNTRUSTED",
  "status": "QUARANTINED",
  "reason": "Repeated unauthorized requests",
  "detectedAt": "...",
  "expiresAt": "..."
}
```

During quarantine:
- ATTACKER → GROUND: BLOCKED
- ATTACKER → SPACETWIN: BLOCKED
- ATTACKER → BACKEND: BLOCKED
- ATTACKER → DATABASE: BLOCKED

Attacker can still access its own simulator interface on port 3500.

## Recovery

Recovery workflow:
1. Detect
2. Classify
3. Isolate
4. Verify trusted services
5. Restore trusted communication
6. Record recovery

Endpoints:
- `GET /health` — liveness check
- `GET /security/status` — current security state
- `GET /security/events` — security event stream
- `POST /security/quarantine` — quarantine attacker
- `POST /security/recover` — initiate recovery

## Database Boundary

SQLite database (`backend/data/orbitshield.db`) is private:

- Only backend process can access
- Never exposes connection string to browser
- Never exposes connection string to attacker
- All queries parameterized
- WAL mode enabled for durability

## Troubleshooting

### Port Already in Use

If a port is occupied:
```
WARNING: Port 3000 is already in use.
```

Check with:
```bash
netstat -an | findstr 3000
```

### Services Not Starting

1. Check Node.js version: `node --version` (requires v18+)
2. Check npm: `npm --version`
3. Install dependencies: `npm install`
4. Check backend logs in separate window

### Backend Health Check Failed

```bash
curl http://localhost:4000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "orbitshield-backend",
  "database": "connected"
}
```

### SpaceTwin on Fallback Port

If port 3100 unavailable, SpaceTwin automatically uses 3010. Ground communicates with actual port.

## Acceptance Tests

### Test 1 — Startup
Double-click `start.bat`. Expected:
- 3000 ONLINE
- 3100 ONLINE
- 3500 ONLINE
- 4000 ONLINE

### Test 2 — Ground → SpaceTwin
Ground successfully communicates with SpaceTwin. Expected: ALLOW

### Test 3 — SpaceTwin → Ground
SpaceTwin communicates with Ground where explicitly allowed. Expected: ALLOW

### Test 4 — Attacker → Ground
Attacker attempts unauthorized endpoint. Expected: DENY, 403, SECURITY EVENT

### Test 5 — Attacker → SpaceTwin
Expected: DENY, SECURITY EVENT

### Test 6 — Attacker → Backend
Expected: DENY

### Test 7 — Database Protection
Verify attacker cannot access database directly. Expected: DENY

### Test 8 — Quarantine
Trigger enough suspicious activity. Expected: ATTACKER → THREAT_DETECTED → QUARANTINED

### Test 9 — Trusted Services Survive
During attack: Ground = ONLINE, SpaceTwin = ONLINE, Backend = ONLINE

### Test 10 — Recovery
After quarantine: Recovery initiated, integrity checks pass, system returns NORMAL

### Test 11 — Shutdown
Run `stop.bat`. Expected: All OrbitShield processes stopped without killing unrelated applications.
