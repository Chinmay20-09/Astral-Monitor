import { Router } from 'express';
import { CommandRepository } from '../db/repositories/commandRepository';
import { SecurityEventRepository } from '../db/repositories/securityEventRepository';
import { GroundStationRepository } from '../db/repositories/groundStationRepository';
import { SpacecraftService } from '../services/spacecraftService';
import { MissionService } from '../services/missionService';
import { config } from '../config';

export interface HealthDeps {
  spacecraftService: SpacecraftService;
  missionService: MissionService;
}

/**
 * GET /api/health — liveness + persistence check for the local security system.
 * A database failure is reported explicitly (503) instead of leaking a stack trace.
 */
export function healthRouter(deps: HealthDeps): Router {
  const router = Router();
  const commands = new CommandRepository();
  const events = new SecurityEventRepository();
  const stations = new GroundStationRepository();

  router.get('/', (_req, res) => {
    let dbStats: Record<string, unknown>;
    try {
      // Probe the database to prove persistence is live
      dbStats = {
        commands_persisted: commands.count(),
        security_events_persisted: events.count(),
        ground_stations_registered: stations.count(),
        decisions: events.countsByDecision()
      };
    } catch (err) {
      console.error('[health] database probe failed:', err);
      res.status(503).json({
        status: 'error',
        service: 'orbitshield-backend',
        database: 'disconnected',
        version: config.version,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const state = deps.spacecraftService.getState();

    res.json({
      status: 'ok',
      service: 'orbitshield-backend',
      database: 'connected',
      version: config.version,
      spacecraft_id: state.spacecraft_id,
      operating_mode: state.operating_mode,
      mission_phase: deps.missionService.getMissionState().current_phase.name,
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      persistence: dbStats
    });
  });

  return router;
}
