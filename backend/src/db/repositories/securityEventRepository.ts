import { getDatabase } from '../database';
import { AuditEvent } from '../../../../src/models/audit';
import { CommandEnvelope } from '../../../../src/models/command';

export interface SecurityEventRow {
  id: number;
  event_id: string;
  command_id: string;
  spacecraft_id: string;
  sender_identity: string | null;
  integrity_passed: number;
  authentication_passed: number;
  replay_passed: number;
  envelope_json: string | null;
  integrity_json: string | null;
  authentication_json: string | null;
  replay_json: string | null;
  behavioral_json: string | null;
  mission_context_json: string | null;
  risk_json: string | null;
  policy_json: string | null;
  final_decision: string;
  simulated_attack_type: string | null;
  created_at: string;
}

export interface SecurityEventQuery {
  limit?: number;
  decision?: string;
  spacecraftId?: string;
  attackType?: string;
}

/**
 * Parses a stored row back into the complete explainable AuditEvent consumed by
 * the dashboard (evidence panels render signature, replay and risk breakdown JSON).
 */
function rowToAuditEvent(row: SecurityEventRow): AuditEvent {
  return {
    event_id: row.event_id,
    timestamp: row.created_at,
    command_id: row.command_id,
    spacecraft_id: row.spacecraft_id,
    sender_identity: row.sender_identity ?? 'UNKNOWN',
    envelope: row.envelope_json ? JSON.parse(row.envelope_json) : ({} as AuditEvent['envelope']),
    integrity: row.integrity_json
      ? JSON.parse(row.integrity_json)
      : { passed: !!row.integrity_passed, computed_signature: '', received_signature: '', algorithm: 'UNKNOWN' },
    authentication: row.authentication_json
      ? JSON.parse(row.authentication_json)
      : { passed: !!row.authentication_passed, key_id: 'UNKNOWN' },
    replay: row.replay_json
      ? JSON.parse(row.replay_json)
      : { passed: !!row.replay_passed, nonce_is_fresh: false, sequence_valid: false, timestamp_valid: false, clock_skew_seconds: 0, expected_sequence: 0, received_sequence: 0 },
    behavioral: row.behavioral_json ? JSON.parse(row.behavioral_json) : ({} as AuditEvent['behavioral']),
    mission_context: row.mission_context_json ? JSON.parse(row.mission_context_json) : ({} as AuditEvent['mission_context']),
    risk: row.risk_json ? JSON.parse(row.risk_json) : ({} as AuditEvent['risk']),
    policy: row.policy_json ? JSON.parse(row.policy_json) : ({} as AuditEvent['policy']),
    final_decision: row.final_decision as AuditEvent['final_decision'],
    simulated_attack_type: row.simulated_attack_type ?? undefined
  };
}

export class SecurityEventRepository {
  public insert(event: AuditEvent): void {
    getDatabase()
      .prepare(
        `INSERT INTO security_events
           (event_id, command_id, spacecraft_id, sender_identity,
            integrity_passed, authentication_passed, replay_passed,
            envelope_json, integrity_json, authentication_json, replay_json,
            behavioral_json, mission_context_json, risk_json, policy_json,
            final_decision, simulated_attack_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.event_id,
        event.command_id,
        event.spacecraft_id,
        event.sender_identity ?? null,
        event.integrity?.passed ? 1 : 0,
        event.authentication?.passed ? 1 : 0,
        event.replay?.passed ? 1 : 0,
        JSON.stringify(event.envelope ?? null),
        JSON.stringify(event.integrity ?? null),
        JSON.stringify(event.authentication ?? null),
        JSON.stringify(event.replay ?? null),
        JSON.stringify(event.behavioral ?? null),
        JSON.stringify(event.mission_context ?? null),
        JSON.stringify(event.risk ?? null),
        JSON.stringify(event.policy ?? null),
        event.final_decision,
        event.simulated_attack_type ?? null
      );
  }

  public list(query: SecurityEventQuery = {}): AuditEvent[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.spacecraftId) {
      conditions.push('spacecraft_id = ?');
      params.push(query.spacecraftId);
    }
    if (query.decision) {
      conditions.push('final_decision = ?');
      params.push(query.decision);
    }
    if (query.attackType) {
      conditions.push('simulated_attack_type = ?');
      params.push(query.attackType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(query.limit ?? 200, 1000);
    params.push(limit);

    const rows = getDatabase()
      .prepare(`SELECT * FROM security_events ${where} ORDER BY id DESC LIMIT ?`)
      .all(...params) as SecurityEventRow[];

    return rows.map(rowToAuditEvent);
  }

  public getById(eventId: string): AuditEvent | null {
    const row = getDatabase()
      .prepare('SELECT * FROM security_events WHERE event_id = ?')
      .get(eventId) as SecurityEventRow | undefined;
    return row ? rowToAuditEvent(row) : null;
  }

  /** Rehydration source for the behavioral analysis history across server restarts. */
  public getRecentForRehydration(limit = 50): { command_id: string; command_type: string | null; timestamp: string | null; key_id: string | null; final_decision: string }[] {
    return getDatabase()
      .prepare(
        `SELECT e.final_decision, c.command_id, c.command_type, c.timestamp, c.key_id
         FROM security_events e
         JOIN commands c ON c.command_id = e.command_id
         ORDER BY e.id DESC LIMIT ?`
      )
      .all(limit) as { command_id: string; command_type: string | null; timestamp: string | null; key_id: string | null; final_decision: string }[];
  }

  public count(): number {
    const row = getDatabase().prepare('SELECT COUNT(*) AS c FROM security_events').get() as { c: number };
    return row.c;
  }

  /**
   * Most recent accepted (ALLOW / MONITOR) command envelope — the attacker's
   * "captured transmission" for replay simulation.
   */
  public getLatestAcceptedEnvelope(): CommandEnvelope | null {
    const row = getDatabase()
      .prepare(
        `SELECT envelope_json FROM security_events
         WHERE final_decision IN ('ALLOW', 'MONITOR') AND envelope_json IS NOT NULL
         ORDER BY id DESC LIMIT 1`
      )
      .get() as { envelope_json: string } | undefined;
    return row ? (JSON.parse(row.envelope_json) as CommandEnvelope) : null;
  }

  public countsByDecision(): Record<string, number> {
    const rows = getDatabase()
      .prepare('SELECT final_decision, COUNT(*) AS c FROM security_events GROUP BY final_decision')
      .all() as { final_decision: string; c: number }[];
    return Object.fromEntries(rows.map(r => [r.final_decision, r.c]));
  }

  /** Removes all persisted audit events (operator-initiated session reset only). */
  public deleteAll(): void {
    getDatabase().prepare('DELETE FROM security_events').run();
  }
}
