# OrbitShield — Threat Model

## Threat Catalog

Each threat follows the required format:
**Threat → Attack Vector → Detection → Prevention → Response → Recovery**

---

### 1. Spoofed Ground Station

**Threat**: An attacker impersonates a legitimate ground station to send commands to the spacecraft.

**Attack Vector**:
```
Attacker (port 3500, UNTRUSTED zone)
  → Generates command with forged key_id (e.g., ATTACKER-ROGUE-GS)
  → Signs with rogue secret key
  → Sends to backend /api/commands
  → Attempts to impersonate GS-PRIMARY-01 or other authorized station
```

**Detection**:
- Authentication module checks key_id against authorized registry
- Unknown key_id detected: `Unauthorized key_id: "ATTACKER-ROGUE-GS" is not in spacecraft authorized key registry`
- Security middleware detects untrusted origin (localhost:3500)
- Security event generated: UNAUTHORIZED_ACCESS, CRITICAL, BLOCK

**Prevention**:
- HMAC-SHA256 authentication against credential registry (AUTHORIZED_GROUND_STATIONS)
- Service identity validation via origin check
- Default-deny policy: untrusted origins blocked at perimeter
- Deterministic hard constraint: `HARD_CONSTRAINT_AUTHENTICATION_FAIL`

**Response**:
- Backend returns 403 Forbidden with security context
- Security event persisted to SQLite audit trail
- Risk score: 95/100 (CRITICAL)
- Attacker blocked before reaching spacecraft

**Recovery**:
- No recovery needed — request never executed
- Audit trail records the attempt for forensic analysis
- Ground station registry unchanged (rogue key not added)

---

### 2. Compromised Operator Endpoint

**Threat**: An attacker gains access to a legitimate operator's workstation or credentials.

**Attack Vector**:
```
Attacker compromises operator session
  → Uses legitimate operator credentials
  → Sends commands through Ground Console (port 3000)
  → Attempts unauthorized command types (e.g., SYSTEM_REBOOT, FIRE_THRUSTER)
```

**Detection**:
- Behavioral analysis detects anomalous command patterns
- Mission context module detects phase conflicts (e.g., imaging during eclipse)
- Risk engine calculates elevated risk score
- Audit trail records all commands with operator identity

**Prevention**:
- Command type authorization (some commands restricted by role)
- Mission context constraints (OPT-02: no imaging in eclipse)
- Behavioral anomaly detection (burst detection, state conflicts)
- Deterministic safety policy enforces hard constraints

**Response**:
- If risk >= 75: Autonomous SAFE_MODE triggered
- Dangerous commands blocked by flight software lock
- Telemetry continues (essential functions preserved)
- Operator alert dispatched
- Security event: SAFE_MODE_ENTERED

**Recovery**:
- Operator initiates recovery via OPERATOR_RECOVER command
- Recovery requires: FLIGHT_DIRECTOR clearance + recovery token
- System health verification before restoration
- Safe mode cleared, nominal operations resume
- Recovery audit event recorded

---

### 3. Replay Attack

**Threat**: An attacker captures a valid command and retransmits it to cause duplicate execution.

**Attack Vector**:
```
Attacker eavesdrops on valid command transmission
  → Captures envelope with nonce + sequence + timestamp
  → Retransmits identical envelope to backend
  → Attempts duplicate execution of ROTATE_REACTION_WHEEL or other command
```

**Detection**:
- Replay protection module checks nonce against seen-nonce cache
- Duplicate nonce detected: `Replay detected: nonce "..." has already been processed`
- Sequence number check: received sequence <= last accepted sequence
- Security event: REPLAY_DETECTED

**Prevention**:
- Nonce uniqueness check (global cache, max 5000 entries)
- Monotonic sequence number per (spacecraft_id, key_id) scope
- Timestamp freshness check (60-second clock skew window)
- Anti-replay state persists across restarts (SQLite replay_state table)
- Only cryptographically verified commands advance sequence state

**Response**:
- Command rejected with BLOCK decision
- Deterministic rule: `HARD_CONSTRAINT_REPLAY_DETECTED`
- Audit event records: received_sequence, expected_sequence, last_accepted_sequence
- Risk score: 50+ (HIGH)
- No duplicate execution occurs

**Recovery**:
- No recovery needed — command never executed
- Sequence state unchanged (replay failed)
- Audit trail captures attempt for analysis

