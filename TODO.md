# ORBITSHIELD — COMPETITION NIGHT TODO

## DEMO STORY

Ground Operator  
      │  
      ▼  
Create Spacecraft / Mission  
      │  
      ▼  
Ground Console :3000  
      │  
      ├───────────────┐  
      │               │  
      ▼               ▼  
Air/Spacecraft Twin   Attacker  
:3010                  :3500  
      │               │  
      └───────┬───────┘  
              ▼  
        Shared Backend  
            :4000  
              │  
              ▼  
        AI Analysis  
              │  
              ▼  
 Natural-Language Operational  
     Dashboard  
              │  
              ▼  
    Operator understands  
      WHAT happened  
      WHY it matters  
      WHAT to do  

## P0 — MUST WORK BEFORE ANYTHING ELSE

- [ ] Backend starts successfully on :4000
- [ ] Backend health endpoint works
- [ ] Ground Console starts on :3000
- [ ] Air/Spacecraft Twin starts on :3010
- [ ] Attacker UI starts on :3500
- [ ] All three frontends communicate with the SAME backend :4000
- [ ] All three frontends can use the SAME active session

Do not proceed to AI work until these are working.

## P0.1 — FIX TWIN CSS

### CURRENT BUG

The Twin frontend at :3010 renders the application content,  
but the entire UI appears unstyled.

Observed:  

- React content renders  
- SVG/icons render  
- browser-default typography  
- native form controls  
- no application layout  
- no panels/cards  
- no backgrounds/borders  
- no intended spacing/styles  

### TASK

- [ ] Diagnose why CSS is not being loaded/applied on :3010
- [ ] Inspect `vite.twin.config.ts`
- [ ] Inspect Twin entry point
- [ ] Trace CSS imports
- [ ] Verify CSS file exists
- [ ] Verify CSS asset URL
- [ ] Verify CSS HTTP response
- [ ] Check for incorrect Vite root/base/publicDir
- [ ] Check for CSS returning 404
- [ ] Check for CSS URL returning index.html
- [ ] Check PostCSS/Tailwind/etc. only if the project actually uses them
- [ ] Fix the ACTUAL root cause
- [ ] Verify :3010 visually loads with application styling

Important:  
Do NOT redesign the Twin UI.  
Do NOT replace the CSS framework.  
Do NOT rewrite the frontend.  
Fix only the loading/application problem.

## P1 — ONE ONBOARDING FLOW

Goal:  
A new user must be able to create one spacecraft/session without  
manually editing configuration files.

- [ ] Add/repair "New Mission" or "New Spacecraft" flow

Minimum fields:  

- [ ] Spacecraft name  
- [ ] Spacecraft ID  
- [ ] Basic spacecraft/orbit information supported by existing model  
- [ ] Ground station selection/configuration if already supported  
- [ ] Create Session button  

After creation:  

- [ ] Session becomes active  
- [ ] Ground Console shows active spacecraft  
- [ ] Twin can access same active session  
- [ ] Attacker can access same active session  

Keep onboarding SHORT.  
No multi-page enterprise wizard.  
No authentication system.  
No complex database.

## P1 — TWIN TELEMETRY

Goal:  
The Twin must produce meaningful data that can be analyzed.  
Reuse existing simulator/data model.

- [ ] Twin displays spacecraft state  
- [ ] Twin produces telemetry/input data  

Use existing fields where available, such as:  

- attitude  
- position  
- velocity  
- temperature  
- power  
- communications/link status  
- sensor state  
- command/input state  
- anomaly state  

Do NOT build an elaborate physics simulator.  
The data only needs to be believable and useful for the demo.

## P1 — TWIN → BACKEND

- [ ] Twin sends relevant telemetry/input to backend :4000  
- [ ] Backend accepts/stores/processes the current state using  
    the existing architecture  
- [ ] Ground Console can access the current Twin state  
- [ ] Active session remains consistent across screens  

## P1 — AI NATURAL-LANGUAGE ANALYSIS

Goal:  
Turn Twin telemetry into an understandable operator-facing analysis.  
Input: Actual Twin/backend telemetry.  

Output should conceptually contain:  

- severity  
- summary  
- observations  
- anomalies  
- recommended action  

Example:

AI MISSION ANALYSIS  

Status: Elevated Risk  

"The spacecraft is showing an increasing attitude deviation  
while communication quality is degrading. Power remains nominal."

Observations:  

- Attitude deviation increasing  
- Link quality degrading  
- Power nominal  

Recommended action:  
"Verify attitude-control telemetry and investigate the  
communications link before issuing additional commands."

- [ ] Backend AI analysis endpoint/service exists  
- [ ] Analysis uses ACTUAL Twin data  
- [ ] Ground Console displays analysis  
- [ ] Analysis is natural language  
- [ ] Severity is visible  
- [ ] Recommended action is visible  

