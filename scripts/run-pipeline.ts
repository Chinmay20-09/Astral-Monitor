import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../backend/src/app';
import { closeDatabase } from '../backend/src/db/database';
import type { Server } from 'node:net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../backend/data/orbitshield.db');

// SQLite WAL mode leaves -wal/-shm companions; on Windows those can stay
// stubbornly locked between runs. Best-effort cleanup only: the database
// opens fine even with stale companions, and the new connection recreates
// the tables it needs via migrations.
const markers = [dbPath, dbPath + '-wal', dbPath + '-shm'] as const;
for (const p of markers) {
  if (fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch { console.warn(`[reset] could not remove ${p} (locked)`); }
  }
}
console.log(`[reset] database reset attempted: ${dbPath}`);

const { app } = createApp();
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => {
  server.on('listening', () => resolve());
});
const port = (server.address() as any).port;
if (!port) throw new Error('backend did not bind a port');
console.log(`[runner] backend listening on 127.0.0.1:${port}`);

// Small sleep so the event loop has time to hand off the listening socket.
await new Promise((r) => setTimeout(r, 50));
console.log(`[runner] backend listening on 127.0.0.1:${port}`);

process.env.PIPELINE_BASE_URL = `http://127.0.0.1:${port}/api`;
const { execute } = await import('../src/tests/security_pipeline.test');
try {
  await execute();
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  closeDatabase();
}
