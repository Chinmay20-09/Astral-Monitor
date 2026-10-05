import { SecurityGateway, GatewayProcessResult } from '../../../src/gateway/gateway';
import { CommandEnvelope, CommandType } from '../../../src/models/command';
import { SecurityDecision } from '../../../src/models/audit';
import { GroundStationClient } from '../../../src/ground_station/client';
import { getDatabase } from '../db/database';
import { CommandRepository } from '../db/repositories/commandRepository';
import { SecurityEventRepository } from '../db/repositories/securityEventRepository';
import { ReplayStateRepository } from '../db/repositories/replayStateRepository';
import { SpacecraftRepository } from '../db/repositories/spacecraftRepository';
import { SpacecraftService } from './spacecraftService';
import { MissionService } from './missionService';
import { config } from '../config';

/**
 * Orchestrates the existing security gateway pipeline (src/gateway/*) server-side
 * and makes every decision durable:
 *
 * 1. Runs the unchanged SecurityGateway pipeline (parse → integrity → auth →
 *    replay → behavioral → mission context → risk → policy → response → audit).
 * 2. Persists the command envelope, the complete explainable audit event, the
 *    per-sender replay state and the resulting spacecraft state inside ONE
 *    SQLite transaction — a decision is durable exactly when its audit record is.
 * 3. Owns the authoritative credential registry (via the gateway) and originates
 *    signed/encrypted envelopes server-side for operator commands, so no secret
 *    ever reaches the browser.
 * 4. On startup, rehydrates per-(spacecraft, key) replay protection, the nonce
 *    cache and behavioral command history from SQLite so attacks spanning a
 *    server restart are still detected.
 */
export interface OperatorCommandIntent {
  key_id: string;
  command_type: CommandType;
  parameters?: Record<string, unknown>;
  encrypt?: boolean;
}

export class CommandService {
  private gateway: SecurityGateway;
  /** Per-key server-side envelope originators (hold the credential material). */
  private readonly operatorClients = new Map<string, GroundStationClient>();
  private readonly commandRepository = new CommandRepository();
  private readonly eventRepository = new SecurityEventRepository();
  private readonly replayStateRepository = new ReplayStateRepository();
  private readonly spacecraftRepository = new SpacecraftRepository();

  constructor(
    private readonly spacecraftService: SpacecraftService,
    private readonly missionService: MissionService,
    private readonly spacecraftId = config.defaultSpacecraftId
  ) {
    this.gateway = this.buildGateway();
  }

  private buildGateway(): SecurityGateway {
    const gateway = new SecurityGateway(
      this.spacecraftService.getSimulator(),
      this.missionService.getContextModule(),
      { maxClockSkewSeconds: config.maxClockSkewSeconds }
    );
    this.rehydrateGatewayState(gateway);
    return gateway;
  }

  /** Restores anti-replay and behavioral session state from the persisted audit trail. */
  private rehydrateGatewayState(gateway: SecurityGateway): void {
    // 1. Per-(spacecraft, key) sequence counters from the replay_state table.
    const replayRows = this.replayStateRepository.list();
    if (replayRows.length > 0) {
      gateway.replayModule.seedState(replayRows);
      console.log(`[gateway] replay sequence scopes restored (${replayRows.length})`);
    } else {
      // Back-compat: databases created before migration 002 derive per-key
      // state from the persisted commands table.
      const perKey = this.commandRepository.getMaxSequenceNumberByKey(this.spacecraftId);
      if (perKey.length > 0) {
        gateway.replayModule.seedState(
          perKey.map(r => ({ spacecraft_id: this.spacecraftId, key_id: r.key_id, last_sequence: r.max_seq }))
        );
        console.log(`[gateway] replay sequences derived from commands table (${perKey.length} keys)`);
      }
    }

    // 2. Bounded nonce cache from the persisted command trail.
    const nonces = this.commandRepository.getRecentNonces(5000);
    if (nonces.length > 0) {
      gateway.replayModule.seedNonces(nonces);
      console.log(`[gateway] replay nonce cache restored (${nonces.length} entries)`);
    }

    // 3. Behavioral analysis history.
    const recent = this.eventRepository.getRecentForRehydration(50);
    for (const row of recent) {
      gateway.behavioralModule.recordCommand(
        {
          header: {
            spacecraft_id: this.spacecraftId,
            command_id: row.command_id,
            timestamp: row.timestamp ?? new Date().toISOString(),
            sequence_number: 0,
            nonce: ''
          },
          payload: {
            command_type: (row.command_type ?? 'QUERY_TELEMETRY') as CommandType,
            parameters: {}
          },
          security: {
            key_id: row.key_id ?? 'UNKNOWN',
            algorithm: 'HMAC-SHA256',
            signature: ''
          }
        } as CommandEnvelope,
        row.final_decision as SecurityDecision
      );
    }
    if (recent.length > 0) {
      console.log(`[gateway] behavioral history restored (${recent.length} entries)`);
    }
  }