## P1 — AI PROVIDER / FALLBACK

First inspect the existing repository.

If an AI provider is already configured:  

- [ ] Reuse existing provider  
- [ ] Keep credentials server-side  
- [ ] Never expose API keys in frontend  

If no provider is configured:  

- [ ] Implement a small provider abstraction  
- [ ] Implement deterministic local analysis fallback  
- [ ] Demo must work without external AI availability  

The local fallback must still produce useful natural-language  
analysis from actual telemetry.  

Do NOT spend tonight building an elaborate AI platform.

## P1 — ATTACKER DEMO

Goal:  
Have ONE demonstrable attack/anomaly scenario.

- [ ] Attacker UI loads on :3500  
- [ ] Existing attacker functionality works  

OR  

- [ ] Add ONE simple simulated attack/anomaly using the existing  
    backend/session architecture  

Desired demo:  

Attacker action  
      ↓  
Shared backend/session  
      ↓  
Twin state changes  
      ↓  
AI detects/analyzes change  
      ↓  
Ground Console explains it  

Do NOT build multiple attack types tonight.  
One reliable scenario is better than five broken ones.

## P1 — END-TO-END DEMO

This is the FINAL acceptance test.

- [ ] Start complete system  
- [ ] Open Ground Console :3000  
- [ ] Create spacecraft/session through onboarding  
- [ ] Confirm active spacecraft/session  
- [ ] Open Twin :3010  
- [ ] Confirm Twin is styled correctly  
- [ ] Confirm Twin telemetry is visible  
- [ ] Confirm telemetry reaches backend  
- [ ] Confirm Ground Console receives Twin state  
- [ ] Confirm AI analysis appears  
- [ ] Open Attacker :3500  
- [ ] Trigger ONE supported anomaly/attack  
- [ ] Confirm Twin/backend state changes  
- [ ] Confirm AI analysis changes  
- [ ] Confirm Ground Console explains what happened  
- [ ] Confirm recommended action is shown  
- [ ] Confirm no frontend crashes  
- [ ] Confirm backend remains healthy  

## P2 — ONLY IF EVERYTHING ABOVE WORKS

These are optional.  
Do NOT work on them if any P0/P1 item is incomplete.

- [ ] Minor visual polish  
- [ ] Better loading/error states  
- [ ] Better demo labels  
- [ ] Small UX improvements  

STOP HERE.  
Do not add features beyond this list tonight.

## EXPLICITLY OUT OF SCOPE TONIGHT

DO NOT work on:  

- complex database architecture  
- PostgreSQL migration  
- authentication  
- user accounts  
- RBAC  
- cloud deployment  
- Kubernetes  
- Docker optimization  
- CI/CD redesign  
- production infrastructure  
- advanced orbital physics  
- advanced attack simulation  
- multiple AI agents  
- RAG  
- vector databases  
- model training  
- elaborate observability  
- telemetry history platform  
- enterprise security hardening  
- complete UI redesign  
- new design system  
- unnecessary dependency upgrades  
- broad refactoring  
- documentation cleanup  
- unrelated bugs  
- speculative features  

If something is not required for the demo flow above,  
IGNORE IT TONIGHT.

## PRIORITY RULE

When deciding what to work on, ALWAYS use:  

P0 > P1 > P2  

And within P1:  

Ports/Frontend  
    ↓  
CSS  
    ↓  
Onboarding  
    ↓  
Twin telemetry  
    ↓  
Backend connection  
    ↓  
AI analysis  
    ↓  
Attacker scenario  
    ↓  
End-to-end demo  

Never skip a blocker to work on a later feature.

## DEFINITION OF DONE

OrbitShield is DONE FOR TONIGHT when a judge can watch this:  

1. Operator creates a spacecraft.  
2. Ground Console shows the active mission.  
3. Twin shows spacecraft state.  
4. Something abnormal happens.  
5. OrbitShield receives the changed telemetry.  
6. AI explains the situation in natural language.  
7. Operator sees severity + explanation + recommended action.  
8. The three interfaces visibly operate as one system.  
9. The Interface should be isolated even if system is same, remove the UI button to change between screens and make default specific to type, Ground:3000 should open ground screen, Space:3100 should have default space twin screen,Attacker:3500 should open defa
If that works reliably, STOP.  
Do not continue adding features.

## CLI AGENT RULE

Before starting ANY task:  

1. Read TODO.md.  
2. Find the highest-priority incomplete item.  
3. Work ONLY on that item.  
4. Verify it.  
5. Mark it complete only after actual verification.  
6. Move to the next item.  

If a discovered issue is unrelated to the current TODO item:  
DO NOT fix it.  
Record it under:  

"DISCOVERED BUT OUT OF SCOPE"  

and continue.  

If a task becomes unexpectedly large:  
STOP and report the blocker instead of expanding scope.  

The goal is a reliable competition demo, NOT a perfect production system.
