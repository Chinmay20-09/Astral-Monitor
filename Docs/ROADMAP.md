# ST-02 — Implementation Roadmap

## Phase 0 — Freeze Scope

Deliverables:

- PRD
- TRD
- architecture
- threat model
- agent rules

Status: COMPLETE

## Phase 1 — Core Command Path

Goal:
A legitimate structured command reaches the spacecraft simulator.

Implement:

- command models
- ground station client
- gateway skeleton
- spacecraft simulator V1
- basic audit logging

Acceptance:

```text
Ground Station → Gateway → Spacecraft
```

## Phase 2 — Cryptographic Gateway

Implement:

- encryption
- digital signature
- authentication
- nonce
- timestamp
- sequence number
- replay detection

Acceptance:

- valid command executes,
- tampered command blocks,
- unauthorized command blocks,
- replay blocks.

## Phase 3 — Behavioral Intelligence

Implement:

- command history
- spacecraft state input
- AI behavioral assessment
- structured AI result
- AI failure fallback

Acceptance:

- normal behavior is recognized,
- suspicious sequence generates evidence,
- AI cannot directly change spacecraft state.

## Phase 4 — Mission Context + Risk

Implement:

- mission.json/current_state.json
- mission documents
- context resolver
- contextual risk score
- safety policy

Acceptance:
Same command can produce different outcomes depending on mission/state.

## Phase 5 — Attack Simulator

Implement buttons/scenarios:

- tampering
- injection
- credential compromise
- replay
- passive interception

Primary demo:
multi-stage attack.

## Phase 6 — Safe Mode

Implement:

- dangerous-command restrictions
- telemetry preservation
- alert
- conditional recovery
- operator re-authentication path

## Phase 7 — Judge Dashboard

Implement:

- security overview
- live command stream
- explainable incident panel
- attack visualization

## Phase 7.5 — Persistent Backend (COMPLETE)

Implemented:

- local Node.js/Express backend hosting the unchanged security pipeline
- SQLite persistence (commands, security_events, spacecraft_state, mission_state, ground_stations, replay_state)
- backend-owned credential registry + server-side envelope origination, HMAC signing and AES-GCM decryption (browser holds no secrets)
- transactional persistence of command + audit event + replay state + vehicle state
- startup rehydration of per-sender replay protection (spacecraft_id + key_id), nonce cache and behavioral history
- dashboard consumes backend over local HTTP API as a pure operator console
- backend HTTP test suite (health, pipeline outcomes, replay, persistence, rollback, secret non-exposure)

Acceptance:

- audit trail and vehicle state survive browser refresh and server restart
- replay of a command captured before a restart is still blocked
- frontend production bundle contains no credential material

## Phase 8 — Expansion

Only after MVP is stable:

- subsystem simulation
- telemetry/state transitions
- hybrid rule + ML
- mission context agent
- event-driven architecture
- forensic audit
- full command center

## Definition of Done for MVP

A judge can:

1. observe normal operation,
2. trigger tampering,
3. see integrity rejection,
4. trigger credential compromise,
5. see cryptographic checks pass,
6. see behavioral/contextual detection,
7. see risk score escalate,
8. see safe mode activate,
9. inspect why the decision was made,
10. observe telemetry remain available.
