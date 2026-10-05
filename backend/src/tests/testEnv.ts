import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Must be imported BEFORE any backend module that reads config: it redirects
 * the SQLite database to a unique throwaway location so tests never touch
 * backend/data/orbitshield.db.
 */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitshield-backend-test-'));
process.env.DB_PATH = path.join(tempDir, 'test.db');
process.env.SPACECRAFT_ID = 'SAT-01';
process.env.MAX_CLOCK_SKEW_SECONDS = '60';

export const TEST_DB_PATH = process.env.DB_PATH;
