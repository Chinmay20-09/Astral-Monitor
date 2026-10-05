import { getDatabase } from '../database';
import { MissionState } from '../../../../src/models/mission';

export interface MissionStateRow {
  spacecraft_id: string;
  mission_state_json: string;
  current_phase: string;
  updated_at: string;
}

export class MissionRepository {
  public get(spacecraftId: string): MissionStateRow | undefined {
    return getDatabase()
      .prepare('SELECT * FROM mission_state WHERE spacecraft_id = ?')
      .get(spacecraftId) as MissionStateRow | undefined;
  }

  public save(missionState: MissionState): void {
    getDatabase()
      .prepare(
        `INSERT INTO mission_state (spacecraft_id, mission_state_json, current_phase, updated_at)
         VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(spacecraft_id) DO UPDATE SET
           mission_state_json = excluded.mission_state_json,
           current_phase = excluded.current_phase,
           updated_at = excluded.updated_at`
      )
      .run(
        missionState.spacecraft_id,
        JSON.stringify(missionState),
        missionState.current_phase.name
      );
  }

  public delete(spacecraftId: string): void {
    getDatabase().prepare('DELETE FROM mission_state WHERE spacecraft_id = ?').run(spacecraftId);
  }
}
