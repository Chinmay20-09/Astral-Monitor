import { CommandEnvelope } from '../models/command';
import { IntegrityCheckResult } from '../models/audit';
import { canonicalJsonStringify, computeHmacSha256, verifySignatureString, decryptPayloadAesGcm } from './crypto_utils';

/**
 * Wire transport representation bound into the HMAC integrity tag when the
 * command payload is AES-GCM encrypted. Binding the ciphertext into the
 * signed material prevents ciphertext substitution attacks.
 */
export interface EnvelopeTransport {
  ciphertext?: string;
  iv?: string;
}

export interface IntegrityVerifyOptions {
  /**
   * Server-side AES transport key from the authenticated credential registry.
   * Required to decrypt `security.ciphertext` before plaintext parameters may
   * enter the behavioral / mission / policy path.
   */
  encryptionKey?: string;
}

export class IntegrityModule {
  /**
   * Builds the signed canonical representation from header and payload
   * (plus the transport ciphertext/iv when the payload is encrypted).
   */
  public static getSignableString(
    header: CommandEnvelope['header'],
    payload: CommandEnvelope['payload'],
    transport?: EnvelopeTransport
  ): string {
    const signable: Record<string, unknown> = { header, payload };
    if (transport?.ciphertext) {
      signable.transport = {
        ciphertext: transport.ciphertext,
        ...(transport.iv ? { iv: transport.iv } : {})
      };
    }
    return canonicalJsonStringify(signable);
  }

  /**
   * Computes the HMAC-SHA256 authentication tag over the canonical
   * header + payload (+ encrypted transport when present).
   */
  public static async signEnvelope(
    header: CommandEnvelope['header'],
    payload: CommandEnvelope['payload'],
    secretKey: string,
    transport?: EnvelopeTransport
  ): Promise<string> {
    const signable = IntegrityModule.getSignableString(header, payload, transport);
    return computeHmacSha256(secretKey, signable);
  }

  /**
   * Verifies HMAC-based integrity of a command envelope, and — when the
   * envelope carries an AES-GCM ciphertext — validates authenticated
   * encryption server-side using the credential's transport key. Only after
   * the authenticated decryption succeeds do plaintext parameters enter the
   * security/policy path.
   */
  public async verifyIntegrity(
    envelope: CommandEnvelope,
    secretKey: string,
    options?: IntegrityVerifyOptions
  ): Promise<IntegrityCheckResult> {
    const algorithm = envelope.security.algorithm || 'HMAC-SHA256';
    const receivedTag = envelope.security.signature;
    const ciphertext = envelope.security.ciphertext;
    const transport: EnvelopeTransport | undefined = ciphertext
      ? { ciphertext, iv: envelope.security.iv }
      : undefined;

    if (!receivedTag) {
      return {
        passed: false,
        computed_signature: '',
        received_signature: '',
        algorithm,
        error: 'Missing HMAC authentication tag in security field'
      };
    }

    try {
      const signable = IntegrityModule.getSignableString(envelope.header, envelope.payload, transport);
      const computedTag = await computeHmacSha256(secretKey, signable);

      const isValid = verifySignatureString(computedTag, receivedTag);

      if (!isValid) {
        return {
          passed: false,
          computed_signature: computedTag,
          received_signature: receivedTag,
          algorithm,
          error: 'HMAC integrity mismatch: payload, header or encrypted transport has been tampered with or corrupted in transit'
        };
      }

      // HMAC tag valid — now validate authenticated encryption if present.
      if (ciphertext) {
        const decryption = await this.decryptTransport(ciphertext, envelope.security.iv, options?.encryptionKey);
        if (!decryption.passed) {
          return {
            passed: false,
            computed_signature: computedTag,
            received_signature: receivedTag,
            algorithm,
            decryption,
            error: decryption.error || 'Authenticated decryption of encrypted payload failed'
          };
        }
        return {
          passed: true,
          computed_signature: computedTag,
          received_signature: receivedTag,
          algorithm,
          decryption
        };
      }

      return {
        passed: true,
        computed_signature: computedTag,
        received_signature: receivedTag,
        algorithm
      };
    } catch (err: any) {
      return {
        passed: false,
        computed_signature: '',
        received_signature: receivedTag,
        algorithm,
        error: `Integrity evaluation exception: ${err.message || String(err)}`
      };
    }
  }

  /**
   * Server-side AES-GCM authenticated decryption of the encrypted transport.
   * A GCM tag failure (wrong key, tampered or corrupted ciphertext) must fail
   * the integrity check — encrypted commands are never trusted on plaintext
   * attached for display.
   */
  private async decryptTransport(
    ciphertextHex: string,
    ivHex: string | undefined,
    encryptionKey: string | undefined
  ): Promise<NonNullable<IntegrityCheckResult['decryption']>> {
    if (!encryptionKey) {
      return {
        performed: true,
        passed: false,
        algorithm: 'AES-GCM-256',
        error: 'Encrypted payload rejected: no server-side decryption credential available for this sender'
      };
    }
    if (!ivHex) {
      return {
        performed: true,
        passed: false,
        algorithm: 'AES-GCM-256',
        error: 'Encrypted payload rejected: missing AES-GCM initialization vector'
      };
    }
    try {
      const plaintext = await decryptPayloadAesGcm(encryptionKey, ciphertextHex, ivHex);
      const parameters = JSON.parse(plaintext) as Record<string, unknown>;
      return {
        performed: true,
        passed: true,
        algorithm: 'AES-GCM-256',
        parameters
      };
    } catch (err: any) {
      return {
        performed: true,
        passed: false,
        algorithm: 'AES-GCM-256',
        error: `AES-GCM authenticated decryption failed (tag mismatch, wrong transport key, or corrupted ciphertext): ${err.message || String(err)}`
      };
    }
  }
}
