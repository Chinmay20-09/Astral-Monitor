import { CommandEnvelope } from '../models/command';
import { ReplayCheckResult } from '../models/audit';

/**
 * Anti-replay state scope: one independent sequence stream per
 * spacecraft_id + key_id pair (TRD: multiple ground stations must not
 * starve each other's sequence space), plus one globally-bounded nonce
 * cache (nonces are random per command, so global uniqueness is the
 * strictly stronger guarantee).
 */
export interface ReplayStateEntry {
  spacecraft_id: string;
  key_id: string;
  last_sequence: number;
}

const MAX_NONCE_CACHE = 5000;
const NONCE_EVICT_BATCH = 1000;

export class ReplayProtectionModule {
  /** Per (spacecraft_id + key_id) last accepted sequence number. */
  private sequences: Map<string, number> = new Map();
  /** Globally-bounded nonce cache (evicts oldest inserts when oversized). */
  private seenNonces: Set<string> = new Set();
  private maxClockSkewSeconds: number;
  private readonly initialSequence: number;

  constructor(options?: { maxClockSkewSeconds?: number; initialSequence?: number }) {
    this.seenNonces = new Set<string>();
    this.initialSequence = options?.initialSequence ?? 1000;
    this.maxClockSkewSeconds = options?.maxClockSkewSeconds ?? 60; // 60 seconds allowed window
  }

  private scopeKey(spacecraftId: string | undefined, keyId: string | undefined): string {
    return `${spacecraftId ?? 'UNKNOWN-SAT'}::${keyId ?? 'UNKNOWN-KEY'}`;
  }

  private getScopeSequence(scope: string): number {
    return this.sequences.get(scope) ?? this.initialSequence;
  }

  /**
   * Last accepted sequence number.
   * - With spacecraftId+keyId: that sender scope's counter.
   * - Without arguments: the maximum across all known scopes (used for
   *   global sequence sync endpoints).
   */
  public getLastSequenceNumber(spacecraftId?: string, keyId?: string): number {
    if (spacecraftId && keyId) {
      return this.getScopeSequence(this.scopeKey(spacecraftId, keyId));
    }
    if (this.sequences.size === 0) {
      return this.initialSequence;
    }
    return Math.max(...this.sequences.values());
  }

  /**
   * Legacy setter. With spacecraftId+keyId it sets that scope; without a
   * scope it raises every known scope to at least `seq` (used by older
   * rehydration paths).
   */
  public setLastSequenceNumber(seq: number, spacecraftId?: string, keyId?: string): void {
    if (spacecraftId && keyId) {
      this.sequences.set(this.scopeKey(spacecraftId, keyId), seq);
      return;
    }
    for (const [scope, current] of this.sequences) {
      if (seq > current) this.sequences.set(scope, seq);
    }
    if (this.sequences.size === 0) {
      this.sequences.set('SAT-01::DEFAULT', seq);
    }
  }

  public getSeenNonces(): string[] {
    return Array.from(this.seenNonces);
  }

  public getNonceCacheSize(): number {
    return this.seenNonces.size;
  }

  public reset(): void {
    this.seenNonces.clear();
    this.sequences.clear();
  }

  /**
   * Rehydrates the nonce cache from persistent storage (the backend database)
   * so replay protection survives gateway restarts. Does not alter sequence tracking.
   */
  public seedNonces(nonces: string[]): void {
    for (const nonce of nonces) {
      if (nonce) {
        this.seenNonces.add(nonce);
      }
    }
  }

  /**
   * Rehydrates per-(spacecraft, key) sequence counters from the persistent
   * replay_state table so per-sender anti-replay guarantees survive restarts.
   */
  public seedState(entries: ReplayStateEntry[]): void {
    for (const entry of entries) {
      if (!entry?.spacecraft_id || !entry?.key_id) continue;
      const scope = this.scopeKey(entry.spacecraft_id, entry.key_id);
      const current = this.getScopeSequence(scope);
      if (entry.last_sequence > current) {
        this.sequences.set(scope, entry.last_sequence);
      }
    }
  }

