import { Router } from 'express';
import { SecurityEventService } from '../services/securityEventService';
import { HttpError } from '../middleware/errorHandler';

export interface SecurityEventRouteDeps {
  securityEventService: SecurityEventService;
}

/**
 * Persisted audit trail — the explainability backbone of the system.
 *
 * GET /api/security-events            → recent security events (filterable)
 * GET /api/security-events/:eventId   → one full explainable audit event
 */
export function securityEventsRouter(deps: SecurityEventRouteDeps): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const limit = parseLimit(req.query.limit, 200);
    const decision = asDecision(req.query.decision);
    const events = deps.securityEventService.listEvents({
      limit,
      decision,
      spacecraftId: asString(req.query.spacecraft_id),
      attackType: asString(req.query.attack_type)
    });
    res.json({
      total: deps.securityEventService.count(),
      decisions: deps.securityEventService.countsByDecision(),
      events
    });
  });

  router.get('/:eventId', (req, res) => {
    const event = deps.securityEventService.getEvent(req.params.eventId);
    if (!event) {
      throw new HttpError(404, `Security event "${req.params.eventId}" not found in audit trail`);
    }
    res.json({ event });
  });

  return router;
}

const VALID_DECISIONS = ['ALLOW', 'MONITOR', 'BLOCK', 'SAFE_MODE'];

function parseLimit(raw: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1000) : fallback;
}

function asDecision(raw: unknown): string | undefined {
  const value = asString(raw);
  return value && VALID_DECISIONS.includes(value) ? value : undefined;
}

function asString(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}
