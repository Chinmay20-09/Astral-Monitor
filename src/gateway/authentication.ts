import { CommandEnvelope } from '../models/command';
import { AuthenticationCheckResult } from '../models/audit';

export interface GroundStationCredential {
  key_id: string;
  station_name: string;
  secret_key: string;
  encryption_key: string;
  allowed_command_types: string[];
  role: 'FLIGHT_DIRECTOR' | 'SUBSYSTEM_ENGINEER' | 'PAYLOAD_OPERATOR';
  status: 'ACTIVE' | 'REVOKED';
}

// Simulated local key registry for ground stations (safe mock keys per TRD section 5)
export const AUTHORIZED_GROUND_STATIONS: Record<string, GroundStationCredential> = {
  'GS-PRIMARY-01': {
    key_id: 'GS-PRIMARY-01',
    station_name: 'Svalbard Satellite Station (SvalSat)',
    secret_key: 'orbitshield-svalbard-primary-sign-key-demo-2026',
    encryption_key: 'orbitshield-svalbard-aes-transport-key-2026',
    allowed_command_types: ['ALL'],
    role: 'FLIGHT_DIRECTOR',
    status: 'ACTIVE'
  },
  'GS-BACKUP-02': {
    key_id: 'GS-BACKUP-02',
    station_name: 'Santiago Earth Station Backup',
    secret_key: 'orbitshield-santiago-backup-sign-key-demo-2026',
    encryption_key: 'orbitshield-santiago-aes-transport-key-2026',
    allowed_command_types: ['QUERY_TELEMETRY', 'CAPTURE_IMAGE', 'TRANSMIT_DATA'],
    role: 'SUBSYSTEM_ENGINEER',
    status: 'ACTIVE'
  },
  'GS-PAYLOAD-03': {
    key_id: 'GS-PAYLOAD-03',
    station_name: 'Toulouse Payload Operations',
    secret_key: 'orbitshield-toulouse-payload-sign-key-demo-2026',
    encryption_key: 'orbitshield-toulouse-aes-transport-key-2026',
    allowed_command_types: ['CAPTURE_IMAGE', 'QUERY_TELEMETRY'],
    role: 'PAYLOAD_OPERATOR',
    status: 'ACTIVE'
  }
};

export class AuthenticationModule {
  private registry: Record<string, GroundStationCredential>;

  constructor(customRegistry?: Record<string, GroundStationCredential>) {
    this.registry = customRegistry || { ...AUTHORIZED_GROUND_STATIONS };
  }

  public getCredential(keyId: string): GroundStationCredential | undefined {
    return this.registry[keyId];
  }

  public authenticate(envelope: CommandEnvelope): AuthenticationCheckResult {
    const keyId = envelope.security.key_id;
    if (!keyId) {
      return {
        passed: false,
        key_id: 'UNKNOWN',
        error: 'Missing security key_id in command envelope'
      };
    }

    const cred = this.registry[keyId];
    if (!cred) {
      return {
        passed: false,
        key_id: keyId,
        error: `Unauthorized key_id: "${keyId}" is not in spacecraft authorized key registry`
      };
    }

    if (cred.status === 'REVOKED') {
      return {
        passed: false,
        key_id: keyId,
        error: `Credential for key_id "${keyId}" has been revoked by Ground Security Policy`
      };
    }

    return {
      passed: true,
      key_id: keyId,
      authorized_identity: cred.station_name,
      role: cred.role
    };
  }
}
