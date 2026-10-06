/**
 * Attacker client for Port 3500 (UNTRUSTED zone).
 *
 * This module generates hostile command envelopes client-side in the attacker
 * browser bundle. Unlike the server-side AttackSimulator, this runs in the
 * browser and sends envelopes directly to the backend's /api/commands endpoint.
 *
 * The backend security middleware will:
 * - Detect the untrusted origin (localhost:3500)
 * - Block the request with 403
 * - Generate security events
 *
 * This is the attacker's INDEPENDENT attack capability — no trusted backend
 * assistance required.
 */

import { CommandEnvelope, CommandType } from '../models/command';
import { canonicalJsonStringify, computeHmacSha256 } from '../gateway/crypto_utils';

// Rogue credentials (attacker's own identity)
const ATTACKER_KEY_ID = 'ATTACKER-ROGUE-GS';
const ATTACKER_SECRET = 'rogue-attacker-secret-key-666';

let sequenceCounter = 1001;

function getNextSequence(): number {
  return ++sequenceCounter;
}

function generateNonce(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface AttackEnvelopeResult {
  envelope: CommandEnvelope;
  description: string;
}

export class AttackerClient {
  /**
   * Generate a tampered command envelope.
   * Takes a legitimate-looking command and modifies the payload maliciously
   * while keeping the original signature (which will mismatch).
   */
  public async generateTamperedCommand(): Promise<AttackEnvelopeResult> {
    // Create a valid command first
    const validEnvelope = await this.createLegitimateEnvelope('QUERY_TELEMETRY', {
      subsystems: ['power', 'thermal']
    });

    // Tamper the payload - change to dangerous FIRE_THRUSTER
    const tamperedEnvelope: CommandEnvelope = {
      ...validEnvelope,
      payload: {
        command_type: 'FIRE_THRUSTER' as CommandType,
        parameters: {
          delta_v: 8.5,
          burn_duration_ms: 25000,
          unauthorized_injection: true
        }
      }
      // Original signature kept - will fail integrity check
    };

    return {
      envelope: tamperedEnvelope,
      description: `TAMPERING: Intercepted QUERY_TELEMETRY command and modified payload to FIRE_THRUSTER (8.5 m/s delta-V) without re-signing. Original HMAC signature now invalid.`
    };
  }

  /**
   * Generate an unauthorized injection command.
   * Uses a rogue key_id that is not in the authorized registry.
   */
  public async generateUnauthorizedInjection(): Promise<AttackEnvelopeResult> {
    const seq = getNextSequence();
    const nonce = generateNonce();

    const header = {
      spacecraft_id: 'SAT-01',
      command_id: `CMD-INJECT-${seq}`,
      timestamp: new Date().toISOString(),
      sequence_number: seq,
      nonce
    };

    const payload = {
      command_type: 'SYSTEM_REBOOT' as CommandType,
      parameters: { delay_sec: 0, force: true }
    };

    const signable = canonicalJsonStringify({ header, payload });
    const rogueSignature = await computeHmacSha256(ATTACKER_SECRET, signable);

    const envelope: CommandEnvelope = {
      header,
      payload,
      security: {
        key_id: ATTACKER_KEY_ID,
        algorithm: 'HMAC-SHA256',
        signature: rogueSignature
      }
    };

    return {
      envelope,
      description: `INJECTION: Forged SYSTEM_REBOOT command with unauthorized key_id "${ATTACKER_KEY_ID}". Signature generated with rogue secret key — not in authorized ground station registry.`
    };
  }

  /**
   * Generate a replay command.
   * Creates a command with a sequence that will be detected as replay.
   * For proper replay demo, first send a valid command, then replay it.
   */
  public async generateReplayCommand(): Promise<AttackEnvelopeResult> {
    // Create a command, then replay it with same nonce/sequence
    const seq = getNextSequence();
    const nonce = generateNonce();

    const header = {
      spacecraft_id: 'SAT-01',
      command_id: `CMD-REPLAY-${seq}`,
      timestamp: new Date().toISOString(),
      sequence_number: seq,
      nonce
    };

    const payload = {
      command_type: 'ROTATE_REACTION_WHEEL' as CommandType,
      parameters: { axis: 1, rpm: 2200 }
    };

    const signable = canonicalJsonStringify({ header, payload });
    const signature = await computeHmacSha256(ATTACKER_SECRET, signable);

    const envelope: CommandEnvelope = {
      header,
      payload,
      security: {
        key_id: ATTACKER_KEY_ID,
        algorithm: 'HMAC-SHA256',
        signature
      }
    };

    // For replay detection, we'll send this twice in the demo
    // The first send will be blocked (auth failure), but if we want
    // to demonstrate replay of a previously accepted command, we need
    // to first get a command accepted, then replay it.
    // This is a simplified version that demonstrates the concept.

    return {
      envelope,
      description: `REPLAY: Generated ROTATE_REACTION_WHEEL command with sequence ${seq} and nonce ${nonce}. In a full replay attack, this envelope would be captured and retransmitted. The backend detects duplicate nonces and sequence violations.`
    };
  }

  /**
   * Generate a credential compromise command.
   * Uses legitimate GS-PRIMARY-01 credentials (simulating stolen creds)
   * to issue a command that violates mission constraints.
   */
  public async generateCredentialCompromiseCommand(): Promise<AttackEnvelopeResult> {
    // Use the legitimate ground station client logic
    // but we're in the browser, so we need to simulate it
    const gsSecret = 'orbitshield-svalbard-primary-sign-key-demo-2026';
    const gsKeyId = 'GS-PRIMARY-01';

    const seq = getNextSequence();
    const nonce = generateNonce();

    const header = {
      spacecraft_id: 'SAT-01',
      command_id: `CMD-COMP-${seq}`,
      timestamp: new Date().toISOString(),
      sequence_number: seq,
      nonce
    };

    const payload = {
      command_type: 'CAPTURE_IMAGE' as CommandType,
      parameters: {
        target: 'High-Res Optical Earth Pass',
        resolution: '4096x3072 Multispectral',
        exposure_ms: 850
      }
    };

    const signable = canonicalJsonStringify({ header, payload });
    const signature = await computeHmacSha256(gsSecret, signable);

    // Note: This uses the legitimate GS-PRIMARY-01 secret key
    // to simulate stolen credentials. The signature is VALID.
    // The command will pass authentication but may fail
    // mission context (imaging during eclipse) or other checks.

    const envelope: CommandEnvelope = {
      header,
      payload,
      security: {
        key_id: gsKeyId,
        algorithm: 'HMAC-SHA256',
        signature
      }
    };

    return {
      envelope,
      description: `CREDENTIAL_COMPROMISE: Attacker using stolen GS-PRIMARY-01 credentials to issue CAPTURE_IMAGE command during UMBRA_ECLIPSE. HMAC validation passes (valid creds), but mission rule OPT-02 blocks imaging during eclipse (0W solar, 180W payload draw).`
    };
  }

  /**
   * Generate a destructive thruster burn command.
   * Uses stolen credentials to command a dangerous orbit alteration.
   */
  public async generateDestructiveBurn(): Promise<AttackEnvelopeResult> {
    const gsSecret = 'orbitshield-svalbard-primary-sign-key-demo-2026';
    const gsKeyId = 'GS-PRIMARY-01';

    const seq = getNextSequence();
    const nonce = generateNonce();

    const header = {
      spacecraft_id: 'SAT-01',
      command_id: `CMD-BURN-${seq}`,
      timestamp: new Date().toISOString(),
      sequence_number: seq,
      nonce
    };

    const payload = {
      command_type: 'FIRE_THRUSTER' as CommandType,
      parameters: {
        delta_v: 6.2, // Exceeds 2.0 m/s limit
        burn_duration_ms: 18000
      }
    };

    const signable = canonicalJsonStringify({ header, payload });
    const signature = await computeHmacSha256(gsSecret, signable);

    // Note: This uses the legitimate GS-PRIMARY-01 secret key
    // to simulate stolen credentials. The signature is VALID.
    // The command will pass authentication but should trigger
    // SAFE_MODE due to CRITICAL risk (delta_v > 2.0 m/s limit + eclipse).

    const envelope: CommandEnvelope = {
      header,
      payload,
      security: {
        key_id: gsKeyId,
        algorithm: 'HMAC-SHA256',
        signature
      }
    };

    return {
      envelope,
      description: `DESTRUCTIVE_BURN: Attacker with compromised GS-PRIMARY-01 credentials commands 6.2 m/s delta-V thruster burn during eclipse. Exceeds 2.0 m/s safety limit and violates mission phase restrictions.`
    };
  }

  /**
   * Create a legitimate envelope for testing/capture purposes.
   * Uses rogue credentials (will be blocked by auth).
   */
  private async createLegitimateEnvelope(
    commandType: CommandType,
    parameters: Record<string, unknown>
  ): Promise<CommandEnvelope> {
    const seq = getNextSequence();
    const nonce = generateNonce();

    const header = {
      spacecraft_id: 'SAT-01',
      command_id: `CMD-${seq}`,
      timestamp: new Date().toISOString(),
      sequence_number: seq,
      nonce
    };

    const payload = {
      command_type: commandType,
      parameters
    };

    const signable = canonicalJsonStringify({ header, payload });
    const signature = await computeHmacSha256(ATTACKER_SECRET, signable);

    return {
      header,
      payload,
      security: {
        key_id: ATTACKER_KEY_ID,
        algorithm: 'HMAC-SHA256',
        signature
      }
    };
  }

  /**
   * Send an attack envelope directly to the backend.
   * The attacker submits hostile commands to the security gateway.
   * 
   * IMPORTANT: The attacker sends from an UNTRUSTED origin (port 3500).
   * The security middleware allows /api/commands from attackers FOR DEMO PURPOSES
   * so the gateway can process the envelope and demonstrate detection/blocking.
   * 
   * The gateway processes envelopes through the full pipeline:
   * - Authentication (verify key_id against registry)
   * - Integrity (verify HMAC signature)
   * - Replay (check nonce + sequence + timestamp)
   * - Behavioral analysis
   * - Mission context
   * - Risk engine
   * - Safety policy (may trigger SAFE_MODE)
   *
   * A REAL gateway block = the envelope reached the gateway and was rejected by
   * auth/integrity/replay/policy checks. The response contains a full audit_event.
   * A PERIMETER block = the security middleware rejected the request at the edge (403).
   */
  public async sendAttack(envelope: CommandEnvelope): Promise<{
    success: boolean;
    status: number;
    blocked: boolean;
    perimeterBlocked: boolean;
    gatewayProcessed: boolean;
    error?: string;
    result?: unknown;
    eventId?: string;
  }> {
    try {
      const response = await fetch('/api/commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Send attacker origin so security middleware can log it properly
          'Origin': 'http://localhost:3500'
        },
        body: JSON.stringify({ envelope })
      });

      const result = await response.json().catch(() => ({ error: 'Failed to parse response' }));

      // Determine what happened:
      // - response.ok (2xx) + audit_event = gateway processed and decided (ALLOW/MONITOR/BLOCK/SAFE_MODE)
      // - response.ok (2xx) without audit_event = gateway processed but something unexpected
      // - !response.ok (4xx/5xx) = could be perimeter block or gateway error
      const hasAuditEvent = result && typeof result === 'object' && 'audit_event' in result;
      const isHttpOk = response.ok;
      
      // Gateway-processed scenarios:
      // 1. ALLOW/MONITOR: command accepted (rare for attacker with rogue creds)
      // 2. BLOCK: gateway rejected (auth fail, integrity fail, replay, etc.) — REAL block
      // 3. SAFE_MODE: gateway triggered safe mode — also a real gateway decision
      const gatewayProcessed = isHttpOk && hasAuditEvent;
      
      // Perimeter block: untrusted origin blocked by security middleware (403 with security.blocked)
      const perimeterBlocked = !isHttpOk && 
        (result && typeof result === 'object' && 'security' in result && (result as any).security?.blocked);

      return {
        success: gatewayProcessed || perimeterBlocked,  // We got a definitive answer either way
        status: response.status,
        blocked: perimeterBlocked || (!isHttpOk && !gatewayProcessed),
        perimeterBlocked,
        gatewayProcessed,
        error: result?.error,
        result: gatewayProcessed ? result : undefined,
        eventId: hasAuditEvent ? (result as any).audit_event?.event_id : (result as any)?.security?.event_id
      };
    } catch (err) {
      return {
        success: false,
        status: 0,
        blocked: false,
        perimeterBlocked: false,
        gatewayProcessed: false,
        error: err instanceof Error ? err.message : 'Network error'
      };
    }
  }
}

// Singleton instance
export const attackerClient = new AttackerClient();
