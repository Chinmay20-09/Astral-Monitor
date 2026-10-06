# ADR-003: Attacker Boundary and Demo Exception

**Status:** Accepted
**Date:** 2026-10-06
**Owner:** Developer 3 (Attacker/Demo) + Developer 1 (Security/Backend)

---

## Context

The ST-02 competition requires an attacker simulator on port 3500 that can demonstrate attacks. We needed to decide:
- What can the attacker access?
- Can the attacker generate attacks independently?
- Can the attacker see security events?
- How do we balance demo capability with security?

---

## Decision

### Attacker Trust Zone

The attacker on port 3500 is classified as **UNTRUSTED** by `backend/src/middleware/security.ts`:

```typescript
const UNTRUSTED_ORIGINS = [
  'http://localhost:3500',
  'http://127.0.0.1:3500',
];
```

### Access Policy

| Endpoint | Attacker Access | Reason |
|----------|-----------------|--------|
| `POST /api/commands` | ✅ ALLOWED | Explicit exception — attacker submits hostile envelopes for demo |
| `POST /api/commands/*` | ✅ ALLOWED | All command submission paths |
| ALL other endpoints | ❌ BLOCKED (403) | Privileged access denied |

**Only `/api/commands` and `/api/commands/*` are accessible from the attacker.** This is the explicit exception that enables the demo.

### Attacker Capabilities

1. **Independent attack generation** — `src/attacker/attackerClient.ts` runs in the browser and generates hostile command envelopes client-side using Web Crypto API (HMAC-SHA256)
2. **Direct submission** — Envelopes are sent directly to `POST /api/commands` without going through the trusted backend
3. **Full pipeline processing** — Submitted envelopes go through all 10 gateway layers
4. **No credential access** — Attacker uses its own rogue credentials (`ATTACKER-ROGUE-GS`) or simulates stolen credentials (hardcoded demo key for CREDENTIAL_COMPROMISE scenario)

### Attacker Limitations

1. **Cannot view security events** — `SecurityEventLog` component requires trusted origin; attacker's fetch to `/api/security-events` returns 403
2. **Cannot access health, sessions, spacecraft, mission, ground stations** — All blocked at perimeter
3. **Cannot execute recovery** — Recovery requires trusted Ground origin (localhost:3000)
4. **Cannot access credential material** — `src/ground_station/client.ts` is Node-only, never imported by browser code

### Demo Exception Rationale

The `/api/commands` exception for attacker is intentional and limited:
- **Why allowed:** Judges need to see the attacker demonstrate attacks through the full pipeline
- **Why safe:** The gateway processes the envelope content (auth, integrity, replay, etc.) — the attacker's origin doesn't grant any privilege
- **Why not broader:** Allowing access to health, sessions, spacecraft state, or security events would expose operational information to the attacker

---

## Consequences

### Positive
- Attacker can demonstrate all 6 attack scenarios independently
- Judges see attacker blocked from privileged endpoints (security works)
- Gateway processes attacker commands through all layers (demo is realistic)
- No credentials leak to browser (attacker uses its own rogue keys or hardcoded demo key)
- Recovery cannot be spoofed from attacker (must come from trusted Ground)

### Negative
- Attacker cannot see the timeline of its own blocked attacks (UX limitation)
- Attacker's attack run log is local only (not persisted to backend audit — those are separate events)
- Demo exception requires careful maintenance — adding new endpoints requires checking if attacker should access them

### Neutral
- Attacker uses hardcoded demo credentials for CREDENTIAL_COMPROMISE (`orbitshield-svalbard-primary-sign-key-demo-2026`) — this is the same key as GS-PRIMARY-01, simulating stolen credentials
- Attacker's `sendAttack()` method doesn't send Origin header — relies on perimeter to classify the request
- Vite proxy forwards Origin header from browser, so backend sees `Origin: http://localhost:3500`

---

## Compliance

- PRD Section 4: Attack Simulator as core feature
- judge-todo.md Section 11: Attacker Simulator — Port 3500
- ADR-001: Service boundaries (attacker is UNTRUSTED zone)
- ADR-002: Security gateway (attacker commands go through full pipeline)