---

### 4. Tampered Command

**Threat**: An attacker intercepts a valid command and modifies parameter values.

**Attack Vector**:
```
Attacker intercepts legitimate QUERY_TELEMETRY command
  → Modifies payload to FIRE_THRUSTER with delta_v: 8.5 m/s
  → Keeps original HMAC signature (does not re-sign)
  → Sends tampered envelope to backend
  → Attempts to execute dangerous thruster maneuver
```

**Detection**:
- Integrity module computes HMAC over received envelope
- Computed signature != received signature
- Integrity check fails: `HMAC integrity mismatch: payload, header or encrypted transport has been tampered with`
- Security event: TAMPER_DETECTED

**Prevention**:
- HMAC-SHA256 integrity tag covers canonical header + payload
- Any payload modification invalidates signature
- Canonical JSON stringify ensures reproducible hashing
- Constant-time signature comparison prevents timing attacks
- Deterministic hard constraint: `HARD_CONSTRAINT_INTEGRITY_FAIL`

**Response**:
- Command rejected with BLOCK decision
- Integrity failure explanation includes computed vs received signature
- Risk score: 60+ (HIGH)
- Spacecraft never receives tampered command

**Recovery**:
- No recovery needed — tampered command never executed
- Original legitimate command (if any) unaffected
- Audit trail shows tampering attempt with signature mismatch evidence

---

### 5. Invalid/Forged Command

**Threat**: An attacker sends a malformed or completely forged command envelope.

**Attack Vector**:
```
Attacker crafts malformed command
  → Missing header fields (spacecraft_id, command_id, etc.)
  → Invalid JSON structure
  → Random/garbage signature
  → Sends to backend /api/commands
```

**Detection**:
- Schema validation at gateway entry point
- Missing required fields detected
- Malformed envelope rejected at parser boundary
- Security event: MALFORMED_COMMAND

**Prevention**:
- Schema validation: requires header, payload, security fields
- Type checking on command_id (string), spacecraft_id (string)
- Gateway parser rejects malformed envelopes before pipeline
- Deterministic rule: `SCHEMA_PARSE_FAILURE`

**Response**:
- Immediate BLOCK with explanation: `Malformed envelope rejected by gateway parser.`
- Risk score: 95/100 (CRITICAL)
- No further pipeline processing

**Recovery**:
- No recovery needed — malformed command never processed
- Parser state unchanged
- Audit trail records malformed attempt

---

### 6. Malicious Insider / Unauthorized Operator

**Threat**: An authorized ground station operator abuse their credentials to execute unauthorized commands.

**Attack Vector**:
```
Insider with valid GS-PRIMARY-01 credentials
  → Authenticates successfully (HMAC passes)
  → Attempts commands outside their authorization
  → Example: PAYLOAD_OPERATOR attempts SYSTEM_REBOOT
  → Or: attempts dangerous commands during restricted phases
```

**Detection**:
- Authentication passes (valid credentials)
- But authorization check: command type not in allowed list for this role
- Mission context detects phase violations
- Behavioral analysis detects unusual patterns for this operator

**Prevention**:
- Role-based command authorization (FLIGHT_DIRECTOR, SUBSYSTEM_ENGINEER, PAYLOAD_OPERATOR)
- Each role has allowed_command_types list
- PAYLOAD_OPERATOR limited to CAPTURE_IMAGE, QUERY_TELEMETRY
- Mission phase restrictions (eclipse, etc.)
- Deterministic safety policy evaluates risk

**Response**:
- If command type unauthorized: BLOCK with auth failure explanation
- If command valid but risky: MONITOR or BLOCK based on risk score
- If risk CRITICAL: SAFE_MODE triggered
- Operator identity recorded in audit trail

**Recovery**:
- Same as compromised operator recovery
- Operator credentials may be revoked (future feature)
- Audit trail provides evidence for investigation

---

### 7. Credential/Key Compromise

**Threat**: An attacker steals or compromises legitimate ground station credentials.

**Attack Vector**:
```
Attacker obtains GS-PRIMARY-01 secret_key and encryption_key
  → Creates validly-signed command envelopes
  → HMAC validation passes (legitimate credentials)
  → Attempts mission-violating commands:
    - CAPTURE_IMAGE during UMBRA_ECLIPSE
    - FIRE_THRUSTER with delta_v > 2.0 m/s
    - SYSTEM_REBOOT during low power
  → Bypasses authentication but not authorization/context
```

