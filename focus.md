# OrbitShield — ST-02 Implementation Focus

## 1. Current Reality

### What Works
- **Multi-service architecture**: Ground (3000), SpaceTwin (3100), Attacker (3500), Backend (4000) run as independent Vite/Express processes
- **Network segmentation**: Security middleware blocks attacker (3500) from backend APIs with 403
- **Trusted origin validation**: Ground (3000) and SpaceTwin (3100) origins are allowed; attacker (3500) is denied
- **Backend security pipeline**: Complete HMAC-SHA256 integrity verification, authentication against credential registry, anti-replay (nonce + sequence + timestamp)
- **Attack scenarios**: TAMPERING, INJECTION, REPLAY, CREDENTIAL_COMPROMISE, DESTRUCTIVE_BURN, EAVESDROP all implemented in backend
- **Safe Mode**: Deterministic safety policy triggers SAFE_MODE on CRITICAL risk (>=75)
- **Recovery**: OPERATOR_RECOVER command exits safe mode after verification
- **Database**: SQLite persistence with transactional audit, replay state persisted across restarts
- **Startup/Shutdown**: start.bat and stop.bat created with port collision detection
- **Security UI**: ServiceTopology, SecurityStatusCards, SecurityEventLog components added

### What Is Incomplete
- **No cryptographic signing from browser**: Browser sends command *intents* to backend; backend signs server-side. This is intentional but the judge may expect to see signing happen in the Ground console UI flow
- **Attacker simulator is UI-only on port 3500**: The attacker service has no independent API; it's just a Vite frontend that demos attack scenarios through the backend's /api/attacks endpoint. The attacker cannot independently generate attacks without going through the trusted backend
- **Security state machine is in-memory only**: The quarantine store in security.ts is a Map, not persisted. Restart clears quarantine state
- **No explicit threat model document for ST-02**: Docs/THREAT_MODEL.md exists but judge-todo.md Section 7 requires specific threat documentation format
- **Live security event timeline**: SecurityEventLog component exists but requires trusted origin; attacker's attempts to view events are blocked
- **No demo mode / one-click attack flow for judges**: The AttackSimulator component has buttons but they go through backend; no dedicated "Demo Mode" UI

### What Is Merely UI/Mock
- ServiceTopology component: Visualization only, no real-time data binding to actual service health
- SecurityStatusCards: Shows hardcoded statuses initially, polls /api/health but not comprehensive
- The "network segmentation" is enforced by CORS/origin checks, not by actual network isolation (all services on localhost)

### What Is Technically Sound
- HMAC-SHA256 implementation using Web Crypto API (no custom crypto)
- Anti-replay: nonce cache + per-sender sequence + clock skew window
- Behavioral analysis: burst detection, state conflicts, credential compromise patterns
- Mission context: eclipse restrictions, thruster limits, wheel speed limits, safe mode locks
- Risk engine: multi-factor scoring with deterministic thresholds
- Safety policy: hard constraints on auth/integrity/replay failures, safe mode triggers

### Major Architectural Risks
1. **Attacker on 3500 has no real independent attack capability** — it's a UI that sends intents to the trusted backend. The judge's "Attacker Simulator — Port 3500" requirement expects the attacker to be able to generate attacks independently
2. **Quarantine not persisted** — restart loses quarantine state
3. **All services share the same backend** — the "service isolation" is logical (ports), not process isolation beyond what Vite provides

---

## 2. Completion Summary

