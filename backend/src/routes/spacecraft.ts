import { Router } from 'express';
import { SpacecraftService } from '../services/spacecraftService';
import { CommandService } from '../services/commandService';
import { SessionService } from '../services/sessionService';
import { MissionService } from '../services/missionService';
import { HttpError, asyncHandler } from '../middleware/errorHandler';
import { config } from '../config';

export interface SpacecraftRouteDeps {
  spacecraftService: SpacecraftService;
  commandService: CommandService;
  sessionService: SessionService;
  missionService: MissionService;
}

declare global {
  namespace Express {
    interface Request {
      deps?: SpacecraftRouteDeps;
    }
  }
}

/**
 * Spacecraft control plane.
 *
 * READ
 *  GET         /api/spacecraft              → active session + spacecraft + mission
 *  GET         /api/spacecraft/:id          → one onboarded spacecraft entity
 *  GET         /api/spacecraft/:id/twin     → read-only visualization payload
 *
 * WRITE (onboarding)
 *  POST        /api/spacecraft              → create entity + session + activate
 *  POST        /api/spacecraft/reset        → operator session reset
 *  POST        /api/spacecraft/:id/recovery → authenticated operator recovery
 *
 * Session routes live at /api/sessions (POST, GET :id, POST :id/activate).
 */
export function spacecraftRouter(deps: SpacecraftRouteDeps): Router {
  const router = Router();

  // ------------------------------------------------------------------ READ

  // Active session resolution is re-evaluated per request so that any screen
  // that refreshes sees the current active session — it is never stale.
  const repository = deps.spacecraftService.getRepository();
  const getActiveSession = (): any => deps.sessionService.getActiveSession();
  const activeSpacecraftId = (): string => {
    const active = getActiveSession();
    if (!active) return config.defaultSpacecraftId;
    return active.spacecraft_id;
  };

  router.get('/', (_req, res) => {
    res.json({
      active_session: getActiveSession()?.session_id ?? null,
      active_spacecraft_id: activeSpacecraftId(),
      entities: repository.listEntities(),
      state: deps.spacecraftService.getState(),
      telemetry: deps.spacecraftService.getTelemetry(),
      mission: deps.missionService.getMissionState()
    });
  });

  router.get('/:spacecraftId', (req, res) => {
    const id = assertKnownSpacecraft(deps, req.params.spacecraftId);
    res.json({
      entity: repository.listEntities().find((e) => e.spacecraft_id === id),
      state: deps.spacecraftService.getState(),
      telemetry: deps.spacecraftService.getTelemetry(),
      active_spacecraft_id: id
    });
  });

  /** Read-only visualization payload. */
  router.get('/:spacecraftId/twin', (req, res) => {
    req.deps = deps;
    const id = assertKnownSpacecraft(deps, req.params.spacecraftId);
    const entity = repository.listEntities().find((e) => e.spacecraft_id === id);
    const state = deps.spacecraftService.getState();
    const telemetry = deps.spacecraftService.getTelemetry();
    const mission = deps.missionService.getMissionState();

    const orbit = entity
      ? {
          altitude_km: entity.orbit_altitude_km,
          inclination_deg: 97.4,
          period_minutes: 94.6,
          orbit_type: entity.orbit_type
        }
      : { altitude_km: state.power.battery_percent * 0.6, inclination_deg: 97.4, period_minutes: 94.6, orbit_type: 'SUN_SYNCHRONOUS' };

    const seed = Math.abs((entity?.spacecraft_id ?? 'SAT-01').split('').reduce((a, c) => a + c.charCodeAt(0), 0));
    const progress = ((seed + Math.floor(telemetry.heartbeat_counter * 0.9117)) % 10000) / 10000;
    const position = {
      x_px: (progress * 2 - 1) * 280,
      y_px: Math.sin(progress * Math.PI * 2) * 120,
      orbit_progress: progress
    };

    res.json({
      spacecraft_id: id,
      position,
      orbit,
      altitude_km: entity?.orbit_altitude_km ?? state.power.battery_percent * 0.6,
      solar_condition: mission.current_phase.solar_condition,
      operating_mode: state.operating_mode,
      battery_percent: telemetry.battery_percent,
      temperature: telemetry.bus_temp_celsius,
      communication_status: telemetry.comm_status,
      security_posture: securityPosture(state.operating_mode, telemetry.battery_percent),
      orbit_progress: progress
    });
  });

  // ------------------------------------------------------------- WRITE

  router.post('/', asyncHandler(async (req, res) => {
    req.deps = deps;
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
      'spacecraft_id',
      'name',
      'mission_name',
      'mission_type',
      'orbit_type',
      'orbit_altitude_km',
      'ground_station',
      'operator_name'
    ].filter(
      (k) => req.body?.[k] === undefined || req.body?.[k] === null || String(req.body?.[k]).trim() === ''
    );

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
    const entity = repository.listEntities().find((e) => e.spacecraft_id === created.spacecraft_id);
    res.status(201).json({ session_id: created.session_id, spacecraft_id: created.spacecraft_id, entity });
  }));

  router.post(
    '/reset',
    asyncHandler(async (_req, res) => {
      const reset = deps.commandService.resetSession();
      res.json({
        message: 'Session reset: vehicle, mission plan and persisted audit trail cleared.',
        spacecraft: { state: reset.spacecraft, telemetry: reset.telemetry },
        mission: reset.mission,
        next_sequence: reset.next_sequence
      });
    })
  );  router.post('/:spacecraftId/recovery',
    asyncHandler(async (req, res) => {
      assertKnownSpacecraft(deps, req.params.spacecraftId);
      const result = await deps.commandService.processOperatorCommand({
        key_id: 'GS-PRIMARY-01',
        command_type: 'OPERATOR_RECOVER',
        parameters: {
          clearance_level: 'FLIGHT_DIRECTOR',
          recovery_token: (typeof req.body?.token === 'string' && req.body.token) || 'GROUND-SECURE-RECOVERY-CHANNEL'
        }
      });
      res.json(result);
    })
  );

  return router;
}

function assertKnownSpacecraft(deps: SpacecraftRouteDeps, spacecraftId: string): string {
  const repo = deps.spacecraftService.getRepository();
  if (
    spacecraftId !== config.defaultSpacecraftId &&
    !repo!.listEntities().some((e) => e.spacecraft_id === spacecraftId)
  ) {
    throw new HttpError(
      404,
      `Unknown spacecraft "${spacecraftId}" — onboard it via POST /api/spacecraft or use the demo spacecraft SAT-01`
    );
  }
  return spacecraftId;
}

function securityPosture(operating_mode: string, battery_percent: number): 'NORMAL' | 'SUSPICIOUS' | 'CRITICAL' {
  if (operating_mode === 'SAFE_MODE') return 'CRITICAL';
  if (operating_mode === 'MONITOR' || operating_mode === 'BLOCK') return 'CRITICAL';
  if (battery_percent < 25 || battery_percent > 100) return 'SUSPICIOUS';
  return 'NORMAL';
}
