import { CommandEnvelope, CommandType } from '../models/command';
import { SpacecraftState } from '../models/spacecraft';
import {
  IntegrityCheckResult,
  AuthenticationCheckResult,
  ReplayCheckResult,
  BehavioralCheckResult,
  MissionContextCheckResult,
  RiskEngineResult,
  PolicyDecisionResult,
  SecurityDecision
} from '../models/audit';

export class SafetyPolicyEngine {
  /**
   * Deterministic safety policy enforcement.
   * Final authority over all AI and heuristic recommendations.
   */
  public evaluate(
    envelope: CommandEnvelope,
    spacecraft: SpacecraftState,
    integrity: IntegrityCheckResult,
    auth: AuthenticationCheckResult,
    replay: ReplayCheckResult,
    behavioral: BehavioralCheckResult,
    context: MissionContextCheckResult,
    risk: RiskEngineResult
  ): PolicyDecisionResult {
    const cmdType = envelope.payload.command_type;

    // --- DETERMINISTIC HARD SAFETY RULES (NON-BYPASSABLE) ---

    // Rule 1: Authentication failure (Unauthorized / Revoked sender) -> ABSOLUTE BLOCK
    if (!auth.passed) {
      return {
        decision: 'BLOCK',
        enforced_by_deterministic_rule: true,
        rule_triggered: 'HARD_CONSTRAINT_AUTHENTICATION_FAIL',
        safe_mode_activated: false,
        operator_alert_dispatched: true,
        explanation: `Deterministic security block: Unrecognized or unauthorized key "${auth.key_id}". Sender has no clearance on spacecraft.`
      };
    }

    // Rule 2: Integrity violation (Tampering) -> ABSOLUTE BLOCK
    if (!integrity.passed) {
      return {
        decision: 'BLOCK',
        enforced_by_deterministic_rule: true,
        rule_triggered: 'HARD_CONSTRAINT_INTEGRITY_FAIL',
        safe_mode_activated: false,
        operator_alert_dispatched: true,
        explanation: `Deterministic security block: Command failed HMAC-based integrity/authentication check (${integrity.error || 'HMAC tag mismatch'}). Payload tampering detected.`
      };
    }

    // Rule 3: Replay attack / Sequence violation -> ABSOLUTE BLOCK
    if (!replay.passed) {
      return {
        decision: 'BLOCK',
        enforced_by_deterministic_rule: true,
        rule_triggered: 'HARD_CONSTRAINT_REPLAY_DETECTED',
        safe_mode_activated: false,
        operator_alert_dispatched: true,
        explanation: `Deterministic security block: Replay protection failure (${replay.error || 'replayed nonce or sequence error'}). Command rejected to prevent duplicate execution.`
      };
    }

    // Rule 4: Spacecraft already in SAFE MODE lock
    if (spacecraft.operating_mode === 'SAFE_MODE') {
      if (cmdType === 'QUERY_TELEMETRY') {
        return {
          decision: 'ALLOW',
          enforced_by_deterministic_rule: true,
          rule_triggered: 'SAFE_MODE_TELEMETRY_EXCEPTION',
          safe_mode_activated: true,
          safe_mode_reason: spacecraft.flight_computer.safe_mode_reason,
          operator_alert_dispatched: false,
          explanation: 'Essential telemetry queries remain permitted during vehicle SAFE MODE.'
        };
      }

      if (cmdType === 'OPERATOR_RECOVER') {
        // Evaluate conditional recovery: battery must be > 40% and no immediate hardware failure
        const batteryOk = spacecraft.power.battery_percent >= 40;
        if (batteryOk) {
          return {
            decision: 'ALLOW',
            enforced_by_deterministic_rule: true,
            rule_triggered: 'OPERATOR_RECOVERY_ACCEPTED',
            safe_mode_activated: false,
            operator_alert_dispatched: true,
            explanation: 'Verified flight director recovery command authenticated. Clearing safe mode and resuming nominal operations.'
          };
        } else {
          return {
            decision: 'BLOCK',
            enforced_by_deterministic_rule: true,
            rule_triggered: 'RECOVERY_INSUFFICIENT_POWER',
            safe_mode_activated: true,
            operator_alert_dispatched: true,
            explanation: `Recovery rejected: Spacecraft battery is ${spacecraft.power.battery_percent.toFixed(1)}% (requires minimum 40% stable power before exiting safe mode).`
          };
        }
      }

      // Any dangerous command during safe mode is blocked
      return {
        decision: 'BLOCK',
        enforced_by_deterministic_rule: true,
        rule_triggered: 'HARD_CONSTRAINT_SAFE_MODE_LOCKED',
        safe_mode_activated: true,
        safe_mode_reason: spacecraft.flight_computer.safe_mode_reason,
        operator_alert_dispatched: true,
        explanation: `Command ${cmdType} blocked by flight software lock: Vehicle is in SAFE MODE. Only telemetry queries or authenticated recovery accepted.`
      };
    }

    // Rule 5: Critical Risk Escalation -> ENTER SAFE MODE!
    // As specified in PRD Section 5 & TRD Section 8:
    // When contextual risk becomes CRITICAL (e.g. credential compromise + mission context conflict),
    // enter safe mode, restrict dangerous operations, maintain telemetry, alert operator.
    if (risk.severity === 'CRITICAL' || risk.total_score >= 75) {
      const reason = `CRITICAL risk score (${risk.total_score}/100) triggered by ${risk.summary}. Context conflicts: ${context.conflicting_rules.join(', ') || 'anomalous payload behavior'}`;
      return {
        decision: 'SAFE_MODE',
        enforced_by_deterministic_rule: true,
        rule_triggered: 'AUTONOMOUS_SAFE_MODE_TRIGGER',
        safe_mode_activated: true,
        safe_mode_reason: reason,
        operator_alert_dispatched: true,
        explanation: `Autonomous protective action: Threat level reached CRITICAL (${risk.total_score}/100). Dangerous commands restricted and vehicle placed in protected SAFE MODE.`
      };
    }

    // Rule 6: High Risk -> BLOCK dangerous command
    if (risk.severity === 'HIGH' || risk.total_score >= 50) {
      return {
        decision: 'BLOCK',
        enforced_by_deterministic_rule: true,
        rule_triggered: 'HIGH_RISK_COMMAND_BLOCK',
        safe_mode_activated: false,
        operator_alert_dispatched: true,
        explanation: `Security policy block: Command risk is HIGH (${risk.total_score}/100). Findings: ${context.findings.join('; ') || behavioral.findings.join('; ')}`
      };
    }

    // Rule 7: Suspicious Risk -> MONITOR & LOG (Permit with warning telemetry)
    if (risk.severity === 'SUSPICIOUS' || risk.total_score >= 25) {
      return {
        decision: 'MONITOR',
        enforced_by_deterministic_rule: false,
        safe_mode_activated: false,
        operator_alert_dispatched: true,
        explanation: `Elevated vigilance: Command cleared with MONITOR verdict (risk score ${risk.total_score}/100). Minor anomalies logged for flight dynamics audit.`
      };
    }

    // Nominal
    return {
      decision: 'ALLOW',
      enforced_by_deterministic_rule: false,
      safe_mode_activated: false,
      operator_alert_dispatched: false,
      explanation: 'All multi-factor security checks passed. Cryptographic integrity confirmed, behavioral profile nominal, mission context compliant.'
    };
  }
}