**Detection**:
- Authentication passes (HMAC valid with stolen creds)
- BUT mission context detects constraint violations:
  - OPT-02: No imaging in eclipse (180W payload, 0W solar)
  - NAV-04: Thruster delta-V exceeds 2.0 m/s limit
  - SAFE-LOCK: Command during SAFE_MODE
- Behavioral analysis detects anomaly pattern:
  - `CREDENTIAL_COMPROMISE_DEVIATION`: sudden deviation from nominal queries to destructive commands
- Risk engine combines: behavioral anomaly + mission conflict + inherent criticality

**Prevention**:
- Mission context module enforces flight rules regardless of auth status
- Behavioral analysis detects credential compromise patterns
- Risk engine thresholds trigger SAFE_MODE at >= 75
- Deterministic safety policy: `AUTONOMOUS_SAFE_MODE_TRIGGER`
- Safe mode lock prevents dangerous commands even with valid creds

**Response**:
- If single violation: BLOCK or MONITOR depending on risk
- If CRITICAL risk (>= 75): AUTONOMOUS SAFE_MODE
  - Dangerous commands blocked
  - Telemetry preserved
  - Operator alerted
  - Security event: SAFE_MODE_ENTERED with reason
- Command history shows legitimately-signed but contextually-blocked command

**Recovery**:
- Requires OPERATOR_RECOVER with FLIGHT_DIRECTOR clearance
- System health verification before restoration
- Options:
  - Revoke compromised key (future: key lifecycle management)
  - Issue new credentials
  - Audit all commands during compromise window
- Recovery audit event records: recovery_token, clearance_level, timestamp

---

## Summary

| Threat | Detection | Prevention | Response | Recovery |
|--------|-----------|------------|----------|----------|
| Spoofed Ground Station | Auth registry check + origin validation | HMAC-SHA256 + credential registry + default-deny | 403 Blocked, security event | No recovery needed |
| Compromised Operator | Behavioral analysis + mission context | Command authorization + mission constraints | SAFE_MODE if critical, block otherwise | OPERATOR_RECOVER with auth |
| Replay Attack | Nonce cache + sequence check + timestamp | Monotonic sequence + freshness window | BLOCK, replay detected event | No recovery needed |
| Tampered Command | HMAC integrity verification | Canonical JSON + constant-time comparison | BLOCK, signature mismatch evidence | No recovery needed |
| Invalid/Forged Command | Schema validation at parser | Required fields + type checking | Immediate BLOCK | No recovery needed |
| Malicious Insider | Role-based auth + behavioral analysis | Allowed command types per role | BLOCK or SAFE_MODE based on risk | Same as compromised operator |
| Credential Compromise | Mission context + behavioral anomaly | Flight rules + risk engine + safe mode | SAFE_MODE if critical, otherwise BLOCK | OPERATOR_RECOVER + key revocation (future) |

## Security Principles

- **DEFAULT DENY**: All requests blocked unless explicitly allowed
- **EXPLICIT ALLOW**: Trusted origins (3000, 3100) allowed; untrusted (3500) blocked
- **LEAST PRIVILEGE**: Each role has minimal command authorizations
- **SERVICE IDENTITY**: Ground stations identified by key_id in registry
- **NETWORK SEGMENTATION**: Logical separation via ports + origin validation
- **QUARANTINE**: Attacker blocked at perimeter, contained in UNTRUSTED zone
- **RECOVERY**: Explicit recovery workflow with authorization requirements

## Defense in Depth

1. **Perimeter**: Security middleware blocks untrusted origins (port 3500)
2. **Authentication**: HMAC-SHA256 verifies sender identity
3. **Integrity**: Signature verification detects tampering
4. **Replay Protection**: Nonce + sequence + timestamp prevent replay
5. **Authorization**: Role-based command type restrictions
6. **Mission Context**: Flight rules regardless of auth status
7. **Behavioral Analysis**: Anomaly detection for credential compromise
8. **Risk Engine**: Multi-factor scoring (crypto + behavioral + mission + spacecraft)
9. **Safety Policy**: Deterministic rules override all heuristics
10. **Safe Mode**: Autonomous protection when risk CRITICAL
11. **Audit Trail**: Every decision persisted to SQLite
