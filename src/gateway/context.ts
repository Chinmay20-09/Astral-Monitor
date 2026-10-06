import { CommandEnvelope } from '../models/command';
import { SpacecraftState } from '../models/spacecraft';
import { MissionState, MissionDocument } from '../models/mission';
import { MissionContextCheckResult } from '../models/audit';

export const DEFAULT_MISSION_DOCUMENTS: MissionDocument[] = [
  {
    id: 'FOP-SAT01-V3',
    title: 'Flight Operations Plan — LEO Sentinel-1 Mission',
    classification: 'RESTRICTED / FLIGHT OPS',
    version: '3.4.1',
    summary: 'Master operational procedures, orbital eclipse schedules, and subsystem power envelopes.',
    content: `
Section 4.2 Eclipse Power Discipline:
During orbital umbra (eclipse), solar arrays produce 0 Watts. The spacecraft relies exclusively on Li-Ion bus batteries. All high-draw science payloads, including the multispectral optical imager (180W draw), MUST remain powered down to prevent bus undervoltage.

Section 5.1 Orbit Dynamics & Propulsion:
Station-keeping thruster firings are strictly restricted to scheduled sunlit apogee burns. Any unplanned delta-V burn exceeding 2.0 m/s poses imminent risk of orbital collision and rapid propellant exhaustion.

Section 8.4 Ground Pass Command Windows:
Critical system resets (SYSTEM_REBOOT) and firmware reconfigurations are prohibited during autonomous eclipse passes without direct high-rate S-band ground lock.
    `.trim()
  },
  {
    id: 'SAFETY-DIR-08',
    title: 'Spacecraft Autonomous Safety Directives',
    classification: 'MANDATORY SAFETY',
    version: '1.2',
    summary: 'Safety constraints that override operational commands to prevent vehicle loss.',
    content: `
Directive 01: Reaction wheel angular momentum must never exceed 5500 RPM on any single axis to avoid bearing seizure.
Directive 02: Spacecraft shall autonomously enter SAFE MODE upon detection of anomalous command bursts or unverified orbit alteration attempts.
    `.trim()
  }
];

export const INITIAL_MISSION_STATE: MissionState = {
  mission_id: 'ORBITSHIELD-LEO-01',
  spacecraft_id: 'SAT-01',
  orbit_altitude_km: 540,
  current_phase: {
    name: 'UMBRA_ECLIPSE',
    current: true,
    start_time: '2026-10-03T16:00:00Z',
    end_time: '2026-10-03T16:36:00Z',
    allowed_commands: ['QUERY_TELEMETRY', 'OPERATOR_RECOVER'],
    restricted_commands: ['CAPTURE_IMAGE', 'FIRE_THRUSTER', 'SYSTEM_REBOOT'],
    solar_condition: 'UMBRA_ECLIPSE',
    description: 'Spacecraft is currently in Earth penumbra/umbra shadow. Solar array power is 0W. Battery discharge only.'
  },
  all_phases: [
    {
      name: 'FULL_SUN_IMAGING',
      current: false,
      start_time: '2026-10-03T16:36:00Z',
      end_time: '2026-10-03T17:25:00Z',
      allowed_commands: ['QUERY_TELEMETRY', 'CAPTURE_IMAGE', 'ROTATE_REACTION_WHEEL', 'TRANSMIT_DATA', 'SET_POWER_MODE'],
      restricted_commands: ['FIRE_THRUSTER'],
      solar_condition: 'FULL_SUN',
      description: 'Daylight pass over target landmass. Solar arrays generate nominal 320W.'
    },
    {
      name: 'UMBRA_ECLIPSE',
      current: true,
      start_time: '2026-10-03T16:00:00Z',
      end_time: '2026-10-03T16:36:00Z',
      allowed_commands: ['QUERY_TELEMETRY', 'OPERATOR_RECOVER'],
      restricted_commands: ['CAPTURE_IMAGE', 'FIRE_THRUSTER', 'SYSTEM_REBOOT'],
      solar_condition: 'UMBRA_ECLIPSE',
      description: 'Earth shadow eclipse. Power conservation mode enforced.'
    }
  ],
  active_constraints: [
    {
      id: 'RULE-OPT-02',
      name: 'No Payload Imaging in Eclipse',
      description: 'Optical payload consumes 180W and target is unlit; prohibited during umbra.',
      rule_type: 'POWER_RESTRICTION',
      evaluator: 'FOP Section 4.2'
    },
    {
      id: 'RULE-NAV-04',
      name: 'Thruster Burn Delta-V Ceiling',
      description: 'Unplanned impulsive thruster burn exceeds delta-v safety envelope (> 2.0 m/s).',
      rule_type: 'THRUST_LIMIT',
      evaluator: 'FOP Section 5.1'
    },
    {
      id: 'RULE-WHEEL-01',
      name: 'Wheel Speed Limit',
      description: 'Reaction wheel spin rate cannot exceed 5500 RPM.',
      rule_type: 'MODE_LOCK',
      evaluator: 'SAFETY-DIR-08'
    }
  ],
  mission_documents: DEFAULT_MISSION_DOCUMENTS
};

