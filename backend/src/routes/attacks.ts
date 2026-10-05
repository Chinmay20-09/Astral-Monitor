import { Router } from 'express';
import { AttackService, ATTACK_SCENARIO_NAMES, AttackScenarioName } from '../services/attackService';
import { HttpError, asyncHandler } from '../middleware/errorHandler';

export interface AttackRouteDeps {
  attackService: AttackService;
}

/**
 * Controlled LOCAL attack simulation endpoint.
 *
 * POST /api/attacks { scenario } → manufactures the hostile envelope
 * server-side and runs it through the unchanged security gateway pipeline.
 * Scenarios are controlled simulation metadata only (see Docs/THREAT_MODEL.md).
 */
export function attacksRouter(deps: AttackRouteDeps): Router {
  const router = Router();

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const scenario = req.body?.scenario;
      if (typeof scenario !== 'string' || !ATTACK_SCENARIO_NAMES.includes(scenario as AttackScenarioName)) {
        throw new HttpError(
          400,
          `Unknown attack scenario. Valid scenarios: ${ATTACK_SCENARIO_NAMES.join(', ')}`
        );
      }
      const outcome = await deps.attackService.runScenario(scenario as AttackScenarioName);
      res.status(201).json(outcome);
    })
  );

  return router;
}
