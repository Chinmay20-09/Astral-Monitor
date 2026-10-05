# OrbitShield — Implementation Roadmap

## Phase 0 — Freeze Scope
Deliverables: PRD, TRD, architecture, threat model, agent rules
Status: COMPLETE

## Phase 1 — Core Command Path
Goal: Legitimate structured command reaches spacecraft simulator
Status: COMPLETE

## Phase 2 — Cryptographic Gateway
Implement: encryption, signature, authentication, nonce, timestamp, sequence, replay detection
Status: COMPLETE

## Phase 3 — Behavioral Intelligence
Implement: command history, spacecraft state, AI behavioral assessment
Status: COMPLETE

## Phase 4 — Mission Context + Risk
Implement: mission phase, context resolver, risk score, safety policy
Status: COMPLETE

## Phase 5 — Attack Simulator
Implement: tampering, injection, credential compromise, replay, interception scenarios
Status: COMPLETE

## Phase 6 — Safe Mode
Implement: dangerous-command restrictions, telemetry preservation, alert, recovery
Status: COMPLETE

## Phase 7 — Judge Dashboard
Implement: security overview, live command stream, incident panel
Status: COMPLETE

## Phase 7.5 — Persistent Backend (COMPLETE)
- Local Node.js/Express backend with SQLite
- Backend-owned credential registry
- Transactional persistence
- Startup rehydration

## Phase 8 — Multi-Service Security Architecture (CURRENT)
Goal: Turn OrbitShield into locally deployable multi-service system with network segmentation

### 8.1 Service Isolation
- Ground :3000 (TRUSTED)
- SpaceTwin :3100 (TRUSTED)
- Attacker :3500 (UNTRUSTED)
- Backend :4000 (INTERNAL)
- Database (PRIVATE)

### 8.2 Communication Policy
- Trusted services communicate through explicit interfaces
- Untrusted services denied by default
- Service identity validation
- Origin/CORS policy

### 8.3 Security States
- NORMAL → SUSPICIOUS → THREAT_DETECTED → ISOLATED → RECOVERING → RESTORED

### 8.4 Quarantine
- Attacker quarantined after threshold
- All attacker access blocked
- Attacker UI still accessible

### 8.5 Recovery
- Detect → Classify → Isolate → Verify → Restore → Record

### 8.6 Documentation
- ST02_Project_Docs/ARCHITECTURE.md
- ST02_Project_Docs/THREAT_MODEL.md
- ST02_Project_Docs/ROADMAP.md
- ST02_Project_Docs/LOCAL_DEPLOYMENT.md

## Phase 9 — Expansion
Only after MVP stable:
- Subsystem simulation
- Telemetry/state transitions
- Hybrid rule + ML
- Mission context agent
- Event-driven architecture
- Forensic audit
- Full command center
