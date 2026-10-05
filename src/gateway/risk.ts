import { CommandEnvelope, CommandType } from '../models/command';
import { SpacecraftState } from '../models/spacecraft';
import {
  IntegrityCheckResult,
  AuthenticationCheckResult,
  ReplayCheckResult,
  BehavioralCheckResult,
  MissionContextCheckResult,
  RiskEngineResult,
  RiskSeverity
} from '../models/audit';

// Inherent criticality of commands
const COMMAND_BASE_CRITICALITY: Record<CommandType, number> = {
  QUERY_TELEMETRY: 5,
  CAPTURE_IMAGE: 25,
  TRANSMIT_DATA: 15,
  SET_POWER_MODE: 35,
  ROTATE_REACTION_WHEEL: 40,
  FIRE_THRUSTER: 70,
  SYSTEM_REBOOT: 85,
  EMERGENCY_SAFE_MODE: 60,
  OPERATOR_RECOVER: 30
};

export class RiskEngine {
  /**
   * Evaluates the contextual multi-factor risk score (0-100)
   */
  public evaluate(
    envelope: CommandEnvelope,
    spacecraft: SpacecraftState,
    integrity: IntegrityCheckResult,
    auth: AuthenticationCheckResult,
    replay: ReplayCheckResult,
    behavioral: BehavioralCheckResult,
    context: MissionContextCheckResult
  ): RiskEngineResult {
    let cryptoPenalty = 0;
    let behavioralPenalty = 0;
    let missionPenalty = 0;
    let spacecraftPenalty = 0;

    // 1. Cryptographic Penalties (Tampering, Unauthorized, Replay)
    if (!integrity.passed) {
      cryptoPenalty += 60; // Tampering is high-impact
    }
    if (!auth.passed) {
      cryptoPenalty += 55; // Unauthorized sender
    }
    if (!replay.passed) {
      cryptoPenalty += 50; // Replayed message
    }
    cryptoPenalty = Math.min(85, cryptoPenalty);

    // 2. Behavioral Penalties
    if (behavioral.is_anomalous) {
      behavioralPenalty = behavioral.anomaly_score;
    }

    // 3. Mission Context Penalties
    if (!context.is_compliant) {
      missionPenalty = context.risk_contribution;
    }

    // 4. Spacecraft State Vulnerability Penalties
    // If spacecraft is already in degraded state or low battery, risky commands are penalized more
    if (spacecraft.power.battery_percent < 25) {
      spacecraftPenalty += 20;
    }
    if (spacecraft.operating_mode === 'SAFE_MODE') {
      spacecraftPenalty += 25;
    }
    if (spacecraft.thermal.bus_temp_celsius > 45 || spacecraft.thermal.bus_temp_celsius < -15) {
      spacecraftPenalty += 15;
    }

    // 5. Inherent Command Criticality
    const inherentCriticality = COMMAND_BASE_CRITICALITY[envelope.payload.command_type] || 20;

    // Weight and combine
    let totalScore = 0;

    if (cryptoPenalty > 0) {
      // If cryptographic breach occurred, minimum risk is already in HIGH / CRITICAL range
      totalScore = Math.max(cryptoPenalty, 55) + Math.round(inherentCriticality * 0.25);
    } else {
      // Cryptography passed: risk is driven by behavioral anomaly + mission conflict + inherent criticality
      totalScore = Math.round(
        inherentCriticality * 0.35 +
        behavioralPenalty * 0.4 +
        missionPenalty * 0.5 +
        spacecraftPenalty * 0.25
      );
    }

    // Bound between 0 and 100
    totalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

    // Map to severity thresholds per TRD Section 7
    let severity: RiskSeverity = 'NORMAL';
    if (totalScore >= 75) {
      severity = 'CRITICAL';
    } else if (totalScore >= 50) {
      severity = 'HIGH';
    } else if (totalScore >= 25) {
      severity = 'SUSPICIOUS';
    } else {
      severity = 'NORMAL';
    }

    const summaryParts: string[] = [];
    if (cryptoPenalty > 0) summaryParts.push(`Crypto failure (penalty +${cryptoPenalty})`);
    if (behavioralPenalty > 0) summaryParts.push(`Behavioral anomaly (penalty +${behavioralPenalty})`);
    if (missionPenalty > 0) summaryParts.push(`Mission rule conflict (penalty +${missionPenalty})`);
    if (spacecraftPenalty > 0) summaryParts.push(`Vehicle vulnerability (penalty +${spacecraftPenalty})`);

    const summary = summaryParts.length > 0
      ? summaryParts.join('; ')
      : 'All security checks nominal; nominal risk posture.';

    return {
      total_score: totalScore,
      severity,
      breakdown: {
        cryptographic_penalty: cryptoPenalty,
        behavioral_penalty: behavioralPenalty,
        mission_conflict_penalty: missionPenalty,
        spacecraft_vulnerability_penalty: spacecraftPenalty,
        command_inherent_criticality: inherentCriticality
      },
      summary
    };
  }
}
