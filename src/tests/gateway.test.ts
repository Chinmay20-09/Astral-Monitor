import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityGateway } from '../gateway/gateway';
import { GroundStationClient } from '../ground_station/client';
import { AttackSimulator } from '../attacker/simulator';
import { SpacecraftSimulator } from '../spacecraft/simulator';
import { CommandEnvelope } from '../models/command';

describe('OrbitShield Security Gateway — TRD Section 14 Verification Suite', () => {
  let gateway: SecurityGateway;
  let groundStation: GroundStationClient;
  let attacker: AttackSimulator;
  let spacecraft: SpacecraftSimulator;

  beforeEach(() => {
    spacecraft = new SpacecraftSimulator();
    gateway = new SecurityGateway(spacecraft);
    groundStation = new GroundStationClient('GS-PRIMARY-01', 1000);
    attacker = new AttackSimulator(groundStation);
  });

  // 1. Valid command passes
  it('TRD-14.1: Valid command with genuine signature passes all checks and executes', async () => {
    // Set mission to full sun imaging to avoid eclipse constraints for camera
    gateway.contextModule.setMissionPhase('FULL_SUN_IMAGING');
    const cmd = await groundStation.createCommandEnvelope('QUERY_TELEMETRY', {
      subsystems: ['power', 'thermal', 'navigation']
    });

    const result = await gateway.processCommand(cmd);

    expect(result.audit_event.integrity.passed).toBe(true);
    expect(result.audit_event.authentication.passed).toBe(true);
    expect(result.audit_event.replay.passed).toBe(true);
    expect(result.audit_event.final_decision).toBe('ALLOW');
    expect(result.executed).toBe(true);
    expect(result.spacecraft_state.last_executed_command_id).toBe(cmd.header.command_id);
  });

  // 2. Modified payload fails integrity
  it('TRD-14.2: Modified payload fails integrity check and is blocked', async () => {
    const { envelope } = await attacker.generateTamperedCommand();
    const result = await gateway.processCommand(envelope, { attackType: 'TAMPERING' });

    expect(result.audit_event.integrity.passed).toBe(false);
    expect(result.audit_event.final_decision).toBe('BLOCK');
    expect(result.executed).toBe(false);
    expect(result.audit_event.policy.rule_triggered).toBe('HARD_CONSTRAINT_INTEGRITY_FAIL');
  });

  // 3. Unknown credential fails authentication
  it('TRD-14.3: Unknown or rogue credential fails authentication and is blocked', async () => {
    const { envelope } = await attacker.generateUnauthorizedInjection();
    const result = await gateway.processCommand(envelope, { attackType: 'INJECTION' });

    expect(result.audit_event.authentication.passed).toBe(false);
    expect(result.audit_event.final_decision).toBe('BLOCK');
    expect(result.executed).toBe(false);
    expect(result.audit_event.policy.rule_triggered).toBe('HARD_CONSTRAINT_AUTHENTICATION_FAIL');
  });

  // 4. Replayed nonce / sequence fails
  it('TRD-14.4: Replayed nonce and sequence fails replay check and is blocked', async () => {
    const validCmd = await groundStation.createCommandEnvelope('ROTATE_REACTION_WHEEL', { axis: 0, rpm: 1200 });

    // First execution: should succeed
    const firstResult = await gateway.processCommand(validCmd);
    expect(firstResult.audit_event.final_decision).toBe('ALLOW');

    // Second execution of the exact same envelope: must be rejected as replay
    const replayResult = await gateway.processCommand(validCmd, { attackType: 'REPLAY' });
    expect(replayResult.audit_event.replay.passed).toBe(false);
    expect(replayResult.audit_event.replay.nonce_is_fresh).toBe(false);
    expect(replayResult.audit_event.final_decision).toBe('BLOCK');
    expect(replayResult.executed).toBe(false);
    expect(replayResult.audit_event.policy.rule_triggered).toBe('HARD_CONSTRAINT_REPLAY_DETECTED');
  });

  // 5. Malformed command rejected
  it('TRD-14.5: Malformed command is gracefully rejected at parser boundary without crash', async () => {
    const malformed = {
      header: null,
      payload: { bad: true }
    } as any as CommandEnvelope;

    const result = await gateway.processCommand(malformed);
    expect(result.audit_event.final_decision).toBe('BLOCK');
    expect(result.executed).toBe(false);
    expect(result.audit_event.policy.rule_triggered).toBe('SCHEMA_PARSE_FAILURE');
  });

  // 6. High-risk dangerous command blocked
  it('TRD-14.6: High-risk dangerous command violating mission safety constraints is blocked', async () => {
    // Spacecraft is in Eclipse phase
    gateway.contextModule.setMissionPhase('UMBRA_ECLIPSE');
    // Dangerous high-delta thruster burn
    const dangerousCmd = await groundStation.createCommandEnvelope('FIRE_THRUSTER', {
      delta_v: 4.5, // Exceeds 2.0 m/s limit
      burn_duration_ms: 12000
    });

    const result = await gateway.processCommand(dangerousCmd);
    expect(result.audit_event.integrity.passed).toBe(true); // Signed legitimately
    expect(result.audit_event.mission_context.is_compliant).toBe(false);
    expect(result.audit_event.risk.total_score).toBeGreaterThanOrEqual(50);
    expect(['BLOCK', 'SAFE_MODE']).toContain(result.audit_event.final_decision);
    expect(result.executed).toBe(false);
  });

  // 7. Critical scenario triggers safe mode
  it('TRD-14.7: Critical attack scenario triggers autonomous SAFE MODE transition', async () => {
    gateway.contextModule.setMissionPhase('UMBRA_ECLIPSE');
    const { envelope } = await attacker.generateDestructiveThrusterWithValidCreds();

    const result = await gateway.processCommand(envelope, { attackType: 'CREDENTIAL_COMPROMISE' });

    expect(result.audit_event.risk.total_score).toBeGreaterThanOrEqual(75);
    expect(result.audit_event.risk.severity).toBe('CRITICAL');
    expect(result.audit_event.final_decision).toBe('SAFE_MODE');
    expect(result.spacecraft_state.operating_mode).toBe('SAFE_MODE');
    expect(result.telemetry.safe_mode_active).toBe(true);
  });

  // 8. Telemetry remains available in safe mode
  it('TRD-14.8: Essential telemetry queries remain operational even when vehicle is in SAFE MODE', async () => {
    // Put vehicle in safe mode
    gateway.spacecraft.enterSafeMode('Adversarial intrusion detected');
    expect(gateway.spacecraft.getState().operating_mode).toBe('SAFE_MODE');

    // Query telemetry command
    const queryCmd = await groundStation.createCommandEnvelope('QUERY_TELEMETRY', {});
    const result = await gateway.processCommand(queryCmd);

    // Permitted because telemetry exception allows safe state monitoring
    expect(result.audit_event.final_decision).toBe('ALLOW');
    expect(result.telemetry).toBeDefined();
    expect(result.telemetry.safe_mode_active).toBe(true);
    expect(result.telemetry.battery_percent).toBeGreaterThan(0);

    // Meanwhile, non-telemetry commands like image capture remain locked
    const cameraCmd = await groundStation.createCommandEnvelope('CAPTURE_IMAGE', {});
    const cameraResult = await gateway.processCommand(cameraCmd);
    expect(cameraResult.audit_event.final_decision).toBe('BLOCK');
    expect(cameraResult.executed).toBe(false);
  });

  // 9. AI / Behavioral fallback works deterministically
  it('TRD-14.9: Deterministic policy engine overrides advisory behavioral layer and ensures safety', async () => {
    // A command with simulated tampered signature but mock low behavioral score still MUST be blocked
    const cmd = await groundStation.createCommandEnvelope('SET_POWER_MODE', { mode: 'LOW_POWER' });
    // Corrupt signature
    cmd.security.signature = 'corrupted-tampered-hex-value';

    const result = await gateway.processCommand(cmd);
    expect(result.audit_event.policy.enforced_by_deterministic_rule).toBe(true);
    expect(result.audit_event.final_decision).toBe('BLOCK');
  });

  // 10. Audit event contains complete decision evidence
  it('TRD-14.10: Complete explainable audit record contains all required forensic fields', async () => {
    const cmd = await groundStation.createCommandEnvelope('QUERY_TELEMETRY', {});
    const result = await gateway.processCommand(cmd);
    const audit = result.audit_event;

    expect(audit.event_id).toBeDefined();
    expect(audit.timestamp).toBeDefined();
    expect(audit.command_id).toBe(cmd.header.command_id);
    expect(audit.spacecraft_id).toBe('SAT-01');
    expect(audit.sender_identity).toBeDefined();
    expect(audit.integrity).toBeDefined();
    expect(audit.authentication).toBeDefined();
    expect(audit.replay).toBeDefined();
    expect(audit.behavioral).toBeDefined();
    expect(audit.mission_context).toBeDefined();
    expect(audit.risk).toBeDefined();
    expect(audit.policy).toBeDefined();
    expect(audit.final_decision).toBeDefined();
  });
});
