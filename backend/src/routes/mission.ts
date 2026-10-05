import { Router } from 'express';
import { MissionService } from '../services/missionService';
import { HttpError } from '../middleware/errorHandler';
import { config } from '../config';

export interface MissionRouteDeps {
  missionService: MissionService;
}

const VALID_PHASES = ['UMBRA_ECLIPSE', 'FULL_SUN_IMAGING'];

/**
 * Mission context endpoints.
 *
 * GET  /api/mission                  → full structured mission state (phases, constraints, documents)
 * GET  /api/mission/:spacecraftId    → same, for a specific vehicle id
 * POST /api/mission/phase            → switch the active orbital phase (persisted)
 */
export function missionRouter(deps: MissionRouteDeps): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ mission: deps.missionService.getMissionState() });
  });

  router.get('/:spacecraftId', (req, res) => {
    if (req.params.spacecraftId !== config.defaultSpacecraftId) {
      throw new HttpError(404, `Unknown spacecraft "${req.params.spacecraftId}" — this simulation tracks ${config.defaultSpacecraftId}`);
    }
    res.json({ mission: deps.missionService.getMissionState() });
  });

  router.post('/phase', (req, res) => {
    const phase = req.body?.phase;
    if (typeof phase !== 'string' || !VALID_PHASES.includes(phase)) {
      throw new HttpError(400, `phase must be one of: ${VALID_PHASES.join(', ')}`);
    }
    const mission = deps.missionService.setPhase(phase as 'UMBRA_ECLIPSE' | 'FULL_SUN_IMAGING');
    res.json({ mission });
  });

  return router;
}
