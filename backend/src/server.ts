import { createApp } from './app';
import { config } from './config';
import { closeDatabase } from './db/database';

let app: ReturnType<typeof createApp>['app'];
let services: ReturnType<typeof createApp>['services'];

// Explicit database/initialization failure handling: a broken database must
// produce a clear fatal error, never a silently half-working service.
try {
  ({ app, services } = createApp());
} catch (err) {
  console.error('==========================================================');
  console.error('  FATAL: OrbitShield backend failed to initialize.');
  console.error('  Most likely cause: SQLite database could not be opened');
  console.error(`  at "${config.dbPath}" (check DB_PATH / disk permissions).`);
  console.error('==========================================================');
  console.error(err);
  process.exit(1);
}

const server = app.listen(config.port, config.host, () => {
  console.log('==========================================================');
  console.log('  OrbitShield ST-02 — Local Security Gateway Backend');
  console.log('==========================================================');
  console.log(`  HTTP API : http://${config.host}:${config.port}/api`);
  console.log(`  Health   : http://${config.host}:${config.port}/api/health`);
  console.log(`  Database : ${config.dbPath}`);
  console.log('  Security pipeline: Receive → Parse → Integrity → Auth →');
  console.log('  Replay → Behavioral → Mission Context → Risk → Policy →');
  console.log('  Response → Audit (persisted transactionally to SQLite)');
  console.log('  Credential registry + HMAC signing + AES-GCM decryption:');
  console.log('  server-side only — the browser is an operator console.');
  console.log('==========================================================');
});

// Graceful shutdown: stop accepting connections, flush SQLite, exit.
function shutdown(signal: string): void {
  console.log(`\n[server] ${signal} received — shutting down...`);
  server.close(() => {
    closeDatabase();
    console.log('[server] database closed. Goodbye.');
    process.exit(0);
  });
  // Failsafe if a connection keeps the server open
  setTimeout(() => {
    closeDatabase();
    process.exit(0);
  }, 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Surface service identity for smoke checks
void services;
