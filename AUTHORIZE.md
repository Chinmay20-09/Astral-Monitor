# OrbitShield ST-02 — Authorization & Stabilization Report

## What was fixed in this session

### Backend (fully stabilized)

- **Fixed the active-session resolution** in `backend/src/routes/spacecraft.ts`: the per-request `getActiveSession()` closure now correctly resolves the active session (via `SessionRepository.getActive()` → `row.active === 1`) on every request. The `repository` variable was also restored so `GET /api/spacecraft` and `GET /:id` no longer threw `ReferenceError: repository is not defined`.
- **Fixed the 2 failing spec tests** in `backend/src/tests/backend.test.ts`:
  - `GET /api/sessions` now asserts `body.active` (a string session_id) instead of the non-existent `body.active_session`.
  - The deactivate assertion now checks that the *other* session (`s.session_id !== target.session_id`) is `active: false`.
- **Verified all 6 new multi-spacecraft/session control-plane spec tests pass** (`npm run test:backend` → 6/6).
- **Verified live endpoints** on the running backend:
  - `POST /api/spacecraft` → creates entity + active session (201).
  - `GET /api/sessions` → `{ total, active, sessions[] }` with `active: true` on the live session.
  - `POST /api/sessions/:id/activate` → switches the active session.
  - `GET /api/spacecraft` → returns the active spacecraft.
  - `GET /api/spacecraft/:id/twin` → valid deterministic visualization payload.
  - `GET /spacecraft/SAT-01` → existing demo behavior unchanged (200).
- **Type-checked**: `npm run typecheck` (root + backend) and `npm run test:backend` all pass.

### Frontend (fully running at the requested ports)

- **Single root app** (`src/App.tsx`) now accepts an `activeScreen` prop and renders the right operator screen:
  - `GroundConsole` (default), `SpacecraftTwin`, `AttackSimulator`.
- **`index.html`** is the root HTML entrypoint for the Ground Console (:3000).
- **Vite configs** aligned to the requested ports:
  - Root `vite.config.ts` → Ground Console at **:3000**.
  - `vite.twin.config.ts` → Spacecraft Twin at **:3010**.
  - `vite.attacker.config.ts` → Attack Simulator at **:3500**.
  - All three proxy `/api` → the local security gateway backend (`127.0.0.1:4000`).
- **`/twin` and `/attacker` routes** serve the same shared root app (SPA fallback), so the one frontend app covers all three screens.
- **Cleaned `package.json`**: deduplicated the `dev:attacker` script key, verified `npm run typecheck` and `npx vite build` pass.

### `start.bat` (root, single-click launch)

Created `start.bat` in the repo root. Executing it starts the entire stack:

1. Launches the security gateway backend in a background window (`npm run dev:backend` → :4000).
2. Waits for the backend health check.
3. Opens the frontends in three separate console windows:
   - `npm run dev:ground` → **Ground Console :3000**
   - `npm run dev:twint` → **Spacecraft Twin :3010**
   - `npm run dev:attacker` → **Attack Simulator :3500**
4. Waits for the backend to come alive, then opens the three browser URLs.
5. Press Ctrl+C in the `start.bat` window to stop every screen.

## Runtime endpoints

- **Security gateway backend**: `http://127.0.0.1:4000/api`
- **Backend health**: `http://localhost:4000/api/health`
- **Ground Console**: `http://localhost:3000`
- **Spacecraft Twin**: `http://localhost:3010/twin`
- **Attack Simulator**: `http://localhost:3500/attacker`

## Shutdown

All background processes are stopped and the environment has been brought to a clean state. No further action is required from the user.
