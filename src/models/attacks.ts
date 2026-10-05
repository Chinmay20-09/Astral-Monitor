/**
 * UI-safe attack scenario metadata (controlled local simulation only — no
 * credential material, no offensive tooling). The hostile envelopes themselves
 * are generated on the backend by the AttackService; this module only
 * describes the scenarios for the operator dashboard.
 */
export interface AttackScenario {
  id: string;
  name: string;
  category: 'TAMPERING' | 'INJECTION' | 'REPLAY' | 'CREDENTIAL_COMPROMISE' | 'DESTRUCTIVE_BURN' | 'EAVESDROPPING';
  description: string;
  expectedGatewayOutcome: 'BLOCK' | 'SAFE_MODE' | 'PASSIVE';
  defenseMechanism: string;
}

export const ATTACK_SCENARIOS: AttackScenario[] = [
  {
    id: 'SCENARIO-TAMPER',
    name: 'In-Transit Command Tampering',
    category: 'TAMPERING',
    description: 'Attacker intercepts a valid telemetry query or attitude command and alters parameter bytes (e.g. injects illegal thruster fire or modifies reaction wheel RPM) without valid re-signing.',
    expectedGatewayOutcome: 'BLOCK',
    defenseMechanism: 'HMAC-SHA256 Integrity Verification'
  },
  {
    id: 'SCENARIO-INJECT',
    name: 'Unauthorized Key Injection',
    category: 'INJECTION',
    description: 'Adversary manufactures a synthetic command with forged key_id "ATTACKER-ROGUE-GS" and signs with an unauthorized private key.',
    expectedGatewayOutcome: 'BLOCK',
    defenseMechanism: 'Ground Station Authentication & Key Registry Validation'
  },
  {
    id: 'SCENARIO-REPLAY',
    name: 'Replay / Duplicate Attack',
    category: 'REPLAY',
    description: 'Adversary eavesdrops on a previous valid maneuver command and re-transmits the identical envelope with old nonce and stale sequence number.',
    expectedGatewayOutcome: 'BLOCK',
    defenseMechanism: 'Nonce Cache + Per-Sender Monotonic Sequence Tracking + Clock Skew Window'
  },
  {
    id: 'SCENARIO-COMPROMISE',
    name: 'Compromised Credential + Mission Conflict',
    category: 'CREDENTIAL_COMPROMISE',
    description: 'Attacker exfiltrates authentic Ground Station keys. HMAC checks pass, but attacker attempts high-power imaging during eclipse, triggering behavioral & mission context detection and Autonomous Safe Mode.',
    expectedGatewayOutcome: 'SAFE_MODE',
    defenseMechanism: 'Behavioral Anomaly Detection + Mission Context Rule Engine + Autonomous Safe Mode Escalation'
  },
  {
    id: 'SCENARIO-DESTRUCTIVE-BURN',
    name: 'Destructive Orbit Alteration',
    category: 'DESTRUCTIVE_BURN',
    description: 'Attacker with valid credentials commands an unauthorized 6.2 m/s orbit burn during eclipse. Contextual risk becomes CRITICAL and the vehicle autonomously enters SAFE MODE.',
    expectedGatewayOutcome: 'SAFE_MODE',
    defenseMechanism: 'Contextual Risk Engine (score >= 75) + Deterministic Safety Policy'
  },
  {
    id: 'SCENARIO-EAVESDROP',
    name: 'Passive Interception & Ciphertext Analysis',
    category: 'EAVESDROPPING',
    description: 'Adversary taps RF downlink/uplink channel. AES-GCM-256 encrypted command payload (authenticated server-side decryption) protects operational parameters from disclosure.',
    expectedGatewayOutcome: 'PASSIVE',
    defenseMechanism: 'AES-GCM-256 Transport Encryption (ciphertext authoritative on the wire)'
  }
];