| Requirement | Status | Priority | Evidence | Required Work |
|---|---|---|---|---|
| **1. Command Security Gateway** | COMPLETE | P0 | backend/src/services/commandService.ts, src/gateway/gateway.ts | None — gateway processes all commands |
| **2. Cryptographic Command Authentication** | COMPLETE | P0 | src/gateway/authentication.ts, src/gateway/integrity.ts, src/gateway/crypto_utils.ts | None — HMAC-SHA256 implemented |
| **3. Command Integrity / Tamper Detection** | COMPLETE | P0 | src/gateway/integrity.ts verifyIntegrity() | None — tamper detection works |
| **4. Anti-Replay Protection** | COMPLETE | P0 | src/gateway/replay.ts, backend persistence | None — nonce + sequence + timestamp |
| **5. Command Freshness** | COMPLETE | P0 | src/gateway/replay.ts clock skew check | None — 60s window |
| **6. Command Authorization** | COMPLETE | P0 | src/gateway/authentication.ts key registry, policy.ts | None — key registry + allowed commands |
| **7. Threat Model** | PARTIAL | P0 | ST02_Project_Docs/THREAT_MODEL.md | Add explicit threat→vector→detection→prevention→response→recovery format |
| **8. Attack Detection Engine** | COMPLETE | P0 | src/gateway/behavioral.ts, src/gateway/risk.ts | None — detects replay, tamper, auth failure, burst |
| **9. Autonomous Safe Mode** | COMPLETE | P0 | src/gateway/policy.ts, src/spacecraft/simulator.ts | None — triggers on CRITICAL risk |
| **10. Safe-Mode Recovery** | COMPLETE | P0 | backend/src/routes/spacecraft.ts recovery endpoint, policy.ts | None — OPERATOR_RECOVER with auth |
| **11. Attacker Simulator Port 3500** | PARTIAL | P0 | vite.attacker.config.ts, src/main.attacker.tsx, src/components/AttackSimulator.tsx | Attacker needs independent attack generation capability, not just UI buttons |
| **12. Ground Station Port 3000** | COMPLETE | P0 | vite.ground.config.ts, src/components/GroundConsole.tsx | None — command UI exists |
| **13. SpaceTwin Port 3100** | COMPLETE | P0 | vite.twin.config.ts, src/components/SpacecraftTwin.tsx | None — twin visualization works |
| **14. Security Dashboard** | PARTIAL | P1 | src/components/SecurityOverview.tsx, SecurityStatusCards.tsx, ServiceTopology.tsx | ServiceTopology needs real-time data; SecurityEventLog needs attacker-accessible view |
| **15. Live Security Event Timeline** | PARTIAL | P1 | src/components/SecurityEventLog.tsx, backend/src/routes/security.ts | Timeline exists but attacker can't see it; needs dedicated timeline view |
| **16. Database Boundary** | COMPLETE | P0 | backend/src/db/database.ts, security middleware | SQLite never exposed; attacker blocked |
| **17. Required Ports / Runtime** | COMPLETE | P0 | start.bat, stop.bat, vite configs, package.json scripts | All ports configured, start/stop scripts work |
| **18. End-to-End Judge Test** | PARTIAL | P0 | Full flow: valid→accept→replay→block→tamper→block→safe mode→recovery | Attacker needs independent attack capability; recovery flow needs UI button |

### SHOULD (Strong Differentiators)

| Requirement | Status | Priority | Evidence | Required Work |
|---|---|---|---|---|
| Trust-zone visualization | COMPLETE | P1 | ServiceTopology.tsx | None — component exists |
| Default-deny policy | COMPLETE | P1 | backend/src/middleware/security.ts | None — enforced |
| Service identity | PARTIAL | P1 | .env has tokens, security.ts has middleware | Not fully integrated into request flow |
| Capability-based authorization | MISSING | P2 | — | Not implemented |
| Threat scoring | COMPLETE | P1 | src/gateway/risk.ts | None — scoring works |
| Incident ID/timeline/evidence | PARTIAL | P1 | AuditEvent model has all fields, SecurityEventLog displays them | UI timeline needs polish |
| Demo Mode / one-click attacks | MISSING | P1 | AttackSimulator has buttons but no demo flow | Need dedicated demo mode UI |
| Explainable blocks | COMPLETE | P1 | ExplainableIncidentPanel.tsx, policy.ts explanations | None — detailed explanations exist |

### COULD (Nice-to-Have)

| Requirement | Status | Priority |
|---|---|---|
| Key lifecycle visualization | MISSING | P3 |
| Key rotation/revocation | MISSING | P3 |
| Advanced spacecraft telemetry | PARTIAL | P3 — battery/thermal exist, attitude/fuel partial |
| Orbital visualization animation | COMPLETE | P3 — SpacecraftTwin has orbit animation |
| CCSDS alignment | MISSING | P3 |
| SIEM features | MISSING | P3 |

---

## 3. P0 — Must Complete Tonight

### 1. Attacker Simulator Needs Independent Attack Capability

**Current state**: Attacker UI on 3500 sends scenario intents to backend /api/attacks. The attacker cannot independently generate attacks — it relies on the trusted backend to manufacture hostile envelopes.

**Required**: The attacker service should be able to generate and send attack commands independently. This matches judge-todo.md Section 11: "Turn the current attacker service into a real demo tool" with attack buttons that generate real attacks.

