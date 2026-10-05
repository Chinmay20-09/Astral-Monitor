import { Request, Response, NextFunction } from 'express';

/** Concise request logging: method, path, status and duration. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[http] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
  });
  next();
}
