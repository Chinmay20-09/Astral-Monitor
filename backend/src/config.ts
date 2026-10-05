import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the backend/ directory, independent of process cwd. */
export const BACKEND_ROOT = path.resolve(__dirname, '..');

// backend/.env (optional) — every value has a safe local default
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  defaultSpacecraftId: string;
  maxClockSkewSeconds: number;
  maxAuditEventsDefault: number;
  version: string;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config: AppConfig = {
  port: intFromEnv('PORT', 4000),
  host: process.env.HOST || '127.0.0.1',
  // SQLite file lives under backend/data/ by default (DATABASE_PATH or DB_PATH env override)
  dbPath: path.isAbsolute(process.env.DATABASE_PATH || process.env.DB_PATH || '')
    ? (process.env.DATABASE_PATH || process.env.DB_PATH as string)
    : path.join(BACKEND_ROOT, process.env.DATABASE_PATH || process.env.DB_PATH || 'data/orbitshield.db'),
  // Single simulated vehicle (local simulation — see PRD Section 6)
  defaultSpacecraftId: process.env.SPACECRAFT_ID || 'SAT-01',
  // Anti-replay freshness window, forwarded to the gateway replay module
  maxClockSkewSeconds: intFromEnv('MAX_CLOCK_SKEW_SECONDS', 60),
  maxAuditEventsDefault: 200,
  version: '1.1.0'
};
