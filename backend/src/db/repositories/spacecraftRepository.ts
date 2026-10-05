import { getDatabase } from '../database';
import { SpacecraftState, EssentialTelemetry } from '../../../../src/models/spacecraft';

/** Persisted metadata for one onboarded spacecraft entity. */
export interface SpacecraftEntity {
  spacecraft_id: string;
  name: string;
  mission_name: string;
  mission_type: string;
  orbit_type: string;
  orbit_altitude_km: number;
  ground_station: string;
  operator_name: string;
  operating_mode: string;
  battery_percent: number;
  temperature: number;
  communication_status: string;
  created_at: string;
  updated_at: string;
}

export interface SpacecraftEntityRow {
  spacecraft_id: string;
  name: string;
  mission_name: string;
  mission_type: string;
  orbit_type: string;
  orbit_altitude_km: number;
  ground_station: string;
  operator_name: string;
  operating_mode: string;
  battery_percent: number;
  temperature: number;
  communication_status: string;
  created_at: string;
  updated_at: string;
}

/** Row of the live spacecraft_state table. */
export interface SpacecraftStateRow {
  spacecraft_id: string;
  state_json: string;
  operating_mode: string;
  battery_percent: number;
  temperature: number;
  communication_status: string;
  updated_at: string;
}

export class SpacecraftRepository {
  /** Live spacecraft_state row (current state of the active spacecraft). */
  public get(spacecraftId: string): SpacecraftStateRow | undefined {
    return getDatabase()
      .prepare('SELECT * FROM spacecraft_state WHERE spacecraft_id = ?')
      .get(spacecraftId) as SpacecraftStateRow | undefined;
  }

  /** Full row upsert — every state mutation persists here. */
  public save(state: SpacecraftState): void {
    getDatabase()
      .prepare(
        `INSERT INTO spacecraft_state
           (spacecraft_id, state_json, operating_mode, battery_percent, temperature, communication_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(spacecraft_id) DO UPDATE SET
           state_json = excluded.state_json,
           operating_mode = excluded.operating_mode,
           battery_percent = excluded.battery_percent,
           temperature = excluded.temperature,
           communication_status = excluded.communication_status,
           updated_at = excluded.updated_at`
      )
      .run(
        state.spacecraft_id,
        JSON.stringify(state),
        state.operating_mode,
        state.power.battery_percent,
        state.thermal.bus_temp_celsius,
        state.communication_status
      );
  }

  public delete(spacecraftId: string): void {
    getDatabase().prepare('DELETE FROM spacecraft_state WHERE spacecraft_id = ?').run(spacecraftId);
  }

  /** Convenience wrapper for health / dashboard telemetry. */
  public toTelemetry(state: SpacecraftState, heartbeatCounter = 0): EssentialTelemetry {
    return {
      timestamp: new Date().toISOString(),
      spacecraft_id: state.spacecraft_id,
      operating_mode: state.operating_mode,
      comm_status: state.communication_status,
      battery_percent: state.power.battery_percent,
      bus_temp_celsius: state.thermal.bus_temp_celsius,
      safe_mode_active: state.operating_mode === 'SAFE_MODE',
      safe_mode_reason: state.flight_computer.safe_mode_reason,
      heartbeat_counter: heartbeatCounter
    };
  }

  /** All onboarded spacecraft entities (onboarding + session selection). */
  public listEntities(): SpacecraftEntity[] {
    return getDatabase()
      .prepare('SELECT * FROM spacecraft_entities ORDER BY created_at DESC')
      .all() as SpacecraftEntityRow[];
  }

  /** Idempotent onboard: creates entity or refreshes an existing one. */
  public createEntity(entity: Omit<SpacecraftEntity, 'created_at' | 'updated_at'>): void {
    getDatabase()
      .prepare(
        `INSERT INTO spacecraft_entities
           (spacecraft_id, name, mission_name, mission_type, orbit_type, orbit_altitude_km,
            ground_station, operator_name, operating_mode, battery_percent, temperature,
            communication_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(spacecraft_id) DO UPDATE SET
           name = excluded.name,
           mission_name = excluded.mission_name,
           mission_type = excluded.mission_type,
           orbit_type = excluded.orbit_type,
           orbit_altitude_km = excluded.orbit_altitude_km,
           ground_station = excluded.ground_station,
           operator_name = excluded.operator_name,
           operating_mode = excluded.operating_mode,
           battery_percent = excluded.battery_percent,
           temperature = excluded.temperature,
           communication_status = excluded.communication_status,
           updated_at = excluded.updated_at`
      )
      .run(
        entity.spacecraft_id,
        entity.name,
        entity.mission_name,
        entity.mission_type,
        entity.orbit_type,
        entity.orbit_altitude_km,
        entity.ground_station,
        entity.operator_name,
        entity.operating_mode,
        entity.battery_percent,
        entity.temperature,
        entity.communication_status
      );
  }

  /** Update an entity's runtime attributes (mode, battery, comm status). */
  public updateEntity(
    entity: Partial<Omit<SpacecraftEntity, 'spacecraft_id' | 'created_at' | 'updated_at'>> & { spacecraft_id: string }
  ): void {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (entity.name !== undefined) { sets.push('name = ?'); params.push(entity.name); }
    if (entity.mission_name !== undefined) { sets.push('mission_name = ?'); params.push(entity.mission_name); }
    if (entity.mission_type !== undefined) { sets.push('mission_type = ?'); params.push(entity.mission_type); }
    if (entity.orbit_type !== undefined) { sets.push('orbit_type = ?'); params.push(entity.orbit_type); }
    if (entity.orbit_altitude_km !== undefined) { sets.push('orbit_altitude_km = ?'); params.push(entity.orbit_altitude_km); }
    if (entity.ground_station !== undefined) { sets.push('ground_station = ?'); params.push(entity.ground_station); }
    if (entity.operator_name !== undefined) { sets.push('operator_name = ?'); params.push(entity.operator_name); }
    if (entity.operating_mode !== undefined) { sets.push('operating_mode = ?'); params.push(entity.operating_mode); }
    if (entity.battery_percent !== undefined) { sets.push('battery_percent = ?'); params.push(entity.battery_percent); }
    if (entity.temperature !== undefined) { sets.push('temperature = ?'); params.push(entity.temperature); }
    if (entity.communication_status !== undefined) { sets.push('communication_status = ?'); params.push(entity.communication_status); }
    sets.push('updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')');
    params.push(entity.spacecraft_id);
    getDatabase()
      .prepare(`UPDATE spacecraft_entities SET ${sets.join(', ')} WHERE spacecraft_id = ?`)
      .run(...params);
  }

  public deleteEntity(spacecraftId: string): void {
    getDatabase().prepare('DELETE FROM spacecraft_entities WHERE spacecraft_id = ?').run(spacecraftId);
  }
}
