import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

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

  // Block untrusted origins from API access
  if (trustZone === 'UNTRUSTED') {
    console.log(`[security] BLOCKED untrusted request from ${origin || 'unknown'} to ${req.method} ${req.path}`);
    
    // Log security event (would go to security event service in production)
    console.log(`[security] SECURITY EVENT: UNAUTHORIZED_ACCESS from ${origin || 'unknown'} target=${req.path}`);
    
    res.status(403).json({
      error: 'Access denied: untrusted origin',
      security: {
        blocked: true,
        reason: 'Origin not in trusted zones',
        trustZone,
        path: req.path
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
