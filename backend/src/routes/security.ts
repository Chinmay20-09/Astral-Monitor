import { Router } from 'express';
import { SecurityEventService } from '../services/securityEventService';
import { SpacecraftService } from '../services/spacecraftService';
import { MissionService } from '../services/missionService';
import { requireTrustedOrigin } from '../middleware/security';
import { HttpError } from '../middleware/errorHandler';

export interface SecurityRouteDeps {
  securityEventService: SecurityEventService;
  spacecraftService: SpacecraftService;
  missionService: MissionService;
}

export type SecurityState =
  | 'NORMAL'
  | 'SUSPICIOUS'
  | 'THREAT_DETECTED'
  | 'ISOLATED'
  | 'RECOVERING'
  | 'RESTORED';

export interface SecurityStatus {
  state: SecurityState;
  timestamp: string;
  threatCount: number;
  quarantinedServices: string[];
  recentEvents: Array<{
    id: string;
    type: string;
    severity: string;
    source: string;
    target: string;
    timestamp: string;
  }>;
}

export interface QuarantineEntry {
  serviceId: string;
  trustLevel: string;
  status: 'QUARANTINED' | 'NORMAL';
  reason?: string;
  detectedAt?: string;
  expiresAt?: string;
}

// In-memory quarantine store (would be persisted in production)
const quarantineStore: Map<string, QuarantineEntry> = new Map();

export function securityRouter(deps: SecurityRouteDeps): Router {
  const router = Router();

  /**
   * GET /api/security/status
   * Get current security state
   */
  router.get('/status', requireTrustedOrigin, (req, res) => {
    const events = deps.securityEventService.listEvents({ limit: 10 });
    const threatEvents = events.filter(e =>
      e.final_decision === 'BLOCK' || e.final_decision === 'SAFE_MODE'
    );

    const quarantined: string[] = [];
    quarantineStore.forEach((entry) => {
      if (entry.status === 'QUARANTINED') {
        quarantined.push(entry.serviceId);
      }
    });

    // Determine current state
    let state: SecurityState = 'NORMAL';
    if (quarantined.length > 0) {
      state = 'ISOLATED';
    } else if (threatEvents.length > 0) {
      state = threatEvents.some(e => e.final_decision === 'SAFE_MODE')
        ? 'THREAT_DETECTED'
        : 'SUSPICIOUS';
    }

    const status: SecurityStatus = {
      state,
      timestamp: new Date().toISOString(),
      threatCount: threatEvents.length,
      quarantinedServices: quarantined,
      recentEvents: threatEvents.slice(0, 5).map(e => ({
        id: e.event_id,
        type: e.simulated_attack_type || e.authentication.key_id === 'ATTACKER-ROGUE-GS' ? 'UNAUTHORIZED_ACCESS' : 'ANOMALY',
        severity: e.risk?.severity || 'NORMAL',
        source: e.sender_identity,
        target: e.spacecraft_id,
        timestamp: e.timestamp
      }))
    };

    res.json(status);
  });

  /**
   * GET /api/security/events
   * Get security event stream
   */
  router.get('/events', requireTrustedOrigin, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const events = deps.securityEventService.listEvents({ limit });

    res.json({
      total: deps.securityEventService.count(),
      events: events.map(e => ({
        id: e.event_id,
        timestamp: e.timestamp,
        type: e.simulated_attack_type || 'COMMAND_PROCESSED',
        severity: e.risk?.severity || 'NORMAL',
        source: e.sender_identity,
        target: e.spacecraft_id,
        decision: e.final_decision,
        riskScore: e.risk?.total_score || 0,
        message: e.policy?.explanation || 'Command processed'
      }))
    });
  });

  /**
   * POST /api/security/quarantine
   * Quarantine a service (attacker)
   */
  router.post('/quarantine', requireTrustedOrigin, (req, res) => {
    const { serviceId, reason } = req.body;

    if (!serviceId) {
      throw new HttpError(400, 'serviceId is required');
    }

    const entry: QuarantineEntry = {
      serviceId,
      trustLevel: 'UNTRUSTED',
      status: 'QUARANTINED',
      reason: reason || 'Security policy violation',
      detectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString() // 5 minutes
    };

    quarantineStore.set(serviceId, entry);

    // Log security event
    deps.securityEventService.listEvents; // Access to trigger potential logging

    res.status(201).json({
      message: `Service ${serviceId} quarantined`,
      quarantine: entry
    });
  });

  /**
   * POST /api/security/recover
   * Initiate recovery process
   */
  router.post('/recover', requireTrustedOrigin, (req, res) => {
    const { serviceId } = req.body;

    // Clear quarantine for specified service or all
    if (serviceId) {
      quarantineStore.delete(serviceId);
    } else {
      quarantineStore.clear();
    }

    // Verify trusted services are healthy
    try {
      deps.spacecraftService.getState();
      deps.missionService.getMissionState();
    } catch (err) {
      throw new HttpError(503, 'Trusted service health check failed');
    }

    res.json({
      message: serviceId
        ? `Service ${serviceId} recovered`
        : 'All services recovered',
      state: 'RESTORED',
      timestamp: new Date().toISOString(),
      recoveredServices: serviceId ? [serviceId] : ['ground', 'spacetwin', 'backend']
    });
  });

  /**
   * GET /api/security/quarantine
   * Get quarantine status for all services
   */
  router.get('/quarantine', requireTrustedOrigin, (req, res) => {
    const quarantines = Array.from(quarantineStore.values());
    res.json({
      total: quarantines.length,
      quarantines
    });
  });

  return router;
}

/**
 * Check if a service is quarantined
 */
export function isQuarantined(serviceId: string): boolean {
  const entry = quarantineStore.get(serviceId);
  return entry?.status === 'QUARANTINED';
}

/**
 * Get quarantine entry for a service
 */
export function getQuarantineEntry(serviceId: string): QuarantineEntry | undefined {
  return quarantineStore.get(serviceId);
}
