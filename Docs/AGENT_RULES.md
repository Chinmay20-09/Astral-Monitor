# ST-02 — AI Agent Rules / Anti-Distraction Contract

## Purpose

This file is mandatory context for every AI coding, research, architecture, UI, testing, or documentation agent working on ST-02.

## 1. Source of Truth

Priority order:

1. PRD.md
2. TRD.md
3. ARCHITECTURE.md
4. THREAT_MODEL.md
5. ROADMAP.md
6. AGENT_RULES.md
7. Agent suggestions

If an agent suggestion conflicts with the documents above, the agent MUST flag the conflict instead of silently changing scope.

## 2. Core Product Definition

ST-02 is:
> A simulated security gateway protecting spacecraft command traffic from tampering, unauthorized commands, credential compromise, replay, and passive interception, with contextual risk analysis and safe response.

## 3. Do Not Distract

Agents MUST NOT introduce unrelated:

- chatbots,
- generic RAG systems,
- blockchain,
- NFT/token systems,
- unnecessary microservices,
- Kubernetes,
- cloud infrastructure,
- real satellite integrations,
- real offensive cyber operations,
- custom cryptography,
- autonomous spacecraft control,
- LLM agents whose purpose is unrelated to security decisions.

## 4. AI Boundary

AI may:

- analyze behavior,
- summarize evidence,
- identify anomalies,
- explain decisions,
- suggest risk.

AI may NOT:

- directly execute spacecraft commands,
- bypass authentication,
- override integrity checks,
- override deterministic safety constraints,
- independently activate unsafe spacecraft actions.

## 5. MVP Discipline

Before adding a feature, ask:

1. Does it directly support ST-02?
2. Does it strengthen the primary attack demonstration?
3. Is it required for the current roadmap phase?
4. Can it be postponed to P1/P2?

If the answer is mostly no, postpone it.

## 6. Architecture Discipline

Do not create a new service/module unless:

- it has a clear responsibility,
- an existing module cannot reasonably own it,
- its interface is documented.

Prefer modules over microservices for MVP.

## 7. Security Discipline

Never:

- invent cryptographic algorithms,
- store secrets in source control,
- send real credentials,
- target real systems,
- weaken security checks to make a demo pass.

Use established libraries and local simulation.

## 8. Changes

Before changing architecture:

- state the reason,
- identify affected requirements,
- update the relevant document,
- obtain explicit project-owner approval.

## 9. Coding Agent Output

Every implementation agent should report:

- files changed,
- requirements satisfied,
- tests added/run,
- known limitations,
- next dependency.

Do not generate speculative features "for future use" unless requested.

## 10. Conflict Resolution

If requirements are ambiguous:

- preserve the smallest interpretation consistent with PRD/TRD,
- ask the project owner when the decision affects architecture or security,
- never silently expand scope.

## 11. Current Priority

The immediate target is:

```text
VALID COMMAND
→ CRYPTOGRAPHIC VALIDATION
→ SPACECRAFT SIMULATOR
→ ATTACK SIMULATOR
→ BEHAVIORAL AI
→ MISSION CONTEXT
→ RISK
→ SAFE MODE
→ EXPLAINABLE DASHBOARD
```

Everything else is secondary.