export class MissionContextModule {
  private missionState: MissionState;

  constructor(initialState?: MissionState) {
    this.missionState = initialState || JSON.parse(JSON.stringify(INITIAL_MISSION_STATE));
  }

  public getMissionState(): MissionState {
    return this.missionState;
  }

  public setMissionPhase(phaseName: 'UMBRA_ECLIPSE' | 'FULL_SUN_IMAGING'): void {
    const phase = this.missionState.all_phases.find(p => p.name === phaseName);
    if (phase) {
      this.missionState.all_phases.forEach(p => (p.current = p.name === phaseName));
      this.missionState.current_phase = { ...phase, current: true };
    }
  }

  /**
   * Resolves mission context against the proposed command and spacecraft state
   */
  public evaluate(envelope: CommandEnvelope, spacecraftState: SpacecraftState): MissionContextCheckResult {
    const cmdType = envelope.payload.command_type;
    const currentPhase = this.missionState.current_phase;
    const conflictingRules: string[] = [];
    const environmentalFactors: string[] = [];
    const findings: string[] = [];
    let riskContribution = 0;

    // Environmental state recording
    environmentalFactors.push(`Phase: ${currentPhase.name} (${currentPhase.solar_condition})`);
    environmentalFactors.push(`Solar Generation: ${spacecraftState.power.solar_generation_watts.toFixed(1)} W`);
    environmentalFactors.push(`Battery State: ${spacecraftState.power.battery_percent.toFixed(1)}%`);

    // 1. Eclipse vs Camera conflict
    if (currentPhase.solar_condition === 'UMBRA_ECLIPSE' && cmdType === 'CAPTURE_IMAGE') {
      conflictingRules.push('RULE-OPT-02: No Payload Imaging in Eclipse (FOP Sec 4.2)');
      findings.push('Attempted optical payload high-power activation (180W draw) during orbital eclipse with 0W solar generation.');
      riskContribution += 75;
    }

    // 2. Thruster Burn safety check
    if (cmdType === 'FIRE_THRUSTER') {
      const deltaV = envelope.payload.parameters?.delta_v ?? 0;
      const burnDuration = envelope.payload.parameters?.burn_duration_ms ?? 0;

      if (deltaV > 2.0 || burnDuration > 15000) {
        conflictingRules.push(`RULE-NAV-04: Thruster delta_v limit exceeded (${deltaV} m/s > 2.0 m/s limit)`);
        findings.push(`Dangerous impulsive thruster burn of ${deltaV} m/s requested without pre-computed ephemeris corridor approval.`);
        riskContribution += 65;
      }

      if (currentPhase.restricted_commands.includes('FIRE_THRUSTER')) {
        conflictingRules.push('RULE-PHASE-RESTRICT: Propulsion subsystem locked during current orbital phase');
        findings.push(`Thruster firing prohibited during ${currentPhase.name}.`);
        riskContribution += 35;
      }
    }

    // 3. Reaction wheel saturation check
    if (cmdType === 'ROTATE_REACTION_WHEEL') {
      const rpm = Math.abs(envelope.payload.parameters?.rpm ?? 0);
      if (rpm > 5500) {
        conflictingRules.push(`RULE-WHEEL-01: Wheel speed ${rpm} RPM exceeds bearing safety limit (5500 RPM)`);
        findings.push(`Excessive momentum dump requested that risks physical reaction wheel destruction.`);
        riskContribution += 60;
      }
    }

    // 4. Critical reboot during eclipse or low power
    if (cmdType === 'SYSTEM_REBOOT') {
      if (spacecraftState.power.battery_percent < 40 || currentPhase.solar_condition === 'UMBRA_ECLIPSE') {
        conflictingRules.push('RULE-REBOOT-PWR: System reboot prohibited under marginal power condition (<40% battery / eclipse)');
        findings.push(`High risk of cold boot failure or flight computer brownout during unmonitored eclipse.`);
        riskContribution += 70;
      }
    }

    // 5. Operating mode lock
    if (spacecraftState.operating_mode === 'SAFE_MODE' && cmdType !== 'QUERY_TELEMETRY' && cmdType !== 'OPERATOR_RECOVER') {
      conflictingRules.push('RULE-SAFE-LOCK: Spacecraft in SAFE_MODE; all payload & attitude commands locked');
      findings.push(`Vehicle is in protective SAFE_MODE. Command ${cmdType} rejected by flight software lock.`);
      riskContribution += 50;
    }

    const isCompliant = conflictingRules.length === 0;

    if (isCompliant) {
      findings.push(`Command ${cmdType} is consistent with ${currentPhase.name} flight plan and active constraints.`);
    }

    return {
      is_compliant: isCompliant,
      conflicting_rules: conflictingRules,
      current_phase: currentPhase.name,
      environmental_factors: environmentalFactors,
      findings,
      risk_contribution: Math.min(riskContribution, 80)
    };
  }
}
