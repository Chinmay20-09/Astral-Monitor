import { MissionContextModule, INITIAL_MISSION_STATE } from '../../../src/gateway/context';
import { MissionState } from '../../../src/models/mission';
import { MissionRepository } from '../db/repositories/missionRepository';

/**
 * Owns the mission context module and persists mission state so the active
 * orbital phase survives server restarts and browser refreshes.
 */
export class MissionService {
  private contextModule: MissionContextModule;
  private readonly missionRepository = new MissionRepository();

  constructor(spacecraftId = 'SAT-01') {
    const persisted = this.missionRepository.get(spacecraftId);
    if (persisted) {
      this.contextModule = new MissionContextModule(JSON.parse(persisted.mission_state_json) as MissionState);
      console.log(`[mission] restored mission state for ${spacecraftId} (phase: ${persisted.current_phase})`);
    } else {
      this.contextModule = new MissionContextModule();
      this.missionRepository.save(this.contextModule.getMissionState());
      console.log(`[mission] initialized mission state for ${spacecraftId}`);
    }
  }

  public getContextModule(): MissionContextModule {
    return this.contextModule;
  }

  public getMissionState(): MissionState {
    return this.contextModule.getMissionState();
  }

  public setPhase(phaseName: 'UMBRA_ECLIPSE' | 'FULL_SUN_IMAGING'): MissionState {
    this.contextModule.setMissionPhase(phaseName);
    this.missionRepository.save(this.contextModule.getMissionState());
    return this.contextModule.getMissionState();
  }

  /** Operator-initiated session reset back to the initial mission plan. */
  public reset(spacecraftId = 'SAT-01'): MissionState {
    this.missionRepository.delete(spacecraftId);
    this.contextModule = new MissionContextModule();
    this.missionRepository.save(this.contextModule.getMissionState());
    return this.contextModule.getMissionState();
  }
}

export { INITIAL_MISSION_STATE };
