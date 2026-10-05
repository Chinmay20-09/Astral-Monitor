import { SpacecraftSimulator } from '../../../src/spacecraft/simulator';
import { SpacecraftState, EssentialTelemetry } from '../../../src/models/spacecraft';
import { SpacecraftRepository } from '../db/repositories/spacecraftRepository';
import { MissionService } from './missionService';

/**
 * Owns the spacecraft simulator instance and keeps the persistent
 * spacecraft_state row in sync after every mutation (tick, executed command,
 * safe mode transitions). The vehicle resumes from its persisted state on startup.
 */
export class SpacecraftService {
  private simulator: SpacecraftSimulator;
  private heartbeatCounter = 0;
  private readonly spacecraftRepository = new SpacecraftRepository();

  constructor(
    private readonly missionService: MissionService,
    private readonly spacecraftId = 'SAT-01'
  ) {
    const persisted = this.spacecraftRepository.get(spacecraftId);
    if (persisted) {
      this.simulator = new SpacecraftSimulator(JSON.parse(persisted.state_json) as SpacecraftState);
      console.log(`[spacecraft] restored state for ${spacecraftId} (mode: ${persisted.operating_mode}, battery: ${persisted.battery_percent.toFixed(1)}%)`);
    } else {
      this.simulator = new SpacecraftSimulator();
      this.spacecraftRepository.save(this.simulator.getState());
      console.log(`[spacecraft] initialized vehicle ${spacecraftId}`);
    }
  }

  public getSimulator(): SpacecraftSimulator {
    return this.simulator;
  }

  public getState(): SpacecraftState {
    return this.simulator.getState();
  }

  public getTelemetry(): EssentialTelemetry {
    this.heartbeatCounter += 1;
    return this.spacecraftRepository.toTelemetry(this.simulator.getState(), this.heartbeatCounter);
  }

  /** Persists the current simulator state (used after command processing). */
  public persist(): void {
    this.spacecraftRepository.save(this.simulator.getState());
  }

  /** Live spacecraft_state row (used by route / health endpoints). */
  public getRepository(): SpacecraftRepository {
    return this.spacecraftRepository;
  }

  /**
   * Advances the physics simulation and persists the result. Eclipse condition
   * is derived from the persisted mission phase, exactly like the previous
   * in-browser tick loop in App.tsx.
   */
  public tick(deltaSeconds = 2.0): { state: SpacecraftState; telemetry: EssentialTelemetry } {
    const isEclipse = this.missionService.getMissionState().current_phase.solar_condition === 'UMBRA_ECLIPSE';
    this.simulator.tick(deltaSeconds, isEclipse);
    const state = this.simulator.getState();
    this.spacecraftRepository.save(state);
    return { state, telemetry: this.getTelemetry() };
  }

  /** Operator-initiated session reset back to the initial vehicle state. */
  public reset(): { state: SpacecraftState; telemetry: EssentialTelemetry } {
    this.spacecraftRepository.delete(this.spacecraftId);
    this.simulator = new SpacecraftSimulator();
    this.spacecraftRepository.save(this.simulator.getState());
    this.heartbeatCounter = 0;
    return { state: this.simulator.getState(), telemetry: this.getTelemetry() };
  }
}
