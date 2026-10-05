/**
 * SERVER-SIDE / TEST-ONLY attack scenario generator (controlled local
 * simulation metadata — not offensive tooling).
 *
 * Hostile envelopes are manufactured here so the browser never needs
 * credential material. The operator dashboard only sends scenario *intents*
 * to the backend (`POST /api/attacks`); scenario metadata for the UI lives in
 * src/models/attacks.ts. Also used by the vitest suites (Node runtime).
 */
import { CommandEnvelope } from '../models/command';
import { GroundStationClient } from '../ground_station/client';
import { canonicalJsonStringify, computeHmacSha256 } from '../gateway/crypto_utils';

export class AttackSimulator {
  private gsClient: GroundStationClient;

  constructor(gsClient?: GroundStationClient) {
    this.gsClient = gsClient || new GroundStationClient();
  }

  /**
   * Scenario 1: Command Tampering
   * Intercepts a legitimate command and tampers with payload parameters
   */
  public async generateTamperedCommand(): Promise<{ envelope: CommandEnvelope; description: string }> {
    // 1. Generate valid command
    const valid = await this.gsClient.createCommandEnvelope('QUERY_TELEMETRY', { subsystems: ['power', 'thermal'] });

    // 2. Tamper payload maliciously while keeping original signature
    const tamperedPayload = {
      command_type: 'FIRE_THRUSTER' as any,
      parameters: { delta_v: 8.5, burn_duration_ms: 25000, unauthorized_injection: true }
    };

    const tamperedEnvelope: CommandEnvelope = {
      ...valid,
      payload: tamperedPayload
      // Original signature kept untouched -> signature mismatch guaranteed
    };

    return {
      envelope: tamperedEnvelope,
      description: 'Intercepted legitimate command CMD-1042 and tampered payload from QUERY_TELEMETRY to dangerous FIRE_THRUSTER (8.5 m/s) without re-signing.'
    };
  }

  /**
   * Scenario 2: Unauthorized Key Injection
   * Forges a command with an unauthorized key_id
   */
  public async generateUnauthorizedInjection(): Promise<{ envelope: CommandEnvelope; description: string }> {
    const seq = this.gsClient.getNextSequenceNumber();
    const nonce = this.gsClient.generateNonce();
    const header = {
      spacecraft_id: 'SAT-01',
      command_id: `CMD-INJECT-${seq}`,
      timestamp: new Date().toISOString(),
      sequence_number: seq,
      nonce
    };

    const payload = {
      command_type: 'SYSTEM_REBOOT' as const,
      parameters: { delay_sec: 0, force: true }
    };

    const signable = canonicalJsonStringify({ header, payload });
    // Signed with unknown rogue key
    const rogueSignature = await computeHmacSha256('rogue-attacker-secret-key-666', signable);

    const envelope: CommandEnvelope = {
      header,
      payload,
      security: {
        key_id: 'ATTACKER-ROGUE-GS',
        algorithm: 'HMAC-SHA256',
        signature: rogueSignature
      }
    };

    return {
      envelope,
      description: 'Adversary generated rogue command with unauthorized key_id "ATTACKER-ROGUE-GS" and an unrecognized HMAC authentication tag.'
    };
  }

  /**
   * Scenario 3: Replay Attack
   * Replays an already captured legitimate envelope
   */
  public async generateReplayCommand(capturedEnvelope?: CommandEnvelope): Promise<{ envelope: CommandEnvelope; description: string }> {
    let envelopeToReplay: CommandEnvelope;

    if (capturedEnvelope) {
      envelopeToReplay = JSON.parse(JSON.stringify(capturedEnvelope));
    } else {
      // Create a command with a sequence that has already passed or old timestamp
      const valid = await this.gsClient.createCommandEnvelope('ROTATE_REACTION_WHEEL', { axis: 1, rpm: 2200 });
      envelopeToReplay = valid;
    }

    return {
      envelope: envelopeToReplay,
      description: `Replaying exact previously captured command ${envelopeToReplay.header.command_id} with reused nonce "${envelopeToReplay.header.nonce}" and duplicate sequence ${envelopeToReplay.header.sequence_number}.`
    };
  }

  /**
   * Scenario 4: Credential Compromise & Mission Rule Conflict
   * Uses legitimate GS-PRIMARY-01 credentials to pass crypto, but issues an anomalous command that violates mission constraints (e.g. imaging during eclipse)
   */
  public async generateCredentialCompromiseCommand(): Promise<{ envelope: CommandEnvelope; description: string }> {
    // Signs legitimately with authentic key GS-PRIMARY-01
    const envelope = await this.gsClient.createCommandEnvelope(
      'CAPTURE_IMAGE',
      {
        target: 'High-Res Optical Earth Pass',
        resolution: '4096x3072 Multispectral',
        exposure_ms: 850
      }
    );

    return {
      envelope,
      description: 'Attacker obtained valid Ground Station credentials (GS-PRIMARY-01). HMAC-based validation passes, but payload violates Rule OPT-02 (high-draw optical payload in eclipse with 0W solar generation).'
    };
  }

  /**
   * Scenario 4B: Destructive Orbit Alteration with Compromised Credentials
   */
  public async generateDestructiveThrusterWithValidCreds(): Promise<{ envelope: CommandEnvelope; description: string }> {
    const envelope = await this.gsClient.createCommandEnvelope(
      'FIRE_THRUSTER',
      {
        delta_v: 6.2, // Exceeds 2.0 m/s limit
        burn_duration_ms: 18000
      }
    );

    return {
      envelope,
      description: 'Attacker with stolen credentials commands an unauthorized 6.2 m/s orbit burn during eclipse, triggering behavioral anomaly and critical safety escalation.'
    };
  }
}
