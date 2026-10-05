import { Router } from 'express';
import { CommandRepository } from '../db/repositories/commandRepository';
import { GroundStationRepository } from '../db/repositories/groundStationRepository';
import { CommandService, OperatorCommandIntent } from '../services/commandService';
import { HttpError, asyncHandler } from '../middleware/errorHandler';
import { config } from '../config';

export interface CommandRouteDeps {
  commandService: CommandService;
}

/**
 * Command intake — the entry points of the security pipeline.
 *
 * POST /api/commands            → run a raw (possibly hostile) command envelope
 *                                 through the full gateway pipeline
 * POST /api/commands/operator   → operator console intent; the backend resolves
 *                                 the credential, signs (+ encrypts) server-side
 *                                 and runs the full pipeline
 * GET  /api/commands            → recently processed commands (persisted trail)
 * GET  /api/commands/next-sequence → monotonic sequence sync (per key or global)
 */
export function commandsRouter(deps: CommandRouteDeps): Router {
  const router = Router();
  const commandRepository = new CommandRepository();

  // Process a (possibly hostile) command envelope through the unchanged security pipeline
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { envelope, attackType } = req.body ?? {};

      if (!envelope || typeof envelope !== 'object') {
        throw new HttpError(400, 'Request body must contain a command envelope object: { envelope, attackType? }');
      }

      const result = await deps.commandService.processCommand(envelope, {
        attackType: typeof attackType === 'string' ? attackType : undefined
      });

      res.status(201).json(result);
    })
  );

  // Operator console intent — signing + credential resolution happen server-side
  router.post(
    '/operator',
    asyncHandler(async (req, res) => {
      const { key_id, command_type, parameters, encrypt, attackType } = req.body ?? {};

      if (!command_type || typeof command_type !== 'string') {
        throw new HttpError(400, 'Operator intent requires a command_type string: { key_id?, command_type, parameters?, encrypt? }');
      }      if (parameters !== undefined && (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters))) {
        throw new HttpError(400, 'parameters must be a JSON object when provided');
      }
      if (typeof key_id === 'string' && key_id) {
        const known = new GroundStationRepository().list().some(st => st.key_id === key_id);
        if (!known) {
          throw new HttpError(400, `Unknown ground station key_id "${key_id}" — not in the spacecraft authorized registry`);
        }
      }

      const intent: OperatorCommandIntent = {
        key_id: typeof key_id === 'string' && key_id ? key_id : 'GS-PRIMARY-01',
        command_type: command_type as OperatorCommandIntent['command_type'],
        parameters: (parameters ?? {}) as Record<string, unknown>,
        encrypt: encrypt === true
      };

      const result = await deps.commandService.processOperatorCommand(intent, {
        attackType: typeof attackType === 'string' ? attackType : undefined
      });

      res.status(201).json(result);
    })
  );

  router.get('/', (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 100);
    const commands = commandRepository.list({
      limit,
      spacecraftId: asString(req.query.spacecraft_id),
      keyId: asString(req.query.key_id)
    });
    res.json({ total: commandRepository.count(), commands });
  });

  router.get('/next-sequence', (req, res) => {
    const keyId = asString(req.query.key_id);
    res.json({
      spacecraft_id: asString(req.query.spacecraft_id) ?? config.defaultSpacecraftId,
      ...(keyId ? { key_id: keyId } : {}),
      next_sequence: deps.commandService.getNextSequence(keyId)
    });
  });

  return router;
}

function parsePositiveInt(raw: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 1000) : fallback;
}

function asString(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}
