import { createApp } from '../backend/src/app';
import { closeDatabase } from '../backend/src/db/database';
import type { Server } from 'node:net';

const { app } = createApp();
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => {
  server.on('listening', () => resolve());
});
const port = (server.address() as any).port;
const base = `http://127.0.0.1:${port}/api`;

setTimeout(async () => {
  try {
    const res = await fetch(`${base}/health`);
    const body = await res.json();
    console.log('health', res.status, body);
  } catch (err) {
    console.error('health fetch failed', err);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    closeDatabase();
  }
}, 300);
