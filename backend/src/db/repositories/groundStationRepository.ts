import { getDatabase } from '../database';
import { AUTHORIZED_GROUND_STATIONS, GroundStationCredential } from '../../../../src/gateway/authentication';

export interface GroundStationRow {
  id: number;
  key_id: string;
  station_name: string;
  role: string;
  status: string;
  allowed_command_types_json: string;
  created_at: string;
}

/** Public registry snapshot — deliberately contains NO credential material. */
export interface GroundStationSnapshot {
  key_id: string;
  station_name: string;
  allowed_command_types: string[];
  role: string;
  status: string;
}

export class GroundStationRepository {
  /**
   * Seeds the persistent key registry from the simulated local registry defined in
   * src/gateway/authentication.ts (TRD Section 5: key management is simulated locally).
   * Idempotent: inserts missing key_ids and refreshes public metadata for known ones
   * so the table never drifts from the authoritative in-memory registry.
   */
  public seedFromRegistry(): void {
    const db = getDatabase();
    const upsert = db.prepare(
      `INSERT INTO ground_stations (key_id, station_name, role, status, allowed_command_types_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key_id) DO UPDATE SET
         station_name = excluded.station_name,
         role = excluded.role,
         status = excluded.status,
         allowed_command_types_json = excluded.allowed_command_types_json`
    );
    const insertAll = db.transaction(() => {
      for (const cred of Object.values(AUTHORIZED_GROUND_STATIONS)) {
        upsert.run(
          cred.key_id,
          cred.station_name,
          cred.role,
          cred.status,
          JSON.stringify(cred.allowed_command_types)
        );
      }
    });
    insertAll();
  }

  public list(): GroundStationRow[] {
    return getDatabase()
      .prepare('SELECT * FROM ground_stations ORDER BY key_id')
      .all() as GroundStationRow[];
  }

  public count(): number {
    const row = getDatabase().prepare('SELECT COUNT(*) AS c FROM ground_stations').get() as { c: number };
    return row.c;
  }

  public updateStatus(keyId: string, status: 'ACTIVE' | 'REVOKED'): boolean {
    const result = getDatabase()
      .prepare('UPDATE ground_stations SET status = ? WHERE key_id = ?')
      .run(status, keyId);
    return result.changes > 0;
  }

  /** DB row → sanitized snapshot (no secret_key / encryption_key fields exist on the row). */
  public static toSnapshot(row: GroundStationRow): GroundStationSnapshot {
    let allowed: string[] = ['ALL'];
    try {
      const parsed = JSON.parse(row.allowed_command_types_json);
      if (Array.isArray(parsed)) allowed = parsed as string[];
    } catch {
      // keep default
    }
    return {
      key_id: row.key_id,
      station_name: row.station_name,
      allowed_command_types: allowed,
      role: row.role,
      status: row.status
    };
  }

  /** Snapshot from the in-memory credential registry (secret fields stripped). */
  public static toRegistrySnapshot(creds: GroundStationCredential[]): Omit<GroundStationCredential, 'secret_key' | 'encryption_key'>[] {
    return creds.map(c => ({
      key_id: c.key_id,
      station_name: c.station_name,
      allowed_command_types: c.allowed_command_types,
      role: c.role,
      status: c.status
    }));
  }
}
