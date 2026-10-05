import DatabaseConstructor from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export type SqliteConnection = DatabaseConstructor.Database;

let connection: SqliteConnection | null = null;

/**
 * Opens (or returns) the singleton SQLite connection.
 * - Creates the data directory and file if missing.
 * - Applies pending migrations from db/migrations in filename order,
 *   tracked in a schema_migrations table.
 * - Enables WAL for durability + read concurrency.
 */
export function getDatabase(): SqliteConnection {
  if (connection) {
    return connection;
  }

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  connection = new DatabaseConstructor(config.dbPath);

  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');
  connection.pragma('synchronous = NORMAL');

  runMigrations(connection);
  return connection;
}

function runMigrations(db: SqliteConnection): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map(r => r.name)
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const insert = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      insert.run(file);
    });
    applyMigration();
    console.log(`[db] applied migration: ${file}`);
  }
}

/** Close the connection (used on graceful shutdown / tests). */
export function closeDatabase(): void {
  if (connection) {
    connection.close();
    connection = null;
  }
}