  /** Current per-scope state for persistence (called inside the audit transaction). */
  public exportState(): ReplayStateEntry[] {
    return Array.from(this.sequences.entries()).map(([scope, last]) => {
      const [spacecraft_id, key_id] = scope.split('::');
      return { spacecraft_id, key_id, last_sequence: last };
    });
  }

  /**
   * Evaluates freshness, nonce uniqueness, and per-sender monotonic sequence number.
   *
   * `options.recordState` must only be true when the envelope already passed
   * integrity + authentication: unauthenticated or tampered traffic must never
   * consume nonces or advance a sender's sequence stream (that would let an
   * attacker poison the anti-replay state as a denial-of-service). Evidence
   * fields are always computed; only state mutation is conditional.
   */
  public evaluate(
    envelope: CommandEnvelope,
    nowIso?: string,
    options?: { recordState?: boolean }
  ): ReplayCheckResult {
    const recordState = options?.recordState !== false;
    const { nonce, timestamp, sequence_number } = envelope.header;
    const now = nowIso ? new Date(nowIso).getTime() : Date.now();
    const cmdTime = new Date(timestamp).getTime();

    const scope = this.scopeKey(
      envelope.header.spacecraft_id,
      envelope.security?.key_id
    );
    const lastSequenceForScope = this.getScopeSequence(scope);

    // 1. Clock skew / Timestamp freshness check
    let timestampValid = true;
    let clockSkewSeconds = 0;
    if (isNaN(cmdTime)) {
      return {
        passed: false,
        nonce_is_fresh: false,
        sequence_valid: false,
        timestamp_valid: false,
        clock_skew_seconds: 9999,
        expected_sequence: lastSequenceForScope + 1,
        received_sequence: sequence_number,
        error: `Invalid ISO-8601 timestamp string: "${timestamp}"`
      };
    }

    clockSkewSeconds = Math.round(Math.abs(now - cmdTime) / 1000);
    if (clockSkewSeconds > this.maxClockSkewSeconds) {
      timestampValid = false;
    }

    // 2. Nonce freshness check (global cache)
    const nonceIsFresh = !this.seenNonces.has(nonce);

    // 3. Sequence number monotonicity check (per spacecraft + key sender scope)
    const sequenceValid = sequence_number > lastSequenceForScope;

    let errorReason: string | undefined;

    if (!nonceIsFresh) {
      errorReason = `Replay detected: nonce "${nonce}" has already been processed in session cache`;
    } else if (!sequenceValid) {
      errorReason = `Sequence violation: received sequence ${sequence_number} <= last executed sequence ${lastSequenceForScope} for sender scope ${scope}`;
    } else if (!timestampValid) {
      errorReason = `Stale command: timestamp skew (${clockSkewSeconds}s) exceeds max threshold (${this.maxClockSkewSeconds}s)`;
    }

    const passed = nonceIsFresh && sequenceValid && timestampValid;

    // Only record nonce and advance the sender scope's sequence when the replay
    // check passes AND the caller verified cryptographic authenticity first.
    if (passed && recordState) {
      this.seenNonces.add(nonce);
      this.sequences.set(scope, sequence_number);
      // Bound the nonce cache so it cannot grow forever
      if (this.seenNonces.size > MAX_NONCE_CACHE) {
        const iterator = this.seenNonces.values();
        for (let i = 0; i < NONCE_EVICT_BATCH; i++) {
          this.seenNonces.delete(iterator.next().value!);
        }
      }
    }

    return {
      passed,
      nonce_is_fresh: nonceIsFresh,
      sequence_valid: sequenceValid,
      timestamp_valid: timestampValid,
      clock_skew_seconds: clockSkewSeconds,
      expected_sequence: lastSequenceForScope + 1,
      received_sequence: sequence_number,
      error: errorReason
    };
  }
}
