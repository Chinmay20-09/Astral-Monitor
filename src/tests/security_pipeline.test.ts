// OrbitShield Security Pipeline Verification Tests
// Uses the actual backend API to verify security behavior
// Run with: npm run test:pipeline

import { canonicalJsonStringify, computeHmacSha256 } from '../gateway/crypto_utils';

const BASE_URL = process.env.PIPELINE_BASE_URL || 'http://127.0.0.1:4000/api';

// Credentials
const GS_SECRET = 'orbitshield-svalbard-primary-sign-key-demo-2026';
const GS_KEY_ID = 'GS-PRIMARY-01';
const ATTACKER_SECRET = 'rogue-attacker-secret-key-666';
const ATTACKER_KEY_ID = 'ATTACKER-ROGUE-GS';

let seq = 5000;
function nextSeq() { return ++seq; }
function generateNonce() {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createEnvelope(keyId: string, secret: string, commandType: any, params: Record<string, unknown>, seqOverride: number | null = null) {
  const seq = seqOverride !== null ? seqOverride : nextSeq();
  const header = {
    spacecraft_id: 'SAT-01',
    command_id: `CMD-TEST-${seq}`,
    timestamp: new Date().toISOString(),
    sequence_number: seq,
    nonce: generateNonce()
  };
  const payload = { command_type: commandType, parameters: params };
  const signable = canonicalJsonStringify({ header, payload });
  const signature = await computeHmacSha256(secret, signable);
  return { header, payload, security: { key_id: keyId, algorithm: 'HMAC-SHA256', signature } };
}

async function postCommands(envelope: any) {
  const res = await fetch(`${BASE_URL}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ envelope })
  });
  return res.json();
}

async function test(name: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    console.log(`✓ ${name}`);
    return result;
  } catch (err: any) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err?.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n=== OrbitShield Security Pipeline Verification ===\n');

  // Test 1: Valid command
  console.log('--- A. Valid Command ---');
  await test('Valid QUERY_TELEMETRY should ALLOW', async () => {
    const env = await createEnvelope(GS_KEY_ID, GS_SECRET, 'QUERY_TELEMETRY', { subsystems: ['power'] });
    const result = await postCommands(env);
    const decision = result.audit_event?.final_decision;
    
    if (decision !== 'ALLOW') {
      throw new Error(`Expected ALLOW, got ${decision}`);
    }
    if (!result.audit_event.integrity?.passed) {
      throw new Error('Integrity should pass');
    }
    if (!result.audit_event.authentication?.passed) {
      throw new Error('Authentication should pass');
    }
    if (!result.audit_event.replay?.passed) {
      throw new Error('Replay check should pass');
    }
    if (!result.executed) {
      throw new Error('Command should execute');
    }
    
    console.log(`  decision=${decision}`);
    console.log(`  integrity.passed=${result.audit_event.integrity.passed}`);
    console.log(`  authentication.passed=${result.audit_event.authentication.passed}`);
    console.log(`  replay.passed=${result.audit_event.replay.passed}`);
    console.log(`  executed=${result.executed}`);
    console.log(`  event_id=${result.audit_event.event_id}`);
    return result;
  });

  // Test 2: Tampered command
  console.log('\n--- B. Tampered Command ---');
  await test('Tampered payload should BLOCK with INTEGRITY_FAIL', async () => {
    const env = await createEnvelope(GS_KEY_ID, GS_SECRET, 'QUERY_TELEMETRY', { subsystems: ['power'] });
    // Tamper payload AFTER signing
    env.payload.command_type = 'FIRE_THRUSTER';
    env.payload.parameters = { delta_v: 8.5 };
    
    const result = await postCommands(env);
    const decision = result.audit_event?.final_decision;
    
    if (decision !== 'BLOCK') {
      throw new Error(`Expected BLOCK, got ${decision}`);
    }
    if (result.audit_event.integrity?.passed) {
      throw new Error('Integrity should FAIL for tampered command');
    }
    if (result.audit_event.policy?.rule_triggered !== 'HARD_CONSTRAINT_INTEGRITY_FAIL') {
      throw new Error(`Expected HARD_CONSTRAINT_INTEGRITY_FAIL, got ${result.audit_event.policy?.rule_triggered}`);
    }
    if (result.executed) {
      throw new Error('Tampered command should NOT execute');
    }
    
    console.log(`  decision=${decision}`);
    console.log(`  integrity.passed=${result.audit_event.integrity.passed}`);
    console.log(`  integrity.error=${result.audit_event.integrity.error?.slice(0, 80)}`);
    console.log(`  rule_triggered=${result.audit_event.policy.rule_triggered}`);
    console.log(`  event_id=${result.audit_event.event_id}`);
    return result;
  });

  // Test 3: Unauthorized injection
  console.log('\n--- C. Unauthorized Injection ---');
  await test('Rogue key should BLOCK with AUTH_FAIL', async () => {
    const env = await createEnvelope(ATTACKER_KEY_ID, ATTACKER_SECRET, 'SYSTEM_REBOOT', { delay_sec: 0 });
    const result = await postCommands(env);
    const decision = result.audit_event?.final_decision;
    
    if (decision !== 'BLOCK') {
      throw new Error(`Expected BLOCK, got ${decision}`);
    }
    if (result.audit_event.authentication?.passed) {
      throw new Error('Authentication should FAIL for rogue key');
    }
    if (result.audit_event.policy?.rule_triggered !== 'HARD_CONSTRAINT_AUTHENTICATION_FAIL') {
      throw new Error(`Expected HARD_CONSTRAINT_AUTHENTICATION_FAIL, got ${result.audit_event.policy?.rule_triggered}`);
    }
    
    console.log(`  decision=${decision}`);
    console.log(`  authentication.passed=${result.audit_event.authentication.passed}`);
    console.log(`  authentication.error=${result.audit_event.authentication.error}`);
    console.log(`  rule_triggered=${result.audit_event.policy.rule_triggered}`);
    console.log(`  event_id=${result.audit_event.event_id}`);
    return result;
  });

  // Test 4: Replay protection
  console.log('\n--- D. Replay Protection ---');
  await test('Replay same envelope should BLOCK', async () => {
    const env = await createEnvelope(GS_KEY_ID, GS_SECRET, 'ROTATE_REACTION_WHEEL', { axis: 0, rpm: 1200 });
    const seqNum = env.header.sequence_number;
    const nonceVal = env.header.nonce;

    // First request - should ALLOW or MONITOR (both count as accepted for replay state)
    const firstResult = await postCommands(env);
    const firstDecision = firstResult.audit_event.final_decision;
    if (firstDecision !== 'ALLOW' && firstDecision !== 'MONITOR') {
      throw new Error(`First request should be accepted (ALLOW/MONITOR), got ${firstDecision}`);
    }
    console.log(`  First request: ${firstDecision} ✓`);

    // Second request with same envelope - should BLOCK (replay)
    const secondResult = await postCommands(env);
    const decision = secondResult.audit_event?.final_decision;

    if (decision !== 'BLOCK') {
      throw new Error(`Expected BLOCK for replay, got ${decision}`);
    }
    if (secondResult.audit_event.replay?.passed) {
      throw new Error('Replay check should FAIL');
    }
    if (secondResult.audit_event.replay?.nonce_is_fresh) {
      throw new Error('Nonce SHOULD NOT be fresh (replay detected)');
    }
    if (secondResult.audit_event.policy?.rule_triggered !== 'HARD_CONSTRAINT_REPLAY_DETECTED') {
      throw new Error(`Expected HARD_CONSTRAINT_REPLAY_DETECTED, got ${secondResult.audit_event.policy?.rule_triggered}`);
    }

    console.log(`  Second request: BLOCK ✓`);
    console.log(`  sequence=${seqNum}`);
    console.log(`  nonce=${nonceVal}`);
    console.log(`  replay.passed=${secondResult.audit_event.replay.passed}`);
    console.log(`  nonce_is_fresh=${secondResult.audit_event.replay.nonce_is_fresh}`);
    console.log(`  rule_triggered=${secondResult.audit_event.policy.rule_triggered}`);
    console.log(`  event_id=${secondResult.audit_event.event_id}`);
    return secondResult;
  });

  // Test 5: Credential compromise → SAFE_MODE
  console.log('\n--- E. Credential Compromise → SAFE_MODE ---');
  // Before this test, the spacecraft must be in NOMINAL and the mission must
  // be in UMBRA_ECLIPSE. This test runs after replay/monitor commands have
  // already been accepted, so the spacecraft is likely still NOMINAL.
  // We explicitly reset the spacecraft to NOMINAL and confirm the mission
  // phase is eclipse via the mission API.
  await test('ensure spacecraft NOMINAL and mission in eclipse before compromise test', async () => {
    const recoverRes = await fetch(`${BASE_URL}/spacecraft/SAT-01/recovery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      },
      body: JSON.stringify({ token: 'GROUND-SECURE-RECOVERY-CHANNEL' })
    });
    const recoverData = await recoverRes.json();
    if (recoverData.spacecraft_state?.operating_mode !== 'NOMINAL') {
      throw new Error(`pre-condition failed: expected NOMINAL, got ${recoverData.spacecraft_state?.operating_mode}`);
    }

    const missionRes = await fetch(`${BASE_URL}/mission`);
    const missionData = await missionRes.json();
    if (!missionData.current_phase) {
      throw new Error('pre-condition failed: mission endpoint did not return current_phase');
    }
    if (missionData.current_phase.name !== 'UMBRA_ECLIPSE') {
      throw new Error(`pre-condition failed: expected UMBRA_ECLIPSE, got ${missionData.current_phase.name}`);
    }
    console.log('  pre-condition OK: NOMINAL + UMBRA_ECLIPSE');
  });

  const compromiseResult = await test('Valid HMAC + mission violation should trigger SAFE_MODE', async () => {
    // CAPTURE_IMAGE during UMBRA_ECLIPSE with valid credentials
    const env = await createEnvelope(GS_KEY_ID, GS_SECRET, 'CAPTURE_IMAGE', {
      target: 'High-Res Earth Pass',
      resolution: '4096x3072 Multispectral'
    });

    const result = await postCommands(env);
    const decision = result.audit_event?.final_decision;

    if (decision !== 'SAFE_MODE') {
      throw new Error(`Expected SAFE_MODE, got ${decision}`);
    }
    if (!result.audit_event.authentication?.passed) {
      throw new Error('Authentication should PASS (valid stolen creds)');
    }
    if (!result.audit_event.integrity?.passed) {
      throw new Error('Integrity should PASS (valid HMAC)');
    }
    if (result.audit_event.mission_context?.is_compliant) {
      throw new Error('Mission context should detect violation (eclipse imaging)');
    }
    if (result.audit_event.risk?.severity !== 'CRITICAL') {
      throw new Error(`Expected CRITICAL risk, got ${result.audit_event.risk?.severity}`);
    }
    if (result.audit_event.risk?.total_score < 75) {
      throw new Error(`Risk score should be >= 75, got ${result.audit_event.risk?.total_score}`);
    }
    if (result.spacecraft_state?.operating_mode !== 'SAFE_MODE') {
      throw new Error(`Spacecraft should be in SAFE_MODE, got ${result.spacecraft_state?.operating_mode}`);
    }
    if (result.audit_event.policy?.rule_triggered !== 'AUTONOMOUS_SAFE_MODE_TRIGGER') {
      throw new Error(`Expected AUTONOMOUS_SAFE_MODE_TRIGGER, got ${result.audit_event.policy?.rule_triggered}`);
    }

    console.log(`  decision=${decision}`);
    console.log(`  authentication.passed=${result.audit_event.authentication.passed}`);
    console.log(`  integrity.passed=${result.audit_event.integrity.passed}`);
    console.log(`  mission_context.is_compliant=${result.audit_event.mission_context.is_compliant}`);
    console.log(`  mission_context.conflicting_rules=${JSON.stringify(result.audit_event.mission_context.conflicting_rules)}`);
    console.log(`  risk.severity=${result.audit_event.risk.severity}`);
    console.log(`  risk.total_score=${result.audit_event.risk.total_score}`);
    console.log(`  spacecraft.operating_mode=${result.spacecraft_state.operating_mode}`);
    console.log(`  policy.rule_triggered=${result.audit_event.policy.rule_triggered}`);
    console.log(`  event_id=${result.audit_event.event_id}`);
    return result;
  });

  // Test 6: SAFE_MODE_LOCK
  console.log('\n--- F. SAFE_MODE Lock ---');
  await test('Destructive command in SAFE_MODE should BLOCK', async () => {
    // Verify spacecraft is in SAFE_MODE
    const statusRes = await fetch(`${BASE_URL}/spacecraft/SAT-01`);
    const status = await statusRes.json();
    if (status.state.operating_mode !== 'SAFE_MODE') {
      throw new Error(`Spacecraft not in SAFE_MODE, got ${status.state.operating_mode}`);
    }
    
    const env = await createEnvelope(GS_KEY_ID, GS_SECRET, 'FIRE_THRUSTER', {
      delta_v: 6.2,
      burn_duration_ms: 18000
    });
    
    const result = await postCommands(env);
    const decision = result.audit_event?.final_decision;
    
    if (decision !== 'BLOCK') {
      throw new Error(`Expected BLOCK, got ${decision}`);
    }
    if (result.audit_event.policy?.rule_triggered !== 'HARD_CONSTRAINT_SAFE_MODE_LOCKED') {
      throw new Error(`Expected HARD_CONSTRAINT_SAFE_MODE_LOCKED, got ${result.audit_event.policy?.rule_triggered}`);
    }
    if (result.executed) {
      throw new Error('Destructive command should NOT execute in SAFE_MODE');
    }
    
    console.log(`  decision=${decision}`);
    console.log(`  rule_triggered=${result.audit_event.policy.rule_triggered}`);
    console.log(`  safe_mode_activated=${result.audit_event.policy.safe_mode_activated}`);
    console.log(`  event_id=${result.audit_event.event_id}`);
    return result;
  });

  // Test 7: Authorized recovery
  console.log('\n--- G. Authorized Recovery ---');
  await test('Authorized recovery from trusted origin should restore NOMINAL', async () => {
    const recoverRes = await fetch(`${BASE_URL}/spacecraft/SAT-01/recovery`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'  // TRUSTED origin
      },
      body: JSON.stringify({ token: 'GROUND-SECURE-RECOVERY-CHANNEL' })
    });
    const recoverData = await recoverRes.json();
    
    if (recoverData.spacecraft_state?.operating_mode !== 'NOMINAL') {
      throw new Error(`Expected NOMINAL, got ${recoverData.spacecraft_state?.operating_mode}`);
    }
    if (recoverData.audit_event?.final_decision !== 'ALLOW') {
      throw new Error(`Expected ALLOW, got ${recoverData.audit_event?.final_decision}`);
    }
    if (recoverData.audit_event?.policy?.rule_triggered !== 'OPERATOR_RECOVERY_ACCEPTED') {
      throw new Error(`Expected OPERATOR_RECOVERY_ACCEPTED, got ${recoverData.audit_event?.policy?.rule_triggered}`);
    }
    
    console.log(`  spacecraft.operating_mode=${recoverData.spacecraft_state.operating_mode}`);
    console.log(`  decision=${recoverData.audit_event.final_decision}`);
    console.log(`  rule_triggered=${recoverData.audit_event.policy.rule_triggered}`);
    console.log(`  event_id=${recoverData.audit_event.event_id}`);
    return recoverData;
  });

  // Test 8: Unauthorized recovery attempt
  console.log('\n--- H. Unauthorized Recovery Attempt ---');
  await test('Unauthorized recovery attempt should BLOCK', async () => {
    const unauthRes = await fetch(`${BASE_URL}/spacecraft/SAT-01/recovery`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3500'  // ATTACKER origin
      },
      body: JSON.stringify({ token: 'ATTACKER-TOKEN' })
    });
    
    // Should get 403 from security middleware
    if (unauthRes.status === 200) {
      throw new Error('Unauthorized recovery should return 403');
    }
    console.log(`  HTTP status: ${unauthRes.status} (expected 403)`);
    
    // Verify SAFE_MODE is still active
    const statusRes = await fetch(`${BASE_URL}/spacecraft/SAT-01`);
    const status = await statusRes.json();
    if (status.state.operating_mode !== 'SAFE_MODE') {
      throw new Error(`SAFE_MODE should still be active, got ${status.state.operating_mode}`);
    }
    console.log(`  SAFE_MODE still active after unauthorized attempt ✓`);
    return { status: unauthRes.status, spacecraftMode: status.state.operating_mode };
  });

  // Test 9: Valid command after recovery
  console.log('\n--- I. Valid Command After Recovery ---');
  await test('Valid command after recovery should ALLOW', async () => {
    const env = await createEnvelope(GS_KEY_ID, GS_SECRET, 'QUERY_TELEMETRY', { subsystems: ['all'] });
    const result = await postCommands(env);
    
    if (result.audit_event?.final_decision !== 'ALLOW') {
      throw new Error(`Expected ALLOW, got ${result.audit_event?.final_decision}`);
    }
    if (result.spacecraft_state?.operating_mode !== 'NOMINAL') {
      throw new Error(`Spacecraft should be NOMINAL, got ${result.spacecraft_state?.operating_mode}`);
    }
    
    console.log(`  decision=${result.audit_event.final_decision}`);
    console.log(`  spacecraft.operating_mode=${result.spacecraft_state.operating_mode}`);
    console.log(`  event_id=${result.audit_event.event_id}`);
    return result;
  });

  // Test 10: Event ID consistency
  console.log('\n--- J. Event ID Consistency ---');
  await test('Event ID should be consistent across API response and persisted events', async () => {
    const env = await createEnvelope(GS_KEY_ID, GS_SECRET, 'QUERY_TELEMETRY', {});
    const result = await postCommands(env);
    const eventId = result.audit_event?.event_id;
    
    // Fetch from security events endpoint
    const eventsRes = await fetch(`${BASE_URL}/security-events?limit=1`);
    const eventsData = await eventsRes.json();
    const persistedEvent = eventsData.events?.[0];
    
    if (!eventId) {
      throw new Error('No event_id in API response');
    }
    if (!persistedEvent) {
      throw new Error('No persisted event found');
    }
    if (eventId !== persistedEvent.id) {
      throw new Error(`Event ID mismatch: API=${eventId}, persisted=${persistedEvent.id}`);
    }
    
    console.log(`  API event_id: ${eventId}`);
    console.log(`  Persisted event_id: ${persistedEvent.id}`);
    console.log(`  Match: YES ✓`);
    return { apiEventId: eventId, persistedEventId: persistedEvent.id };
  });

  console.log('\n=== ALL SECURITY VERIFICATION TESTS PASSED ===\n');
}

export async function execute() {
  await main();
}

if (process.env.RUNNER === '1' || !process.env.VITEST) {
  execute().catch(err => {
    console.error('\n=== TESTS FAILED ===');
    console.error(err);
    process.exit(1);
  });
}