  /**
   * Server-side envelope originator for one ground-station key. The counter is
   * synced with the persisted per-(spacecraft, key) replay state, so operator
   * and attack traffic share one monotonic per-sender sequence stream.
   */
  public getOperatorClient(keyId: string): GroundStationClient {
    let client = this.operatorClients.get(keyId);
    if (!client) {
      client = new GroundStationClient(keyId, 1000, this.spacecraftId);
      const last = this.gateway.replayModule.getLastSequenceNumber(this.spacecraftId, keyId);
      client.setSequenceCounter(last);
      this.operatorClients.set(keyId, client);
    }
    return client;
  }

  /**
   * Operator command intent (from the browser console). The backend resolves
   * the authenticated credential, builds the envelope, applies the HMAC tag
   * and optional AES-GCM encryption server-side, then runs the full pipeline.
   */
  public async processOperatorCommand(
    intent: OperatorCommandIntent,
    options?: { attackType?: string }
  ): Promise<GatewayProcessResult> {
    if (!intent || typeof intent !== 'object' || typeof intent.command_type !== 'string') {
      throw new TypeError('Operator intent requires at least { command_type }');
    }
    const client = this.getOperatorClient(intent.key_id || 'GS-PRIMARY-01');
    const envelope = await client.createCommandEnvelope(
      intent.command_type,
      (intent.parameters ?? {}) as Record<string, any>,
      { encryptPayload: intent.encrypt === true }
    );
    return this.processCommand(envelope, options);
  }

  public async processCommand(
    envelope: unknown,
    options?: { attackType?: string }
  ): Promise<GatewayProcessResult> {
    // The unchanged gateway pipeline handles parsing, validation, analysis and policy.
    const result = await this.gateway.processCommand(envelope as CommandEnvelope, options);

    // For encrypted commands the forensic command row stores the DECRYPTED
    // parameters (server-side only) while the audit envelope keeps the wire form.
    const decryptedParams = result.audit_event.integrity?.decryption?.parameters;
    const effectiveEnvelope: CommandEnvelope =
      decryptedParams && isWellFormedEnvelope(envelope)
        ? {
            ...envelope,
            payload: { ...envelope.payload, parameters: decryptedParams as Record<string, any> }
          }
        : (envelope as CommandEnvelope);

    // Durable, transactional persistence: command + audit event + replay state
    // + spacecraft state commit or roll back together. A persistence failure is
    // surfaced to the caller — it never silently converts a decision into a
    // success response.
    try {
      const persist = getDatabase().transaction(() => {
        if (isWellFormedEnvelope(envelope)) {
          this.commandRepository.insert(effectiveEnvelope);
          const keyId = (envelope as CommandEnvelope).security?.key_id ?? 'UNKNOWN';
          this.replayStateRepository.upsert(
            (envelope as CommandEnvelope).header.spacecraft_id,
            keyId,
            this.gateway.replayModule.getLastSequenceNumber(
              (envelope as CommandEnvelope).header.spacecraft_id,
              keyId
            )
          );
        }
        this.eventRepository.insert(result.audit_event);
        this.spacecraftRepository.save(result.spacecraft_state);
      });
      persist();
    } catch (err) {
      console.error('[persistence] transaction failed — rolled back, decision NOT persisted:', err);
      throw new PersistenceError(
        'Security decision could not be persisted: the audit transaction was rolled back. ' +
          'The command result is NOT durably recorded — re-check database health before continuing.'
      );
    }

    return result;
  }

  /** Next acceptable sequence number (per sender key, or global maximum). */
  public getNextSequence(keyId?: string): number {
    if (keyId) {
      return this.gateway.replayModule.getLastSequenceNumber(this.spacecraftId, keyId) + 1;
    }
    const dbMax = this.commandRepository.getMaxSequenceNumber(this.spacecraftId);
    const replayLast = this.gateway.replayModule.getLastSequenceNumber();
    return Math.max(dbMax ?? 0, replayLast) + 1;
  }

  /**
   * Operator-initiated full session reset: wipes the persisted command/audit trail
   * and replay state, resets the vehicle and mission plan, and rebuilds the gateway
   * with empty replay/behavioral state. Mirrors the "Reset Session" operator action.
   */
  public resetSession(): { spacecraft: GatewayProcessResult['spacecraft_state']; telemetry: GatewayProcessResult['telemetry']; mission: ReturnType<MissionService['getMissionState']>; next_sequence: number } {
    this.commandRepository.deleteAll();
    this.eventRepository.deleteAll();
    this.replayStateRepository.deleteAll();
    const spacecraft = this.spacecraftService.reset();
    const mission = this.missionService.reset(this.spacecraftId);
    this.operatorClients.clear();
    this.gateway = this.buildGateway();
    return { spacecraft: spacecraft.state, telemetry: spacecraft.telemetry, mission, next_sequence: this.getNextSequence() };
  }

  public getGateway(): SecurityGateway {
    return this.gateway;
  }
}

/** Raised when the audit persistence transaction fails; maps to HTTP 503. */
export class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersistenceError';
  }
}

function isWellFormedEnvelope(envelope: unknown): envelope is CommandEnvelope {
  return (
    !!envelope &&
    typeof envelope === 'object' &&
    !!(envelope as CommandEnvelope).header &&
    typeof (envelope as CommandEnvelope).header.command_id === 'string' &&
    typeof (envelope as CommandEnvelope).header.spacecraft_id === 'string'
  );
}
