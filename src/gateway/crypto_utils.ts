/**
 * Cryptographic Utilities for OrbitShield
 * Uses standard Web Crypto API (SubtleCrypto)
 * Adheres strictly to AGENT_RULES.md: No custom cryptographic primitives.
 */

// Canonical JSON stringify to guarantee reproducible hashing & signing
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes an HMAC-SHA256 authentication tag over data using a secret key string.
 * (Symmetric MAC — NOT an asymmetric digital signature.)
 */
export async function computeHmacSha256(secretKey: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time comparison of HMAC authentication tags to avoid timing attacks
 */
export function verifySignatureString(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * AES-GCM Encrypt a plaintext string using an encryption key
 */
export async function encryptPayloadAesGcm(keyString: string, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  // Derive 256-bit key buffer by hashing keyString
  const keyBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(keyString));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(plaintext)
  );

  const ciphertext = Array.from(new Uint8Array(encryptedBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const ivHex = Array.from(iv)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return { ciphertext, iv: ivHex };
}

/**
 * AES-GCM Decrypt a hex ciphertext string
 */
export async function decryptPayloadAesGcm(keyString: string, ciphertextHex: string, ivHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(keyString));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const ivBytes = new Uint8Array(ivHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
  const cipherBytes = new Uint8Array(ciphertextHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    cryptoKey,
    cipherBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
