# ST-02 — Architecture Decision Record (Current Decisions)

| ID | Decision |
| --- | --- |
| D01 | Cover integrity, authentication, behavioral detection, replay protection, and confidentiality. |
| D02 | Final architecture is hybrid; MVP uses sequential modular processing. |
| D03 | Use structured spacecraft-like command envelopes. |
| D04 | Threat model includes interception, modification/injection, credential compromise, replay, passive observation. |
| D05 | Safe mode restricts dangerous operations first, preserves telemetry, and supports recovery/re-authentication. |
| D06 | MVP behavioral intelligence uses an AI/LLM approach; ideal architecture is hybrid rules + ML. |
| D07 | AI receives command, command history, spacecraft state, and relevant mission context. |
| D08 | Spacecraft simulator grows A → B → C → D: basic state → subsystems → state transitions → full simulation. |
| D09 | Command risk is contextual, not a fixed risk per command. |
| D10 | Security output is a full explainable verdict. |
| D11 | Attack Simulator is a first-class component. |
| D12 | Gateway is modular now; event-driven later. |
| D13 | Cryptographic target is encryption + digital signatures + replay metadata. |
| D14 | AI is advisory; deterministic safety constraints have final authority. |
| D15 | Mission context starts as documents + structured state; ideal is a context agent. |
| D16 | MVP dashboard focuses on overview + live command stream + explainable incident panel. |
| D17 | Primary attack demo is multi-stage. |
| D18 | Risk uses numerical 0–100 score + human severity levels. |
| D19 | MVP audit captures security decision + relevant evidence; ideal is full forensic trail. |
| D20 | Gateway pipeline runs in a local Node.js/Express backend; browser is a pure operator console (view + intents only). |
| D21 | Persistence is local SQLite via better-sqlite3 (no ORM, parameterized SQL, file migrations). |
| D22 | Security state (replay nonces, sequence, behavioral history, mission phase, vehicle state) rehydrates from SQLite at startup so guarantees survive restarts. |
| D23 | Cryptography implementation is HMAC-SHA256 (symmetric MAC) for integrity/authentication + AES-GCM-256 for confidentiality; documentation and UI say "HMAC-based integrity/authentication", never "digital signature". |
| D24 | The authoritative credential registry, envelope origination/signing/encryption and AES-GCM decryption are backend-only; the frontend bundle must contain no secret material (verified by build check). |
| D25 | Replay state is tracked per (spacecraft_id, key_id) and persisted (replay_state table); it only advances for cryptographically verified commands. Command + audit event + replay state + vehicle state are persisted in one transaction. |

## Current Non-Negotiable Principles

- AI is not the final authority.
- No command bypasses security validation.
- No real spacecraft/network targets.
- MVP stays modular and local.
- Explainability is a first-class feature.
- Mission context affects risk.
- Safe mode is protective and telemetry-preserving.
