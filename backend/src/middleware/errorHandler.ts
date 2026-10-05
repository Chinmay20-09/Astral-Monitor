import { Request, Response, NextFunction } from 'express';
import { PersistenceError } from '../services/commandService';

/** Wrap async route handlers so rejections reach the central error handler (Express 4). */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Central JSON error handler — invalid commands must never crash the gateway
 * (TRD Sec 13), and internal failures must not leak stack traces or secrets
 * to API clients.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Persistence failures are surfaced explicitly: the caller must know the
  // decision was NOT durably recorded (never silently pretend success).
  if (err instanceof PersistenceError) {
    res.status(503).json({ error: err.message, persisted: false });
    return;
  }

  // Malformed JSON bodies from express.json()
  const parseErr = err as { type?: string; status?: number; message?: string };
  if (parseErr?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON request body' });
    return;
  }

  // Unknown/internal errors: log server-side, return a sanitized message.
  console.error('[http] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}