**Files involved**:
- `vite.attacker.config.ts` — remove CORS restrictions, potentially add mock API routes
- `src/main.attacker.tsx` — attacker entry point
- `src/components/AttackSimulator.tsx` — attack buttons
- `src/attacker/simulator.ts` — attack generation (currently server-side only)

**Implementation needed**:
- Option A: Move attack generation to attacker frontend (import simulator.ts client-side, generate envelopes, send directly to backend /api/commands)
- Option B: Create attacker-only API endpoints that don't require trusted origin

**Acceptance test**: Attacker on 3500 can click "Replay Attack" and see a replay command generated and sent, with the backend blocking it and generating a security event.

### 2. End-to-End Judge Flow Must Work Without Manual Intervention

**Current state**: The full flow exists in backend but the UI flow for judges is fragmented across multiple screens.

**Required**: A clear, demonstrable flow that a judge can follow:
1. Create legitimate command (Ground UI)
2. See it accepted
3. Click "Replay Attack" → see BLOCK
4. Click "Tamper Attack" → see BLOCK
5. Repeated attacks → SAFE MODE
6. Click "Recover" → SYSTEM_RESTORED

**Files involved**:
- `src/components/AttackSimulator.tsx` — needs demo mode
- `src/App.tsx` — may need demo mode state management
- `backend/src/routes/security.ts` — recovery endpoint exists

**Acceptance test**: Judge can complete the full flow in under 3 minutes with clear visual feedback at each step.

### 3. Threat Model Documentation Format

**Current state**: ST02_Project_Docs/THREAT_MODEL.md exists but doesn't follow the judge-todo.md Section 7 format (threat → attack vector → detection → prevention → response → recovery).

**Required**: Rewrite threat model to match required format for each threat:
- Spoofed ground station
- Compromised operator endpoint
- Replay attack
- Tampered command
- Invalid/forged command
- Malicious insider / unauthorized operator
- Credential/key compromise

**Files involved**: `ST02_Project_Docs/THREAT_MODEL.md`

**Acceptance test**: Each threat has the 6-part structure documented.

---

## 4. P1 — Complete If P0 Is Stable

### 1. Security Event Timeline UI

**Current state**: SecurityEventLog component polls /api/security/events but requires trusted origin. Attacker can't view it.

**Required**: A timeline view that shows the live sequence of security events with timestamps, suitable for judge demonstration.

**Files**: `src/components/SecurityEventLog.tsx`, `backend/src/routes/security.ts`

### 2. Service Topology Real-Time Data

**Current state**: ServiceTopology.tsx is static visualization.

**Required**: Bind to actual service health endpoints to show real-time status.

**Files**: `src/components/ServiceTopology.tsx`

### 3. Demo Mode UI

**Current state**: No dedicated demo mode.

**Required**: A "Demo Mode" toggle that guides judges through the attack→block→safe mode→recovery flow with clear visual cues.

**Files**: `src/App.tsx`, `src/components/AttackSimulator.tsx`

---

## 5. P2 — Polish

- Key lifecycle visualization
- Advanced spacecraft telemetry (attitude, fuel, subsystem health)
- Orchestrated demo animations
- Network topology animation
- Incident report export

---

## 6. P3 — Deferred

- Ed25519 signatures
- AES-GCM encryption (exists but not heavily used in demo)
- Key rotation/revocation
- CCSDS alignment
- SIEM integration
- Docker/Kubernetes
- Multi-satellite fleet
- Full orbital simulation

---

## 7. Recommended Execution Order

```text
1. Fix attacker independence — attacker on 3500 must generate attacks without trusted backend
   → Import simulator.ts client-side in attacker bundle, or create attacker-specific API
   
2. Create demo mode UI — one-click flow for judges
   → Add DemoMode component that sequences: valid command → replay → tamper → safe mode → recovery
   
3. Fix security event timeline for attacker view
   → Either create attacker-accessible read-only events endpoint, or show timeline in attacker UI
   
4. Update threat model documentation to required format
   → Rewrite ST02_Project_Docs/THREAT_MODEL.md with threat→vector→detection→prevention→response→recovery
   
5. Bind ServiceTopology to real-time data
   → Poll health endpoints, show actual service status
   
6. Test full end-to-end judge flow
   → Verify: valid command → accept → replay → block → tamper → block → attacks → safe mode → quarantine → recovery → normal
```

