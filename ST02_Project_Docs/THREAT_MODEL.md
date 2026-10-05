# OrbitShield — Threat Model

## 1. Attacker Model

The attacker simulator assumes an attacker may:
1. intercept traffic
2. modify existing commands
3. inject new commands
4. obtain/compromise legitimate credentials
5. replay captured commands
6. passively observe traffic

Priority:
1. interception
2. modification/injection
3. credential compromise
4. replay
5. passive observation

## 2. Attack Surface

### Ground Server (3000) — TRUSTED
- Public-facing UI
- API endpoints for commands, telemetry
- Communication with SpaceTwin and Backend

### SpaceTwin (3100) — TRUSTED
- Digital twin visualization
- API endpoints for spacecraft state
- Communication with Ground and Backend

### Attacker (3500) — UNTRUSTED
- Intentionally untrusted service
- Cannot access Ground APIs
- Cannot access SpaceTwin APIs
- Cannot access Backend
- Cannot access Database

### Backend (4000) — INTERNAL
- API enforcement point
- Database access
- Security pipeline
- Not exposed as public UI

## 3. Threats and Defenses

| Threat | Defense | Expected Result |
|--------|---------|-----------------|
| Unauthorized Ground access from attacker | Service identity + origin validation | 403 Blocked |
| Unauthorized SpaceTwin access from attacker | Service identity + origin validation | 403 Blocked |
| Backend discovery from attacker | Backend denies untrusted origins | Blocked |
| Command modification | HMAC-SHA256 integrity tag | Block |
| Unauthorized injection | Authentication + key registry | Block |
| Credential compromise | Behavioral + contextual analysis | Escalate/block/safe mode |
| Replay | nonce + timestamp + sequence | Block |
| Passive observation | AES-GCM-256 encryption | Protect contents |
| Malformed command | Schema validation | Reject |
| AI hallucination | Deterministic safety policy | AI cannot execute |
| Mission-conflicting action | Mission context + policy | Block/escalate |
| Destructive action in emergency | Safety constraints | Block |

## 4. Attack Scenarios

### Scenario A — Unauthorized Ground Request
```
Attacker (3500) → Ground (3000)
GET /api/internal/...
```
Expected: 403 Forbidden + security event

### Scenario B — SpaceTwin Access Attempt
```
Attacker (3500) → SpaceTwin (3100)
```
Expected: 403 + threat event

### Scenario C — Backend Discovery Attempt
```
Attacker (3500) → Backend (4000)
```
Expected: Blocked, no implementation details exposed

### Scenario D — Invalid Authentication
Send invalid/expired token
Expected: 401 Unauthorized + security telemetry

### Scenario E — Request Flood
20 controlled requests in short interval
Expected: Rate limit detected, quarantine

## 5. Quarantine

When attacker crosses threshold:
- Status: QUARANTINED
- All attacker → trusted service access blocked
- Attacker UI still accessible (contained)

## 6. Recovery

Recovery is initiated by security layer:
1. Verify Ground health
2. Verify SpaceTwin health
3. Verify Backend health
4. Verify Database health
5. Restore trusted communication
6. Record recovery

## 7. Database Protection

SQLite database is private:
- Never exposed to browser
- Never exposed to attacker
- Only backend process can access
- All queries parameterized

## 8. Security Principle

DEFAULT DENY
EXPLICIT ALLOW
LEAST PRIVILEGE
SERVICE IDENTITY
NETWORK SEGMENTATION
QUARANTINE
RECOVERY

NOT DEFAULT ALLOW.
