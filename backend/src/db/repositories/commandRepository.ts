import { getDatabase } from '../database';
import { CommandEnvelope } from '../../../../src/models/command';

export interface CommandRow {
  id: number;
  command_id: string;
  spacecraft_id: string;
  key_id: string | null;
  command_type: string | null;
  sequence_number: number | null;
  nonce: string | null;
  timestamp: string | null;
  parameters_json: string | null;
  encrypted: number;
  created_at: string;
}

export interface CommandQuery {
  limit?: number;
  spacecraftId?: string;
  keyId?: string;
}

export class CommandRepository {
  /**
   * Persists a processed command envelope. Malformed envelopes (missing header)
   * are skipped — they are still captured by the security_events audit trail.
   */
  public insert(envelope: CommandEnvelope): void {
    const encrypted = envelope.security.ciphertext ? 1 : 0;
    getDatabase()
      .prepare(
        `INSERT INTO commands
           (command_id, spacecraft_id, key_id, command_type, sequence_number, nonce,
            timestamp, parameters_json, encrypted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        envelope.header.command_id,
        envelope.header.spacecraft_id,
        envelope.security.key_id ?? null,
        envelope.payload?.command_type ?? null,
        envelope.header.sequence_number ?? null,
        envelope.header.nonce ?? null,
        envelope.header.timestamp ?? null,
        JSON.stringify(envelope.payload?.parameters ?? {}),
        encrypted
      );
  }

  public list(query: CommandQuery = {}): CommandRow[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.spacecraftId) {
      conditions.push('spacecraft_id = ?');
      params.push(query.spacecraftId);
    }
    if (query.keyId) {
      conditions.push('key_id = ?');
      params.push(query.keyId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(query.limit ?? 100, 500);
    params.push(limit);

    return getDatabase()
      .prepare(
        `SELECT * FROM commands ${where} ORDER BY id DESC LIMIT ?`
      )
      .all(...params) as CommandRow[];
  }

  public count(): number {
    const row = getDatabase().prepare('SELECT COUNT(*) AS c FROM commands').get() as { c: number };
    return row.c;
  }

  /** Highest sequence number accepted by the gateway (source of truth for monotonic checks). */
  public getMaxSequenceNumber(spacecraftId: string): number | null {
    const row = getDatabase()
      .prepare('SELECT MAX(sequence_number) AS max_seq FROM commands WHERE spacecraft_id = ?')
      .get(spacecraftId) as { max_seq: number | null };
    return row.max_seq;
  }

  /** Highest sequence per sender key — back-compat rehydration for pre-replay_state databases. */
  public getMaxSequenceNumberByKey(spacecraftId: string): { key_id: string; max_seq: number }[] {
    return getDatabase()
      .prepare(
        `SELECT key_id, MAX(sequence_number) AS max_seq
         FROM commands
         WHERE spacecraft_id = ? AND key_id IS NOT NULL
         GROUP BY key_id`
      )
      .all(spacecraftId) as { key_id: string; max_seq: number }[];
  }

  /** Recent nonces for replay-protection cache rehydration after a server restart. */
  public getRecentNonces(limit = 5000): string[] {
    const rows = getDatabase()
      .prepare(
        `SELECT nonce FROM commands
         WHERE nonce IS NOT NULL
         ORDER BY id DESC LIMIT ?`
      )
      .all(limit) as { nonce: string }[];
    return rows.map(r => r.nonce);
  }

  /** Removes all persisted commands (operator-initiated session reset only). */
  public deleteAll(): void {
    getDatabase().prepare('DELETE FROM commands').run();
  }
}