---

## 8. Critical Demo Path

```text
START
  →
  Ground Console (3000): Operator sends QUERY_TELEMETRY
  →
  Backend (4000): Authenticates GS-PRIMARY-01, verifies HMAC, checks replay, behavioral nominal
  →
  ACCEPT: Command executes, telemetry returned
  →
  Attacker (3500): Click "Replay Last Command"
  →
  Backend: Detects duplicate nonce/sequence → BLOCK
  →
  Security Event: REPLAY_DETECTED logged
  →
  Attacker: Click "Tamper Command"
  →
  Backend: HMAC mismatch → BLOCK
  →
  Security Event: TAMPER_DETECTED logged
  →
  Attacker: Click "Credential Compromise" (valid creds, imaging in eclipse)
  →
  Backend: Auth passes, but mission context conflict + behavioral anomaly → CRITICAL risk
  →
  SAFE MODE: Spacecraft enters protective mode, dangerous commands blocked
  →
  Security Event: SAFE_MODE_ENTERED logged
  →
  Attacker: Click "Destructive Burn" (valid creds, 6.2 m/s thruster)
  →
  Backend: Blocked by SAFE_MODE_LOCK
  →
  Attacker: Click "Quarantine Attacker"
  →
  Security Event: ATTACKER_QUARANTINED logged
  →
  Operator: Click "Recover System"
  →
  Backend: Verifies spacecraft health, clears safe mode
  →
  SYSTEM_RESTORED: Normal operations resume
  →
  END
```

---

## 9. Known Risks

### Functionality Failures
1. **Attacker cannot independently attack** — biggest risk. Judge expects attacker on 3500 to be able to generate attacks. Currently attacker UI sends intents to trusted backend.
2. **Recovery UI not obvious** — OPERATOR_RECOVER endpoint exists but no clear "Recover" button in attacker view
3. **Safe mode may not trigger on first attack** — needs multiple attacks or high-risk scenario to reach CRITICAL threshold

### Integration Failures
4. **Security middleware blocks attacker from viewing events** — attacker can't see the timeline of its own attacks
5. **Quarantine not persisted** — backend restart clears quarantine state

### Startup/Runtime Failures
6. **Port collisions** — start.bat detects but doesn't auto-resolve; manual intervention needed
7. **Backend startup time** — SQLite migrations + state rehydration can take 2-3 seconds; frontends may start before backend is ready

### Security Weaknesses
8. **All services on localhost** — network segmentation is logical, not physical. Judge may note this.
9. **Service tokens in .env not enforced** — security middleware checks origin, not service tokens

### Presentation Issues
10. **No explicit "Demo Mode" label** — judges may not understand the flow without guidance
11. **Security event log format** — needs to match the timeline format in judge-todo.md Section 15

---

## 10. Stop Conditions

The implementation is "good enough for tonight" when:

- [ ] Attacker on 3500 can independently generate and send attack commands
- [ ] Judge can complete full flow: valid command → accept → replay → block → tamper → block → safe mode → recovery → normal
- [ ] Each step shows clear visual feedback (BLOCK verdict, SAFE_MODE indicator, RECOVERED indicator)
- [ ] Security event timeline shows the sequence of events with timestamps
- [ ] Threat model document follows required format
- [ ] start.bat launches all 4 services without errors
- [ ] stop.bat stops all services cleanly
- [ ] Backend tests pass (6/6)
- [ ] Typecheck passes (root + backend)

---

## Summary Statistics

- **COMPLETE requirements**: 12
- **PARTIAL requirements**: 6
- **MISSING requirements**: 3
- **BROKEN requirements**: 0
- **P0 tasks**: 3
- **P1 tasks**: 3
- **P2 tasks**: 5
- **P3 tasks**: 6

### Single Most Important Missing Feature
**Attacker independence** — the attacker service on port 3500 must be able to generate and send attack commands without relying on the trusted backend to manufacture hostile envelopes. This is the biggest gap between current implementation and judge-todo.md Section 11.

### Recommended First Implementation Task
**Enable attacker to generate attacks client-side** — import the attack simulator logic into the attacker frontend bundle so that when a judge clicks "Replay Attack" on port 3500, the attacker generates the replay envelope and sends it directly to the backend's /api/commands endpoint, where it gets blocked and logged as a security event.
