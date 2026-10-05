import { getDatabase } from '../database';
import { ReplayStateEntry } from '../../../../src/gateway/replay';

export interface ReplayStateRow {
  spacecraft_id: string;
  key_id: string;
  last_accepted_sequence: number;
  updated_at: string;
}

/**
 * Persistence for per-sender anti-replay state (spacecraft_id + key_id).
 * Written inside the same transaction as the command + audit event so the
 * replay guarantee is durable exactly when the decision itself is.
 */
export class ReplayStateRepository {
  public upsert(spacecraftId: string, keyId: string, lastAcceptedSequence: number): void {
    getDatabase()
      .prepare(
        `INSERT INTO replay_state (spacecraft_id, key_id, last_accepted_sequence, updated_at)
         VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(spacecraft_id, key_id) DO UPDATE SET
           last_accepted_sequence = excluded.last_accepted_sequence,
           updated_at = excluded.updated_at`
      )
      .run(spacecraftId, keyId, lastAcceptedSequence);
  }

  public list(): ReplayStateEntry[] {
    const rows = getDatabase()
      .prepare('SELECT spacecraft_id, key_id, last_accepted_sequence FROM replay_state')
      .all() as ReplayStateRow[];
    return rows.map(r => ({
      spacecraft_id: r.spacecraft_id,
      key_id: r.key_id,
      last_sequence: r.last_accepted_sequence
    }));
  }

  /** Removes all persisted replay state (operator-initiated session reset only). */
  public deleteAll(): void {
    getDatabase().prepare('DELETE FROM replay_state').run();
  }
}
