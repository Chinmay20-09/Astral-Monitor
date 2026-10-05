import { CommandEnvelope } from '../models/command';
import { SpacecraftState, EssentialTelemetry } from '../models/spacecraft';
import { AuditEvent, SecurityDecision } from '../models/audit';
import { IntegrityModule } from './integrity';
import { AuthenticationModule } from './authentication';
import { ReplayProtectionModule } from './replay';
import { BehavioralAnalysisModule } from './behavioral';
import { MissionContextModule } from './context';
import { RiskEngine } from './risk';
import { SafetyPolicyEngine } from './policy';
import { SpacecraftSimulator } from '../spacecraft/simulator';

export interface GatewayProcessResult {
  audit_event: AuditEvent;
  executed: boolean;
  execution_message?: string;
  spacecraft_state: SpacecraftState;
  telemetry: EssentialTelemetry;
}

export class SecurityGateway {
  public integrityModule: IntegrityModule;
  public authModule: AuthenticationModule;
  public replayModule: ReplayProtectionModule;
  public behavioralModule: BehavioralAnalysisModule;
  public contextModule: MissionContextModule;
  public riskEngine: RiskEngine;
  public policyEngine: SafetyPolicyEngine;
  public spacecraft: SpacecraftSimulator;
  private auditLog: AuditEvent[] = [];

  constructor(
    spacecraft?: SpacecraftSimulator,
    contextModule?: MissionContextModule,
    options?: { maxClockSkewSeconds?: number }
  ) {
    this.integrityModule = new IntegrityModule();
    this.authModule = new AuthenticationModule();
    this.replayModule = new ReplayProtectionModule({ maxClockSkewSeconds: options?.maxClockSkewSeconds });
    this.behavioralModule = new BehavioralAnalysisModule();
    // Context module can be injected so mission state persists outside the gateway process
    this.contextModule = contextModule || new MissionContextModule();
    this.riskEngine = new RiskEngine();
    this.policyEngine = new SafetyPolicyEngine();
    this.spacecraft = spacecraft || new SpacecraftSimulator();
  }

  public getAuditLog(): AuditEvent[] {
    return [...this.auditLog];
  }

