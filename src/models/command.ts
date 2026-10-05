export type CommandType =
  | 'QUERY_TELEMETRY'
  | 'CAPTURE_IMAGE'
  | 'ROTATE_REACTION_WHEEL'
  | 'FIRE_THRUSTER'
  | 'SET_POWER_MODE'
  | 'TRANSMIT_DATA'
  | 'SYSTEM_REBOOT'
  | 'EMERGENCY_SAFE_MODE'
  | 'OPERATOR_RECOVER';

export interface CommandHeader {
  spacecraft_id: string;
  command_id: string;
  timestamp: string; // ISO 8601 UTC
  sequence_number: number;
  nonce: string;
}

export interface CommandPayload {
  command_type: CommandType;
  parameters: Record<string, any>;
}

export interface CommandSecurity {
  key_id: string;
  algorithm: 'HMAC-SHA256' | 'AES-GCM-256' | 'ECDSA-SHA256';
  signature: string;
  ciphertext?: string; // Optional encrypted payload representation
  iv?: string;
}

export interface CommandEnvelope {
  header: CommandHeader;
  payload: CommandPayload;
  security: CommandSecurity;
}

export interface DecryptedCommandEnvelope extends CommandEnvelope {
  isDecrypted?: boolean;
}
