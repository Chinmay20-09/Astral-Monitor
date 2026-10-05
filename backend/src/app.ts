import express, { Express } from 'express';
import { config } from './config';
import { getDatabase } from './db/database';
import { GroundStationRepository } from './db/repositories/groundStationRepository';
import { MissionService } from './services/missionService';
import { SpacecraftService } from './services/spacecraftService';
import { CommandService } from './services/commandService';
import { AttackService } from './services/attackService';
import { SecurityEventService } from './services/securityEventService';
import { SessionService } from './services/sessionService';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { securityMiddleware, requireTrustedOrigin } from './middleware/security';
import { healthRouter } from './routes/health';
import { commandsRouter } from './routes/commands';
import { attacksRouter } from './routes/attacks';
import { securityEventsRouter } from './routes/securityEvents';
import { spacecraftRouter } from './routes/spacecraft';
import { missionRouter } from './routes/mission';
import { groundStationsRouter } from './routes/groundStations';
import { sessionsRouter } from './routes/sessions';
import { securityRouter } from './routes/security';

export interface ServiceRegistry {
  missionService: MissionService;
  spacecraftService: SpacecraftService;
  commandService: CommandService;
  attackService: AttackService;
  securityEventService: SecurityEventService;
}

/**
 * Builds the fully wired backend: database → services → HTTP API.
 * All state (vehicle, mission, per-sender replay protection, audit trail) is
 * loaded from SQLite, so the gateway resumes exactly where it left off.
 */
export function createApp(): { app: Express; services: ServiceRegistry } {
  // 1. Database (applies pending migrations on first access)
  getDatabase();
  new GroundStationRepository().seedFromRegistry();

  // 2. Services — mission + spacecraft hydrate from persisted state first,
  //    then the gateway binds to those same live instances.
  const missionService = new MissionService(config.defaultSpacecraftId);
  const spacecraftService = new SpacecraftService(missionService, config.defaultSpacecraftId);
  const commandService = new CommandService(spacecraftService, missionService, config.defaultSpacecraftId);
  const attackService = new AttackService(commandService, missionService, config.defaultSpacecraftId);
  const sessionService = new SessionService();
  const securityEventService = new SecurityEventService();

  // Security router with access to services
  const securityRouterInstance = securityRouter({
    securityEventService,
    spacecraftService,
    missionService
  });

  const services: ServiceRegistry = {
    missionService,
    spacecraftService,
    commandService,
    attackService,
    securityEventService
  };

  // 3. HTTP API
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  // Security middleware: enforce trust zone policy
  // Runs BEFORE CORS to block untrusted origins
  app.use(securityMiddleware);

  // CORS: allow trusted origins only (not wildcard)
  app.use((req, res, next) => {
    const ctx = (req as unknown as Request & { securityContext?: import('./middleware/security').SecurityContext }).securityContext;
    const origin = ctx?.origin || req.headers.origin as string | undefined;
    
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Service-Token');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use('/api/health', healthRouter({ spacecraftService, missionService }));
  app.use('/api/commands', commandsRouter({ commandService }));
  app.use('/api/attacks', attacksRouter({ attackService }));
  app.use('/api/security-events', securityEventsRouter({ securityEventService }));
  app.use('/api/spacecraft', spacecraftRouter({ spacecraftService, commandService, sessionService, missionService }));
  app.use('/api/mission', missionRouter({ missionService }));
  app.use('/api/ground-stations', groundStationsRouter());
  app.use('/api/sessions', sessionsRouter({ sessionService }));
  app.use('/api/security', securityRouterInstance);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, services };
}