  public clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Main sequential security gateway pipeline
   */
  public async processCommand(
    envelope: CommandEnvelope,
    options?: { attackType?: string }
  ): Promise<GatewayProcessResult> {
    const eventId = `EVT-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const timestamp = new Date().toISOString();
    const currentSpacecraftState = this.spacecraft.getState();

    // 1. Schema / Structural Validation
    if (!envelope || !envelope.header || !envelope.payload || !envelope.security) {
      const dummyAudit: AuditEvent = {
        event_id: eventId,
        timestamp,
        command_id: envelope?.header?.command_id || 'UNKNOWN',
        spacecraft_id: envelope?.header?.spacecraft_id || 'SAT-01',
        sender_identity: 'MALFORMED',
        envelope: envelope || ({} as any),
        integrity: { passed: false, computed_signature: '', received_signature: '', algorithm: 'NONE', error: 'Malformed envelope' },
        authentication: { passed: false, key_id: 'NONE', error: 'Missing security header' },
        replay: { passed: false, nonce_is_fresh: false, sequence_valid: false, timestamp_valid: false, clock_skew_seconds: 0, expected_sequence: 0, received_sequence: 0, error: 'Malformed header' },
        behavioral: { is_anomalous: true, anomaly_score: 90, confidence: 1.0, findings: ['Malformed packet structure'], explanation: 'Syntax rejection', suggested_risk_delta: 50 },
        mission_context: { is_compliant: false, conflicting_rules: ['SYNTAX_ERROR'], current_phase: 'UNKNOWN', environmental_factors: [], findings: ['Packet rejected at parser boundary'], risk_contribution: 50 },
        risk: { total_score: 95, severity: 'CRITICAL', breakdown: { cryptographic_penalty: 80, behavioral_penalty: 50, mission_conflict_penalty: 50, spacecraft_vulnerability_penalty: 0, command_inherent_criticality: 50 }, summary: 'Packet parser failure' },
        policy: { decision: 'BLOCK', enforced_by_deterministic_rule: true, rule_triggered: 'SCHEMA_PARSE_FAILURE', safe_mode_activated: false, operator_alert_dispatched: true, explanation: 'Malformed envelope rejected by gateway parser.' },
        final_decision: 'BLOCK',
        simulated_attack_type: options?.attackType
      };
      this.auditLog.unshift(dummyAudit);
      return {
        audit_event: dummyAudit,
        executed: false,
        execution_message: 'Malformed envelope rejected by gateway parser.',
        spacecraft_state: currentSpacecraftState,
        telemetry: this.spacecraft.getEssentialTelemetry()
      };
    }

    // 2. Authentication: Look up sender's registered key
    const authResult = this.authModule.authenticate(envelope);
    const cred = authResult.passed ? this.authModule.getCredential(envelope.security.key_id) : undefined;
    const secretKey = cred ? cred.secret_key : 'unregistered-dummy-key';

    // 3. Cryptographic Integrity: Verify HMAC-based integrity/authentication tag over the
    //    canonical payload. For AES-GCM encrypted commands the server-side credential's
    //    transport key validates authenticated encryption and recovers the plaintext
    //    parameters; the wire plaintext is never trusted as authoritative.
    const integrityResult = await this.integrityModule.verifyIntegrity(envelope, secretKey, {
      encryptionKey: cred?.encryption_key
    });

    // Effective command view: for encrypted commands the plaintext parameters only exist
    // after successful authenticated decryption. The original wire envelope (ciphertext,
    // redacted parameters) is preserved verbatim for the audit evidence.
    const effectiveEnvelope: CommandEnvelope =
      integrityResult.decryption?.passed && integrityResult.decryption.parameters
        ? {
            ...envelope,
            payload: {
              command_type: envelope.payload.command_type,
              parameters: integrityResult.decryption.parameters as CommandEnvelope['payload']['parameters']
            }
          }
        : envelope;

    // 4. Replay Protection: Nonce uniqueness, timestamp clock skew, monotonic sequence.
    //    Anti-replay state only advances for cryptographically verified commands —
    //    tampered or unauthenticated traffic must never poison the sequence stream.
    const replayResult = this.replayModule.evaluate(envelope, undefined, {
      recordState: integrityResult.passed && authResult.passed
    });

    // 5. Behavioral Analysis: Evaluate sequence history and anomaly patterns
    const behavioralResult = this.behavioralModule.evaluate(effectiveEnvelope, currentSpacecraftState);

    // 6. Mission Context Resolution: Evaluate against orbital phase and mission flight rules
    const contextResult = this.contextModule.evaluate(effectiveEnvelope, currentSpacecraftState);

    // 7. Contextual Risk Engine: Multi-factor 0-100 scoring
    const riskResult = this.riskEngine.evaluate(
      envelope,
      currentSpacecraftState,
      integrityResult,
      authResult,
      replayResult,
      behavioralResult,
      contextResult
    );

    // 8. Deterministic Safety Policy: Final authority over execution and safe mode triggers
    const policyResult = this.policyEngine.evaluate(
      effectiveEnvelope,
      currentSpacecraftState,
      integrityResult,
      authResult,
      replayResult,
      behavioralResult,
      contextResult,
      riskResult
    );

    // 9. Response Engine: Enforce verdict
    let executed = false;
    let executionMessage = '';

    if (policyResult.safe_mode_activated && currentSpacecraftState.operating_mode !== 'SAFE_MODE') {
      this.spacecraft.enterSafeMode(policyResult.safe_mode_reason || 'Autonomous Security Safe Mode Triggered');
    }

    if (policyResult.decision === 'ALLOW' || policyResult.decision === 'MONITOR') {
      const exec = this.spacecraft.executeCommand(effectiveEnvelope);
      executed = exec.success;
      executionMessage = exec.message;
    } else {
      executed = false;
      executionMessage = `Execution prevented: Gateway verdict ${policyResult.decision} (${policyResult.explanation})`;
    }

    // Record behavioral history (using the effective — decrypted — command view)
    this.behavioralModule.recordCommand(effectiveEnvelope, policyResult.decision);

    // 10. Complete Audit Event Creation
    const auditEvent: AuditEvent = {
      event_id: eventId,
      timestamp,
      command_id: envelope.header.command_id,
      spacecraft_id: envelope.header.spacecraft_id,
      sender_identity: authResult.authorized_identity || envelope.security.key_id || 'UNKNOWN',
      envelope,
      integrity: integrityResult,
      authentication: authResult,
      replay: replayResult,
      behavioral: behavioralResult,
      mission_context: contextResult,
      risk: riskResult,
      policy: policyResult,
      final_decision: policyResult.decision,
      simulated_attack_type: options?.attackType
    };

    this.auditLog.unshift(auditEvent);
    if (this.auditLog.length > 200) {
      this.auditLog.pop();
    }

    return {
      audit_event: auditEvent,
      executed,
      execution_message: executionMessage,
      spacecraft_state: this.spacecraft.getState(),
      telemetry: this.spacecraft.getEssentialTelemetry()
    };
  }
}
