import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { SecurityEventRepository } from '../db/repositories/securityEventRepository';

// Trusted origins that can access backend APIs
const TRUSTED_ORIGINS = [
  'http://localhost:3000',  // Ground
  'http://localhost:3100',  // SpaceTwin
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3100',
];

// Untrusted origins (attacker)
const UNTRUSTED_ORIGINS = [
  'http://localhost:3500',  // Attacker
  'http://127.0.0.1:3500',
];

export interface SecurityContext {
  trustZone: 'TRUSTED' | 'INTERNAL' | 'UNTRUSTED' | 'UNKNOWN';
  origin: string | null;
  isTrusted: boolean;
  serviceId?: string;
}

/**
 * Extract origin from request headers
 */
function getOrigin(req: Request): string | null {
  return req.headers.origin || req.headers.referer || null;
}

/**
 * Determine trust zone from origin
 */
export function determineTrustZone(origin: string | null): SecurityContext['trustZone'] {
  if (!origin) return 'UNKNOWN';

  const originUrl = new URL(origin, 'http://localhost');

  // Check trusted origins
  if (TRUSTED_ORIGINS.some(o => originUrl.href.startsWith(o))) {
    return 'TRUSTED';
  }

  // Check untrusted origins
  if (UNTRUSTED_ORIGINS.some(o => originUrl.href.startsWith(o))) {
    return 'UNTRUSTED';
  }

  // Allow internal/localhost connections without origin
  if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
    // Check port to determine zone
    const port = originUrl.port;
    if (port === '3000' || port === '3100') return 'TRUSTED';
    if (port === '3500') return 'UNTRUSTED';
    if (port === '4000') return 'INTERNAL';
  }

  return 'UNKNOWN';
}

/**
 * Security middleware: enforce trust zone policy
 * 
 * - TRUSTED origins (3000, 3100): allowed
 * - UNTRUSTED origins (3500): blocked with 403
 * - Unknown origins: logged but allowed for backward compatibility
 */
