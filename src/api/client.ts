/**
 * Typed HTTP client for the OrbitShield local security backend.
 * In development the Vite dev server proxies /api → http://127.0.0.1:4000.
 *
 * SECURITY BOUNDARY: this client talks to the backend as an *operator console*.
 * It sends command intents and attack scenario intents only — credential
 * lookup, HMAC signing, AES-GCM encryption/decryption, replay tracking and the
 * full security pipeline live exclusively in the backend process.
 */

import { CommandEnvelope } from '../models/command';
import { AuditEvent } from '../models/audit';
import { SpacecraftState, EssentialTelemetry } from '../models/spacecraft';
import { MissionState } from '../models/mission';

const API_BASE = '/api';

export interface GatewayProcessResultDTO {
  audit_event: AuditEvent;
  executed: boolean;
  execution_message?: string;
  spacecraft_state: SpacecraftState;
  telemetry: EssentialTelemetry;
}

export interface AttackResultDTO extends GatewayProcessResultDTO {
  scenario: string;
  description: string;
}

export interface SpacecraftSnapshotDTO {
  state: SpacecraftState;
  telemetry: EssentialTelemetry;
}

export interface SessionResetDTO {
  message: string;
  spacecraft: SpacecraftSnapshotDTO;
  mission: MissionState;
  next_sequence: number;
}

export interface SecurityEventsDTO {
  total: number;
  decisions: Record<string, number>;
  events: AuditEvent[];
}

export interface GroundStationSnapshot {
  key_id: string;
  station_name: string;
  allowed_command_types: string[];
  role: string;
  status: string;
}

export interface OperatorCommandIntent {
  key_id: string;
  command_type: string;
  parameters?: Record<string, unknown>;
  encrypt?: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new Error(`OrbitShield API error: ${message}`);
  }
  return response.json() as Promise<T>;
}

export const orbitShieldApi = {
  health: () => request<{ status: string; database: string }>('/health'),

  /**
   * Operator console action: sends a command INTENT to the backend. The backend
   * resolves the ground-station credential, applies the HMAC tag and optional
   * AES-GCM encryption server-side, then runs the full security pipeline.
   */
  dispatchOperatorCommand: (intent: OperatorCommandIntent) =>
    request<GatewayProcessResultDTO>('/commands/operator', {
      method: 'POST',
      body: JSON.stringify(intent)
    }),

  /** Raw (pre-signed) envelope entry — used by tools/tests; hostile traffic is expected here. */
  processCommand: (envelope: CommandEnvelope, attackType?: string) =>
    request<GatewayProcessResultDTO>('/commands', {
      method: 'POST',
      body: JSON.stringify({ envelope, attackType })
    }),

  /** Controlled local attack simulation — hostile envelopes are generated server-side. */
  simulateAttack: (scenario: string) =>
    request<AttackResultDTO>('/attacks', {
      method: 'POST',
      body: JSON.stringify({ scenario })
    }),

  /** Sequence sync for external ground-station tooling (per key or global). */
  getNextSequence: (spacecraftId = 'SAT-01', keyId?: string) =>
    request<{ spacecraft_id: string; next_sequence: number }>(
      `/commands/next-sequence?spacecraft_id=${encodeURIComponent(spacecraftId)}${keyId ? `&key_id=${encodeURIComponent(keyId)}` : ''}`
    ),

  getGroundStations: () => request<{ total: number; stations: GroundStationSnapshot[] }>('/ground-stations'),

  getSecurityEvents: (limit = 200) =>
    request<SecurityEventsDTO>(`/security-events?limit=${limit}`),

  getSecurityEvent: (eventId: string) => request<{ event: AuditEvent }>(`/security-events/${encodeURIComponent(eventId)}`),

  getSpacecraft: (spacecraftId = 'SAT-01') => request<SpacecraftSnapshotDTO>(`/spacecraft/${encodeURIComponent(spacecraftId)}`),

  /** All mission sessions from the backend. */
  listSessions: () => request<{ total: number; sessions: any[] }>('/sessions'),

  /** Operator recovery from SAFE_MODE through the backend gateway pipeline. */
  recoverSpacecraft: (spacecraftId = 'SAT-01') =>
    request<GatewayProcessResultDTO>(`/spacecraft/${encodeURIComponent(spacecraftId)}/recovery`, {
      method: 'POST'
    }),

  tickSpacecraft: (deltaSeconds = 2.0) =>
    request<SpacecraftSnapshotDTO>('/spacecraft/tick', {
      method: 'POST',
      body: JSON.stringify({ delta_seconds: deltaSeconds })
    }),

  resetSession: () => request<SessionResetDTO>('/spacecraft/reset', { method: 'POST' }),

  getMission: (spacecraftId = 'SAT-01') => request<{ mission: MissionState }>(`/mission/${encodeURIComponent(spacecraftId)}`),

  setMissionPhase: (phase: 'UMBRA_ECLIPSE' | 'FULL_SUN_IMAGING') =>
    request<{ mission: MissionState }>('/mission/phase', {
      method: 'POST',
      body: JSON.stringify({ phase })
    })
};
