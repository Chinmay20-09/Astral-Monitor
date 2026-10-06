import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../backend/data/orbitshield.db');
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';

for (const p of [dbPath, walPath, shmPath]) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

console.log(`[reset] removed existing backend database: ${dbPath}`);