export function securityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const origin = getOrigin(req);
  const trustZone = determineTrustZone(origin);

  // Attach security context to request
  (req as Request & { securityContext?: SecurityContext }).securityContext = {
    trustZone,
    origin,
    isTrusted: trustZone === 'TRUSTED',
  };

  // Block untrusted origins from privileged API access
  // BUT allow attacker to submit commands to /api/commands for security demo
  if (trustZone === 'UNTRUSTED') {
    // Attacker can submit commands to /api/commands (for attack demonstration)
    // but cannot access privileged endpoints
    if (req.path === '/api/commands' || req.path.startsWith('/api/commands/')) {
      // Allow attacker to submit hostile commands to the security gateway
      // The gateway will process them and generate proper audit events
      console.log(`[security] ALLOWED attacker command submission to ${req.path} (for security demo)`);
      // Don't attach trusted context - attacker remains UNTRUSTED
      // The command processing pipeline will handle authentication/integrity/replay
      next();
      return;
    }
    
    // All other endpoints: block attacker
    console.log(`[security] BLOCKED untrusted request from ${origin || 'unknown'} to ${req.method} ${req.path}`);
    
    // Generate single event ID for consistency across SQLite, response, and frontend
    const eventId = `EVT-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    // Persist security event for blocked request using SAME event ID
    try {
      const eventRepo = new SecurityEventRepository();
      eventRepo.insert({
        event_id: eventId,
        timestamp: new Date().toISOString(),
        command_id: 'ATTACK-ATTEMPT',
        spacecraft_id: 'SAT-01',
        sender_identity: origin || 'ATTACKER-ROGUE-GS',
        envelope: {} as any,
        integrity: { passed: false, computed_signature: '', received_signature: '', algorithm: 'NONE', error: 'Request blocked at perimeter' } as any,
        authentication: { passed: false, key_id: 'ATTACKER-ROGUE-GS', error: 'Untrusted origin blocked' } as any,
        replay: { passed: false, nonce_is_fresh: false, sequence_valid: false, timestamp_valid: false, clock_skew_seconds: 0, expected_sequence: 0, received_sequence: 0, error: 'Request blocked' } as any,
        behavioral: { is_anomalous: true, anomaly_score: 90, confidence: 1.0, findings: ['Untrusted origin access attempt'], explanation: 'Attacker attempted to access privileged backend endpoint from untrusted zone', suggested_risk_delta: 50 } as any,
        mission_context: { is_compliant: false, conflicting_rules: ['NETWORK_SEGMENTATION'], current_phase: 'UNKNOWN', environmental_factors: [], findings: ['Request from untrusted origin blocked'], risk_contribution: 50 } as any,
        risk: { total_score: 95, severity: 'CRITICAL', breakdown: { cryptographic_penalty: 80, behavioral_penalty: 50, mission_conflict_penalty: 50, spacecraft_vulnerability_penalty: 0, command_inherent_criticality: 50 }, summary: 'Untrusted origin blocked' } as any,
        policy: { decision: 'BLOCK', enforced_by_deterministic_rule: true, rule_triggered: 'UNTRUSTED_ORIGIN_BLOCKED', safe_mode_activated: false, operator_alert_dispatched: true, explanation: 'Request from untrusted origin (attacker zone) blocked by security middleware' } as any,
        final_decision: 'BLOCK',
        simulated_attack_type: 'UNAUTHORIZED_ACCESS'
      });
      console.log(`[security] Security event persisted: ${eventId} - UNAUTHORIZED_ACCESS blocked`);
    } catch (err) {
      console.error('[security] Failed to persist security event:', err);
    }
    
    // Return SAME event ID in response
    res.status(403).json({
      error: 'Access denied: untrusted origin',
      security: {
        blocked: true,
        reason: 'Origin not in trusted zones',
        trustZone,
        path: req.path,
        event_id: eventId  // SAME ID as SQLite
      }
    });
    return;
  }

  // Log trusted requests
  if (trustZone === 'TRUSTED') {
    console.log(`[security] ALLOWED trusted request from ${origin || 'unknown'} (${trustZone}) to ${req.method} ${req.path}`);
  }

  next();
}

/**
 * Middleware to require trusted origin for sensitive endpoints
 */
export function requireTrustedOrigin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ctx = (req as Request & { securityContext?: SecurityContext }).securityContext;
  
  if (!ctx || ctx.trustZone !== 'TRUSTED') {
    res.status(403).json({
      error: 'Access denied: trusted origin required',
      security: {
        blocked: true,
        required: 'TRUSTED',
        received: ctx?.trustZone || 'NONE'
      }
    });
    return;
  }

  next();
}

/**
 * Middleware to require service identity token
 */
export function requireServiceToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-service-token'] as string | undefined;

  if (!token) {
    res.status(401).json({
      error: 'Access denied: service token required',
      security: {
        blocked: true,
        reason: 'Missing service token'
      }
    });
    return;
  }

  // In development, accept any non-empty token
  // In production, validate against configured tokens
  if (config.port === 4000 && process.env.NODE_ENV !== 'production') {
    // Development: accept token
    (req as Request & { serviceId?: string }).serviceId = 'validated-service';
    next();
    return;
  }

  // Production: validate token
  const groundToken = process.env.GROUND_SERVICE_TOKEN;
  const spacetwinToken = process.env.SPACETWIN_SERVICE_TOKEN;

  if (token === groundToken || token === spacetwinToken) {
    (req as Request & { serviceId?: string }).serviceId = token === groundToken ? 'ground' : 'spacetwin';
    next();
    return;
  }

  res.status(403).json({
    error: 'Access denied: invalid service token',
    security: {
      blocked: true,
      reason: 'Invalid service token'
    }
  });
}

/**
 * Get security context from request
 */
export function getSecurityContext(req: Request): SecurityContext | undefined {
  return (req as Request & { securityContext?: SecurityContext }).securityContext;
}
