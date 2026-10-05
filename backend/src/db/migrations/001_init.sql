-- OrbitShield ST-02 — initial schema (SQLite)
-- Persistent local storage for the spacecraft security simulation.
-- All timestamps are ISO-8601 UTC strings; JSON columns store full pipeline evidence
-- so every security decision remains explainable from the audit trail alone.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ground_stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id TEXT NOT NULL UNIQUE,
  station_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id TEXT NOT NULL,
  spacecraft_id TEXT NOT NULL,
  key_id TEXT,
  command_type TEXT,
  sequence_number INTEGER,
  nonce TEXT,
  timestamp TEXT,
  parameters_json TEXT,
  encrypted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_commands_command_id ON commands (command_id);
CREATE INDEX IF NOT EXISTS idx_commands_spacecraft_created ON commands (spacecraft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commands_key_id ON commands (key_id);
CREATE INDEX IF NOT EXISTS idx_commands_nonce ON commands (nonce);
CREATE INDEX IF NOT EXISTS idx_commands_sequence ON commands (spacecraft_id, sequence_number DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  spacecraft_id TEXT NOT NULL,
  sender_identity TEXT,
  integrity_passed INTEGER NOT NULL DEFAULT 0,
  authentication_passed INTEGER NOT NULL DEFAULT 0,
  replay_passed INTEGER NOT NULL DEFAULT 0,
  envelope_json TEXT,
  integrity_json TEXT,
  authentication_json TEXT,
  replay_json TEXT,
  behavioral_json TEXT,
  mission_context_json TEXT,
  risk_json TEXT,
  policy_json TEXT,
  final_decision TEXT NOT NULL,
  simulated_attack_type TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_events_event_id ON security_events (event_id);
CREATE INDEX IF NOT EXISTS idx_events_command_id ON security_events (command_id);
CREATE INDEX IF NOT EXISTS idx_events_spacecraft_created ON security_events (spacecraft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_final_decision ON security_events (final_decision);
CREATE INDEX IF NOT EXISTS idx_events_attack_type ON security_events (simulated_attack_type);

CREATE TABLE IF NOT EXISTS spacecraft_state (
  spacecraft_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  operating_mode TEXT NOT NULL,
  battery_percent REAL NOT NULL,
  temperature REAL NOT NULL,
  communication_status TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS mission_state (
  spacecraft_id TEXT PRIMARY KEY,
  mission_state_json TEXT NOT NULL,
  current_phase TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
