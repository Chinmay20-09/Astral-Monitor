import { Router } from 'express';
import { SessionService } from '../services/sessionService';
import { HttpError, asyncHandler } from '../middleware/errorHandler';

export interface SessionRouteDeps {
  sessionService: SessionService;
}

/**
 * Mission session management.
 *
 * GET  /api/sessions          → all sessions
 * POST /api/sessions          → create a new mission session (onboarding launch)
 * GET  /api/sessions/:id      → one session
 * POST /api/sessions/:id/activate → make this session the active mission
 */
export function sessionsRouter(deps: SessionRouteDeps): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const sessions = deps.sessionService.listSessions();
    const active = deps.sessionService.getActiveSession();
    res.json({ total: sessions.length, active: active?.session_id ?? null, sessions });
  });

  router.post('/', asyncHandler(async (req, res) => {
    const {
      spacecraft_id,
      name,
      mission_name,
      mission_type,
      orbit_type,
      orbit_altitude_km,
      ground_station,
      operator_name
    } = req.body ?? {};

    const missing = [
      'spacecraft_id', 'name', 'mission_name', 'mission_type', 'orbit_type',
      'orbit_altitude_km', 'ground_station', 'operator_name'
    ].filter(k => req.body?.[k] === undefined || req.body?.[k] === null || String(req.body?.[k]).trim() === '');

    if (missing.length > 0) {
      throw new HttpError(400, `Missing required onboarding fields: ${missing.join(', ')}`);
    }

    const created = deps.sessionService.createMissionSession(
      String(spacecraft_id),
      String(name),
      String(mission_name),
      String(mission_type),
      String(orbit_type),
      Number(orbit_altitude_km),
      String(ground_station),
      String(operator_name)
    );
    res.status(201).json({ session_id: created.session_id, spacecraft_id: created.spacecraft_id });
  }));

  router.get('/:sessionId', (req, res) => {
    const session = deps.sessionService.getSession(req.params.sessionId);
    if (!session) {
      throw new HttpError(404, `Session \"${req.params.sessionId}\" not found`);
    }
    res.json({ session });
  });

  router.post('/:sessionId/activate', asyncHandler(async (req, res) => {
    const session = deps.sessionService.getSession(req.params.sessionId);
    if (!session) {
      throw new HttpError(404, `Session \"${req.params.sessionId}\" not found`);
    }
    deps.sessionService.activateSession(session.session_id);
    res.json({ activated: session.session_id, spacecraft_id: session.spacecraft_id });
  }));

  return router;
}
