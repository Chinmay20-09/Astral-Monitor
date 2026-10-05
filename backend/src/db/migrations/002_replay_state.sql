-- OrbitShield ST-02 — migration 002: per-sender anti-replay state.
-- Persists the last accepted sequence number per (spacecraft_id, key_id)
-- scope so replay protection survives backend restarts. The nonce cache
-- itself rehydrates from the persisted commands table (bounded query).

CREATE TABLE IF NOT EXISTS replay_state (
  spacecraft_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  last_accepted_sequence INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (spacecraft_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_replay_state_key_id ON replay_state (key_id);
