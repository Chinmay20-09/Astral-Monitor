import { getDatabase } from '../database';

export interface Session {
  session_id: string;
  spacecraft_id: string;
  mission_id: string;
  created_at: string;
  last_active_at: string;
  status: 'ACTIVE';
  active: boolean;
}

export interface SessionRow {
  session_id: string;
  spacecraft_id: string;
  mission_id: string;
  created_at: string;
  last_active_at: string;
  status: 'ACTIVE';
  active: number;
}

/**
 * Active mission sessions: SQLite is the authoritative store for which
 * spacecraft/session the operator screens display. There is exactly one
 * ACTIVE session at a time; activating a new one deactivates the previous.
 */
export class SessionRepository {
  public create(session: Omit<Session, 'session_id' | 'created_at' | 'last_active_at' | 'active'>): string {
    const sessionId = `SES-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    getDatabase()
      .prepare(
        `INSERT INTO sessions (session_id, spacecraft_id, mission_id, status, active, created_at, last_active_at)
         VALUES (?, ?, ?, 'ACTIVE', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
      .run(sessionId, session.spacecraft_id, session.mission_id);
    return sessionId;
  }

  /** Sets the active session; the previous ACTIVE row is deactivated. */
  public activate(sessionId: string): void {
    getDatabase()
      .prepare(
        `UPDATE sessions SET active = 1, last_active_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), status = 'ACTIVE' WHERE session_id = ?`
      )
      .run(sessionId);
    getDatabase()
      .prepare('UPDATE sessions SET active = 0 WHERE session_id != ?')
      .run(sessionId);
  }

  public list(): Session[] {
    const rows = getDatabase()
      .prepare('SELECT * FROM sessions ORDER BY last_active_at DESC')
      .all() as SessionRow[];
    return rows.map((row) => this.rowToSession(row));
  }

  public get(sessionId: string): Session | undefined {
    return getDatabase()
      .prepare('SELECT * FROM sessions WHERE session_id = ?')
      .get(sessionId) as Session | undefined;
  }

  public delete(sessionId: string): void {
    getDatabase().prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
  }

  /** The currently active session, if any (used by GET /api/sessions). */
  public getActive(): Session | undefined {
    const row = getDatabase()
      .prepare('SELECT * FROM sessions WHERE active = 1 ORDER BY last_active_at DESC LIMIT 1')
      .get() as SessionRow | undefined;
    return row ? this.rowToSession(row) : undefined;
  }

  private rowToSession(row: SessionRow): Session {
    return {
      session_id: row.session_id,
      spacecraft_id: row.spacecraft_id,
      mission_id: row.mission_id,
      created_at: row.created_at,
      last_active_at: row.last_active_at,
      status: row.status as 'ACTIVE',
      active: row.active === 1
    };
  }
}
