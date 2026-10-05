import { CommandEnvelope, CommandType } from '../models/command';
import { SpacecraftState } from '../models/spacecraft';
import { BehavioralCheckResult } from '../models/audit';

export interface CommandHistoryEntry {
  command_id: string;
  command_type: CommandType;
  timestamp: string;
  sender_key_id: string;
  verdict?: string;
}

export class BehavioralAnalysisModule {
  private history: CommandHistoryEntry[] = [];
  private readonly MAX_HISTORY = 50;

  public getHistory(): CommandHistoryEntry[] {
    return [...this.history];
  }

  public recordCommand(envelope: CommandEnvelope, verdict?: string): void {
    this.history.unshift({
      command_id: envelope.header.command_id,
      command_type: envelope.payload.command_type,
      timestamp: envelope.header.timestamp,
      sender_key_id: envelope.security.key_id,
      verdict
    });

    if (this.history.length > this.MAX_HISTORY) {
      this.history.pop();
    }
  }

  public clearHistory(): void {
    this.history = [];
  }

  /**
   * Analyzes behavioral sequence and state consistency
   */
  public evaluate(
    envelope: CommandEnvelope,
    spacecraftState: SpacecraftState
  ): BehavioralCheckResult {
    const cmdType = envelope.payload.command_type;
    const cmdTime = new Date(envelope.header.timestamp).getTime();
    const findings: string[] = [];
    let anomalyScore = 0;
    let confidence = 0.85;
    let historicalPattern: string | undefined;

    // Pattern 1: Rapid Command Flooding / Burst Attack
    // Check how many commands arrived in the last 10 seconds
    const recentTenSec = this.history.filter(h => {
      const t = new Date(h.timestamp).getTime();
      return Math.abs(cmdTime - t) <= 10000;
    });

    if (recentTenSec.length >= 4) {
      anomalyScore += 45;
      findings.push(`High-frequency command burst detected: ${recentTenSec.length + 1} commands in a 10s window (threshold: <= 3).`);
      historicalPattern = 'COMMAND_BURST_FLOODING';
    }

    // Pattern 2: State-Conflict / Destructive Drain
    if (cmdType === 'CAPTURE_IMAGE' && spacecraftState.power.battery_percent < 30) {
      anomalyScore += 40;
      findings.push(`Anomalous payload activation: Optical imaging requested while battery is critically depleted (${spacecraftState.power.battery_percent.toFixed(1)}% < 30%).`);
      historicalPattern = historicalPattern || 'CRITICAL_POWER_DEPLETION_ATTEMPT';
    }

    // Pattern 3: Propulsion or Wheel tumbling without diagnostic verification
    if (cmdType === 'FIRE_THRUSTER') {
      const deltaV = envelope.payload.parameters?.delta_v ?? 0;
      if (deltaV > 2.0) {
        anomalyScore += 45;
        findings.push(`Anomalous propulsion impulse: delta-V ${deltaV} m/s exceeds nominal 2.0 m/s trajectory corridor.`);
        historicalPattern = historicalPattern || 'EXCESSIVE_DELTA_V_MANEUVER';
      }

      const priorCommands = this.history.slice(0, 3).map(h => h.command_type);
      const hasTelemetryOrAlignment = priorCommands.includes('QUERY_TELEMETRY') || priorCommands.includes('ROTATE_REACTION_WHEEL');
      if (!hasTelemetryOrAlignment && this.history.length > 0) {
        anomalyScore += 35;
        findings.push('Uncoordinated propulsion firing: Delta-V maneuver initiated without preceding attitude verification or telemetry query.');
        historicalPattern = historicalPattern || 'UNCOORDINATED_PROPULSION_MANEUVER';
      }
    }

    // Pattern 4: Repeated Dangerous Retries
    const recentBlocks = this.history.slice(0, 3).filter(h => h.verdict === 'BLOCK' || h.verdict === 'SAFE_MODE');
    if (recentBlocks.length >= 2) {
      anomalyScore += 30;
      findings.push(`Adversarial persistence detected: multiple previous commands were blocked immediately preceding this command.`);
      confidence = 0.95;
    }

    // Pattern 5: Credential Compromise Signature
    // If the sender is using valid credentials but abruptly switching from nominal query to destructive thrusters or system reboot
    if ((cmdType === 'SYSTEM_REBOOT' || cmdType === 'FIRE_THRUSTER') && this.history.length > 2) {
      const allPreviousWereTelemetry = this.history.slice(0, 3).every(h => h.command_type === 'QUERY_TELEMETRY');
      if (allPreviousWereTelemetry && envelope.payload.parameters?.delta_v > 2.0) {
        anomalyScore += 50;
        findings.push('Compromised credential indicator: sudden abrupt deviation from passive telemetry queries to uncoordinated orbital perturbation.');
        historicalPattern = 'CREDENTIAL_COMPROMISE_DEVIATION';
      }
    }

    // Normal baseline assessment
    if (findings.length === 0) {
      findings.push(`Command ${cmdType} fits nominal operational profile and command distribution baseline.`);
      anomalyScore = 5;
      confidence = 0.92;
    }

    anomalyScore = Math.min(100, Math.max(0, anomalyScore));
    const isAnomalous = anomalyScore >= 40;

    let explanation = '';
    if (isAnomalous) {
      explanation = `Behavioral anomaly detected (score ${anomalyScore}/100, confidence ${(confidence * 100).toFixed(0)}%). Sequence analysis flagged: ${findings.join(' ')}`;
    } else {
      explanation = `Command stream behavioral pattern is nominal (score ${anomalyScore}/100, confidence ${(confidence * 100).toFixed(0)}%).`;
    }

    return {
      is_anomalous: isAnomalous,
      anomaly_score: anomalyScore,
      confidence,
      findings,
      explanation,
      suggested_risk_delta: isAnomalous ? Math.round(anomalyScore * 0.7) : 0,
      historical_pattern_detected: historicalPattern
    };
  }
}
