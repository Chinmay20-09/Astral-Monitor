-- OrbitShield ST-02 — migration 003: ground-station command scopes.
-- Stores each ground station's allowed command types so the persistent
-- registry holds the full public metadata snapshot. Secrets (HMAC signing
-- keys / AES transport keys) remain only in the backend's in-memory
-- credential registry — never in the database and never in API responses.

ALTER TABLE ground_stations ADD COLUMN allowed_command_types_json TEXT NOT NULL DEFAULT '["ALL"]';
