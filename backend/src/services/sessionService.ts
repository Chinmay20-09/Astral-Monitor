import { SessionRepository } from '../db/repositories/sessionRepository';
import { SpacecraftRepository } from '../db/repositories/spacecraftRepository';

/** Active mission session (session_id → spacecraft → mission). SQLite is authoritative. */
export class SessionService {
  private readonly sessionRepository = new SessionRepository();
  private readonly spacecraftRepository = new SpacecraftRepository();

  /**
   * Launch a new mission: spacecraft entity + active session created server-side.
   * Returns the session id to drive the UI redirect.
   */
  public createMissionSession(
    spacecraft_id: string,
    name: string,
    mission_name: string,
    mission_type: string,
    orbit_type: string,
    orbit_altitude_km: number,
    ground_station: string,
    operator_name: string
  ): { session_id: string; spacecraft_id: string } {
    const mission_id = mission_name || 'ORBITSHIELD-LEO-01';
    this.spacecraftRepository.createEntity({
      spacecraft_id,
      name,
      mission_name,
      mission_type,
      orbit_type,
      orbit_altitude_km,
      ground_station,
      operator_name,
      operating_mode: 'NOMINAL',
      battery_percent: 88.5,
      temperature: 18.2,
      communication_status: 'ONLINE'
    });
    const session_id = this.sessionRepository.create({
      spacecraft_id,
      mission_id,
      status: 'ACTIVE'
    });
    return { session_id, spacecraft_id };
  }

  /** Activate an existing session (deactivates any previous active session). */
  public activateSession(sessionId: string): void {
    this.sessionRepository.activate(sessionId);
  }

  public listSessions(): ReturnType<SessionRepository['list']> {
    return this.sessionRepository.list();
  }

  public getSession(sessionId: string): ReturnType<SessionRepository['get']> {
    return this.sessionRepository.get(sessionId);
  }

  public getActiveSession(): ReturnType<SessionRepository['getActive']> {
    return this.sessionRepository.getActive();
  }

  public deleteSession(sessionId: string): void {
    this.sessionRepository.delete(sessionId);
  }
}
