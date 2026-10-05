# ST-02 — Technical Requirements Document (TRD)

**Status:** Baseline / Authoritative

## 1. Architecture Style

MVP uses a modular architecture. Modules must communicate through explicit interfaces so they can later become event-driven.

## 2. Logical Components

- Ground Station Client
- Security Gateway
- Integrity Module
- Authentication Module
- Replay Protection Module
- Behavioral Analysis Module
- Mission Context Module
- Risk Engine
- Safety Policy Engine
- Response Engine
- Audit Logger
- Spacecraft Simulator
- Attack Simulator
- Dashboard

## 3. Command Envelope

Commands must be structured and versioned.

```json
{
  "header": {
    "spacecraft_id": "SAT-01",
    "command_id": "CMD-1042",
    "timestamp": "2026-10-03T16:30:21Z",
    "sequence_number": 1042,
    "nonce": "unique-value"
  },
  "payload": {
    "command_type": "CAPTURE_IMAGE",
    "parameters": {}
  },
  "security": {
    "key_id": "GS-01",
    "algorithm": "standard-approved-algorithm",
    "signature": "..."
  }
}
```

The exact cryptographic algorithm may be selected during implementation, but agents MUST use established standard libraries and MUST NOT invent cryptographic primitives.

## 4. Security Pipeline

```text
Receive
→ Parse
→ Integrity
→ Authentication
→ Replay
→ Behavioral Analysis
→ Mission Context
→ Risk Engine
→ Safety Policy
→ Response
→ Audit
```

Hard validation failures should stop further execution where appropriate.

## 5. Cryptography

Target architecture:

- encryption for confidentiality,
- digital signatures for authenticity/integrity,
- nonce for freshness,
- timestamp for freshness,
- sequence number for ordering/replay protection.

Key management must be simulated locally for the hackathon. No real spacecraft keys or production credentials.

> **Implementation note (D23):** the implemented integrity/authenticity mechanism is an
> HMAC-SHA256 authentication tag (symmetric MAC) using standard Web Crypto — not an
> asymmetric digital signature. Documentation and UI use "HMAC-based
> integrity/authentication" terminology. Confidentiality is AES-GCM-256 with
> server-side authenticated decryption (D24/D25 in DECISIONS.md).

## 6. Behavioral AI

MVP input:

- current command,
- recent command history,
- spacecraft state,
- relevant mission context.

MVP output:

- anomaly assessment,
- confidence,
- findings,
- explanation,
- suggested risk contribution.

The AI MUST NOT directly execute commands or independently switch spacecraft state.

## 7. Risk Engine

Risk is represented internally as 0–100.

Human-readable severity:

- 0–24: NORMAL
- 25–49: SUSPICIOUS
- 50–74: HIGH
- 75–100: CRITICAL

Thresholds are configuration, not architecture.

The risk engine combines:

- deterministic security results,
- behavioral assessment,
- mission context,
- spacecraft state,
- command criticality,
- safety constraints.

## 8. Response Policy

NORMAL:

- allow.

SUSPICIOUS:

- monitor,
- log,
- optionally require review.

HIGH:

- block dangerous command,
- alert operator,
- continue essential telemetry.

CRITICAL:

- enter safe mode,
- restrict dangerous operations,
- maintain essential telemetry,
- alert operator,
- require/prepare recovery procedure.

Automatic recovery must be conditional on stable state and absence of continuing threat; never use an unconditional timer as the only recovery condition.

## 9. Spacecraft Simulator — MVP

Initial state:

- battery
- temperature
- communication status
- operating mode

Later:

- power
- thermal
- camera
- navigation
- flight computer
- telemetry/state transitions.

## 10. Mission Context

MVP:

- structured mission state,
- mission documents,
- context resolver.

Future:

- mission context agent that retrieves relevant evidence from both.

## 11. Audit Event

Every security decision should record:

- event ID,
- timestamp,
- command ID,
- spacecraft ID,
- operator/key identity,
- integrity result,
- authentication result,
- replay result,
- behavioral assessment,
- relevant mission context,
- risk score/severity,
- final decision,
- response.

Future forensic audit may additionally include network metadata, telemetry, state changes, attack actions, and system events.

## 12. Interface Requirements

Each module should expose a clear input/output contract.

Preferred pattern:

```text
Input → Module → Result
```

Security results should be serializable and auditable.

## 13. Reliability

- Invalid commands must not crash the gateway.
- Missing optional context must degrade safely.
- AI failure must fall back to deterministic safety policy.
- Logging failure must not silently change a security decision.
- Replayed commands must never execute.
- Tampered commands must never execute.

## 14. Testing

Minimum tests:

- valid command passes,
- modified payload fails integrity,
- unknown credential fails authentication,
- replayed nonce/sequence fails,
- malformed command rejected,
- high-risk dangerous command blocked,
- critical scenario triggers safe mode,
- telemetry remains available in safe mode,
- AI unavailable fallback works,
- audit event contains decision evidence.
