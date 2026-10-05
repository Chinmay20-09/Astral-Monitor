import { CommandEnvelope } from './command';

export type RiskSeverity = 'NORMAL' | 'SUSPICIOUS' | 'HIGH' | 'CRITICAL';
export type SecurityDecision = 'ALLOW' | 'MONITOR' | 'BLOCK' | 'SAFE_MODE';

export interface IntegrityCheckResult {
  passed: boolean;
  computed_signature: string;
  received_signature: string;
  algorithm: string;
  error?: string;
  /**
   * Server-side AES-GCM authenticated decryption outcome for encrypted
   * commands. Plaintext parameters only enter the security/policy path when
   * `passed` is true (confidentiality + authenticated encryption validation).
   */
  decryption?: {
    performed: boolean;
    passed: boolean;
    algorithm?: string;
    error?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface AuthenticationCheckResult {
  passed: boolean;
  key_id: string;
  authorized_identity?: string;
  role?: string;
  error?: string;
}

export interface ReplayCheckResult {
  passed: boolean;
  nonce_is_fresh: boolean;
  sequence_valid: boolean;
  timestamp_valid: boolean;
  clock_skew_seconds: number;
  expected_sequence: number;
  received_sequence: number;
  error?: string;
}

export interface BehavioralCheckResult {
  is_anomalous: boolean;
  anomaly_score: number; // 0 - 100
  confidence: number; // 0.0 - 1.0
  findings: string[];
  explanation: string;
  suggested_risk_delta: number;
  historical_pattern_detected?: string;
}

export interface MissionContextCheckResult {
  is_compliant: boolean;
  conflicting_rules: string[];
  current_phase: string;
  environmental_factors: string[];
  findings: string[];
  risk_contribution: number;
}

export interface RiskEngineResult {
  total_score: number; // 0 - 100
  severity: RiskSeverity;
  breakdown: {
    cryptographic_penalty: number;
    behavioral_penalty: number;
    mission_conflict_penalty: number;
    spacecraft_vulnerability_penalty: number;
    command_inherent_criticality: number;
  };
  summary: string;
}

export interface PolicyDecisionResult {
  decision: SecurityDecision;
  enforced_by_deterministic_rule: boolean;
  rule_triggered?: string;
  safe_mode_activated: boolean;
  safe_mode_reason?: string;
  operator_alert_dispatched: boolean;
  explanation: string;
}

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  command_id: string;
  spacecraft_id: string;
  sender_identity: string;
  envelope: CommandEnvelope;
  integrity: IntegrityCheckResult;
  authentication: AuthenticationCheckResult;
  replay: ReplayCheckResult;
  behavioral: BehavioralCheckResult;
  mission_context: MissionContextCheckResult;
  risk: RiskEngineResult;
  policy: PolicyDecisionResult;
  final_decision: SecurityDecision;
  simulated_attack_type?: string;
}
