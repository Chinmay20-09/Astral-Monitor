# ST-02 — Cyber Attack Detection & Safe-Command Gateway for Satellite Ground Stations

## Product Requirements Document (PRD)

**Status:** Baseline / Authoritative  
**Problem Statement:** ST-02  
**Primary Goal:** Build a simulated security gateway between a ground station and spacecraft that validates commands, detects suspicious behavior, blocks replay/tampering, and places the spacecraft into a protected safe state for high-confidence threats.

## 1. Product Vision

The system is a security control plane for spacecraft command traffic. It must distinguish:

- authentic vs unauthentic commands,
- intact vs tampered commands,
- fresh vs replayed commands,
- normal vs suspicious behavior,
- mission-consistent vs mission-conflicting actions.

AI provides intelligence and explanation. Deterministic security policy retains final authority.

## 2. Primary Actors

- Ground Station Operator: sends legitimate commands.
- Security Gateway: validates, analyzes, decides, logs, and responds.
- Spacecraft Simulator: executes accepted commands and exposes state/telemetry.
- Attack Simulator: generates controlled adversarial traffic.
- Security Operator/Judge: observes decisions and explanations.

## 3. MVP User Journey

1. Operator sends a valid structured command.
2. Gateway verifies integrity.
3. Gateway authenticates the sender.
4. Gateway checks freshness/replay protection.
5. Gateway analyzes behavior using command history + spacecraft state.
6. Mission context is resolved from structured state and documents.
7. Risk engine produces a 0–100 score and severity.
8. Deterministic safety constraints combine with AI assessment.
9. Gateway returns ALLOW, BLOCK, or SAFE MODE.
10. A complete explainable security event is stored.
11. Dashboard displays the decision and evidence.

## 4. Core Features

### P0 — Mandatory MVP

- Structured spacecraft command protocol.
- Command integrity verification using digital signatures.
- Command authentication.
- Encrypted command transport.
- Replay protection using nonce + timestamp + sequence number.
- Modular security gateway.
- Basic spacecraft simulator:
  - battery
  - temperature
  - communication
  - mode
- Behavioral AI assessment using:
  - current command
  - recent command history
  - spacecraft state
- Mission context using:
  - structured mission state
  - mission documents
- Contextual risk engine with:
  - numerical score 0–100
  - NORMAL / SUSPICIOUS / HIGH / CRITICAL severity
- Deterministic safety constraints.
- Response engine:
  - allow
  - monitor/log
  - block dangerous command
  - safe mode
- Explainable security event.
- Attack Simulator.
- Dashboard:
  - security overview
  - live command stream
  - explainable incident panel.

### P1 — After MVP

- Subsystem simulation: power, thermal, camera, navigation, flight computer.
- Telemetry-driven state transitions.
- More attack scenarios.
- Better behavioral anomaly detection.
- More detailed mission procedures.
- Recovery/re-authentication workflow.

### P2 — Ideal / Future

- Event-driven security architecture.
- Full spacecraft simulation.
- Mission Context Agent over documents + live state.
- Hybrid rule + ML anomaly detection.
- Full forensic audit trail.
- Full spacecraft command center.
- Advanced red-team simulation.

## 5. Primary Hackathon Demonstration

The main story is a multi-stage attack:

NORMAL OPERATION
→ interception
→ command tampering
→ integrity blocks attack
→ attacker obtains legitimate credentials
→ cryptographic checks pass
→ attacker behaves abnormally
→ mission context conflicts with behavior
→ contextual risk becomes CRITICAL
→ dangerous commands restricted
→ telemetry maintained
→ operator alerted
→ spacecraft enters safe mode.

## 6. Non-Goals

Do NOT build:

- a real spacecraft control system,
- real satellite communications,
- real orbital control,
- autonomous AI authority over spacecraft,
- offensive cyber tooling against real systems,
- custom cryptography,
- a full physical spacecraft digital twin in the MVP,
- a generic chatbot unrelated to security decisions.

## 7. Product Principles

1. Security checks are layered.
2. AI is advisory, never final authority.
3. Safety policy can override AI recommendations.
4. Every important decision must be explainable.
5. Mission context changes command risk.
6. Safe mode must preserve essential telemetry.
7. MVP features must remain independently testable.
8. Prefer deterministic simulation over fake complexity.
