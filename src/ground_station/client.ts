/**
 * SERVER-SIDE / TEST-ONLY command originator.
 *
 * This class holds simulated ground-station credential material and composes +
 * HMAC-signs + AES-GCM-encrypts command envelopes. It must NEVER be imported
 * by browser code (anything reachable from src/App.tsx): the authoritative
 * credential registry lives only in the backend process. The browser dashboard
 * is an operator console that sends command *intents* to the backend API.
 *
 * Also used by the vitest suites (src/tests, backend/src/tests), which run in Node.
 */
import { CommandEnvelope, CommandPayload, CommandType } from '../models/command';
import { AUTHORIZED_GROUND_STATIONS, GroundStationCredential } from '../gateway/authentication';
import { IntegrityModule } from '../gateway/integrity';
import { encryptPayloadAesGcm, canonicalJsonStringify } from '../gateway/crypto_utils';

export class GroundStationClient {
  private credential: GroundStationCredential;
  private currentSequence: number;
  private spacecraftId: string;

  constructor(
    keyId = 'GS-PRIMARY-01',
    initialSequence = 1001,
    spacecraftId = 'SAT-01'
  ) {
    this.credential = AUTHORIZED_GROUND_STATIONS[keyId] || AUTHORIZED_GROUND_STATIONS['GS-PRIMARY-01'];
    this.currentSequence = initialSequence;
    this.spacecraftId = spacecraftId;
  }

  public getCredential(): GroundStationCredential {
    return this.credential;
  }

  public setCredential(keyId: string): void {
    if (AUTHORIZED_GROUND_STATIONS[keyId]) {
      this.credential = AUTHORIZED_GROUND_STATIONS[keyId];
    }
  }

  public getNextSequenceNumber(): number {
    return ++this.currentSequence;
  }

  /**
   * Syncs the local sequence counter with the gateway's persisted monotonic
   * sequence state (per spacecraft + key sender scope). Only ever moves the
   * counter forward to preserve monotonicity.
   */
  public setSequenceCounter(lastUsedSequence: number): void {
    if (Number.isFinite(lastUsedSequence) && lastUsedSequence > this.currentSequence) {
      this.currentSequence = lastUsedSequence;
    }
  }

  public generateNonce(): string {
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Composes, signs, and formats a legitimate command envelope.
   *
   * When `encryptPayload` is set, the plaintext parameters are ONLY present as
   * an AES-GCM ciphertext (`security.ciphertext`, bound into the HMAC tag).
   * The wire payload carries a redacted marker instead of plaintext so that
   * ciphertext — not display plaintext — is the authoritative representation.
   * The backend decrypts and validates authenticated encryption server-side.
   */
  public async createCommandEnvelope(
    commandType: CommandType,
    parameters: Record<string, any> = {},
    options?: {
      overrideSequence?: number;
      overrideNonce?: string;
      overrideTimestamp?: string;
      encryptPayload?: boolean;
    }
  ): Promise<CommandEnvelope> {
    const seq = options?.overrideSequence ?? this.getNextSequenceNumber();
    const nonce = options?.overrideNonce ?? this.generateNonce();
    const timestamp = options?.overrideTimestamp ?? new Date().toISOString();
    const commandId = `CMD-${seq}`;

    const header = {
      spacecraft_id: this.spacecraftId,
      command_id: commandId,
      timestamp,
      sequence_number: seq,
      nonce
    };

    let ciphertext: string | undefined;
    let ivHex: string | undefined;
    let payload: CommandPayload;

    if (options?.encryptPayload) {
      const encrypted = await encryptPayloadAesGcm(
        this.credential.encryption_key,
        canonicalJsonStringify(parameters)
      );
      ciphertext = encrypted.ciphertext;
      ivHex = encrypted.iv;
      // Ciphertext is authoritative; the wire payload only carries a marker.
      payload = {
        command_type: commandType,
        parameters: { encrypted: true }
      };
    } else {
      payload = {
        command_type: commandType,
        parameters
      };
    }

    // HMAC tag covers canonical header + payload, and the encrypted transport
    // (ciphertext + iv) when present, so ciphertext substitution is detectable.
    const signature = await IntegrityModule.signEnvelope(
      header,
      payload,
      this.credential.secret_key,
      ciphertext ? { ciphertext, iv: ivHex } : undefined
    );

    return {
      header,
      payload,
      security: {
        key_id: this.credential.key_id,
        algorithm: 'HMAC-SHA256',
        signature,
        ciphertext,
        iv: ivHex
      }
    };
  }
}
