-- OrbitShield ST-02 — migration 004: spacecraft entity + mission session records.
-- Supports multiple simulated spacecraft records with their mission metadata,
-- plus an active-session table that drives the multi-screen operator console.
-- SAT-01 remains the default demo spacecraft.

-- Spacecraft entity: identity + orbital + operator metadata (persistent, multi-record)
CREATE TABLE IF NOT EXISTS spacecraft_entities (
  spacecraft_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Unnamed Spacecraft',
  mission_name TEXT NOT NULL DEFAULT 'Unnamed Mission',
  mission_type TEXT NOT NULL DEFAULT 'Science',
  orbit_type TEXT NOT NULL DEFAULT 'SUN_SYNCHRONOUS',
  orbit_altitude_km REAL NOT NULL DEFAULT 540.0,
  ground_station TEXT NOT NULL DEFAULT 'GS-PRIMARY-01',
  operator_name TEXT NOT NULL DEFAULT 'Unnamed Operator',
  operating_mode TEXT NOT NULL DEFAULT 'NOMINAL',
  battery_percent REAL NOT NULL DEFAULT 88.5,
  temperature REAL NOT NULL DEFAULT 18.2,
  communication_status TEXT NOT NULL DEFAULT 'ONLINE',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_spacecraft_entities_id ON spacecraft_entities (spacecraft_id);

-- Active mission session: the authoritative selection across all operator screens.
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  spacecraft_id TEXT NOT NULL,
  mission_id TEXT NOT NULL DEFAULT 'ORBITSHIELD-LEO-01',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_active_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_sessions_spacecraft ON sessions (spacecraft_id);
