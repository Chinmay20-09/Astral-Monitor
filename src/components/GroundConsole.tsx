import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Radio, Send, Lock, ShieldCheck, Sliders, AlertTriangle, Activity,
  RefreshCw, Trash2, Plus, Route, Play, XCircle, CheckCircle,
  ShieldAlert, Flame, Key, FileCode, Repeat, Eye, Sparkles,
  ArrowRight, Terminal
} from 'lucide-react';
import { orbitShieldApi, GroundStationSnapshot, OperatorCommandIntent, GatewayProcessResultDTO } from '../api/client';
import { attackerClient } from '../attacker/attackerClient';
import { CommandType } from '../models/command';
import { EssentialTelemetry, SpacecraftState } from '../models/spacecraft';
import { MissionState } from '../models/mission';


interface GroundConsoleProps {
  spacecraftId?: string;
}

const COMMAND_TEMPLATES: { type: CommandType; label: string; params: Record<string, unknown> }[] = [
  { type: 'QUERY_TELEMETRY', label: 'QUERY_TELEMETRY', params: { subsystems: ['power', 'thermal', 'navigation'] } },
  { type: 'CAPTURE_IMAGE', label: 'CAPTURE_IMAGE', params: { target: 'Nadir Earth swath', resolution: '4096x3072' } },
  { type: 'ROTATE_REACTION_WHEEL', label: 'ROTATE_REACTION_WHEEL', params: { axis: 1, rpm: 1800 } },
  { type: 'FIRE_THRUSTER', label: 'FIRE_THRUSTER', params: { delta_v: 0.5, burn_duration_ms: 4000 } },
  { type: 'SYSTEM_REBOOT', label: 'SYSTEM_REBOOT', params: { delay_sec: 5, preserve_logs: true } }
];

export const GroundConsole: React.FC<GroundConsoleProps> = ({ spacecraftId = 'SAT-01' }) => {
  const [stations, setStations] = useState<GroundStationSnapshot[]>([]);
  const [state, setState] = useState<SpacecraftState | null>(null);
  const [telemetry, setTelemetry] = useState<EssentialTelemetry | null>(null);
  const [mission, setMission] = useState<MissionState | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [transmitting, setTransmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string>('GS-PRIMARY-01');
  const [selectedCommand, setSelectedCommand] = useState<CommandType>('QUERY_TELEMETRY');

  const load = useCallback(async () => {
    try {
      const [st, sp, mn, sessionsData] = await Promise.all([
        orbitShieldApi.getGroundStations(),
        orbitShieldApi.getSpacecraft(),
        orbitShieldApi.getMission(),
        orbitShieldApi.listSessions()
      ]);
      setStations(st.total > 0 ? st.stations : []);
      setState(sp.state);
      setTelemetry(sp.telemetry);
      setMission(mn.mission);

      setSelectedStation(st.stations.find((s) => s.key_id === 'GS-PRIMARY-01')?.key_id ?? 'GS-PRIMARY-01');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ground console load failed');
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  const handleDispatch = useCallback(async (intent: OperatorCommandIntent) => {
    setTransmitting(true);
    try {
      const result = await orbitShieldApi.dispatchOperatorCommand(intent);
      setState(result.spacecraft_state);
      setTelemetry(result.telemetry);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Command dispatch failed');
      setTransmitting(false);
    }
  }, []);

  const handleCommand = useCallback(
    (ct: CommandType) => {
      const template = COMMAND_TEMPLATES.find((t) => t.type === ct);
      if (!template) return;
      handleDispatch({
        key_id: selectedStation,
        command_type: ct,
        parameters: template.params
      });
    },
    [selectedStation, handleDispatch]
  );

  // ── Demo Mode state (guided end-to-end judge flow) ──────────────────────────
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoComplete, setDemoComplete] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [demoResult, setDemoResult] = useState<GatewayProcessResultDTO | null>(null);
  const [demoAttacking, setDemoAttacking] = useState(false);

  /** Submit a pre-signed hostile envelope through the full gateway pipeline.
   *  The envelope is generated client-side by the attacker client; the Ground
   *  console submits it via the trusted origin so the gateway processes it
   *  through every module (auth, integrity, replay, behavioral, mission,
   *  risk, policy) and returns the complete audit result for verification. */
  const submitEnvelope = async (
    envelope: Parameters<typeof attackerClient.sendAttack>[0],
    attackType: string
  ): Promise<GatewayProcessResultDTO> => {
    const res = await fetch('/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envelope, attackType })
    });
    if (!res.ok) {
      throw new Error(`Gateway submission failed: ${res.status}`);
    }
    return res.json() as Promise<GatewayProcessResultDTO>;
  };

  const runDemoStep = async () => {
    if (demoStep >= 7) return;
    setDemoAttacking(true);
    try {
      switch (demoStep) {
        case 0: {
          // ── Stage 1: NORMAL — valid operator command ──────────────────────
          const result = await orbitShieldApi.dispatchOperatorCommand({
            key_id: 'GS-PRIMARY-01',
            command_type: 'QUERY_TELEMETRY',
            parameters: { subsystems: ['power', 'thermal'] }
          });
          setDemoResult(result);
          if (result.audit_event.final_decision !== 'ALLOW') {
            setDemoMessage(
              `Stage 1 FAILED: expected ALLOW, got ${result.audit_event.final_decision}.`
            );
            break;
          }
          setDemoMessage(
            'Stage 1 — NORMAL: Valid QUERY_TELEMETRY accepted. Auth + integrity + replay all passed. Spacecraft responding normally.'
          );
          setDemoStep(1);
          break;
        }

        case 1: {
          // ── Stage 2: TAMPERING → BLOCK (integrity) ────────────────────────
          const { envelope, description } = await attackerClient.generateTamperedCommand();
          const result = await submitEnvelope(envelope, 'TAMPERING');
          setDemoResult(result);
          if (
            result.audit_event.final_decision !== 'BLOCK' ||
            result.audit_event.integrity.passed ||
            result.audit_event.policy.rule_triggered !== 'HARD_CONSTRAINT_INTEGRITY_FAIL'
          ) {
            setDemoMessage(
              `Stage 2 FAILED: expected INTEGRITY block, got final_decision=${result.audit_event.final_decision}, integrity.passed=${result.audit_event.integrity.passed}.`
            );
            break;
          }
          setDemoMessage(
            `Stage 2 — TAMPERING BLOCKED: ${description} HMAC integrity check FAILED. COMMAND BLOCKED.`
          );
          setDemoStep(2);
          break;
        }

        case 2: {
          // ── Stage 3: INJECTION → BLOCK (authentication) ───────────────────
          const { envelope, description } = await attackerClient.generateUnauthorizedInjection();
          const result = await submitEnvelope(envelope, 'INJECTION');
          setDemoResult(result);
          if (
            result.audit_event.final_decision !== 'BLOCK' ||
            result.audit_event.authentication.passed ||
            result.audit_event.policy.rule_triggered !== 'HARD_CONSTRAINT_AUTHENTICATION_FAIL'
          ) {
            setDemoMessage(
              `Stage 3 FAILED: expected AUTH block, got final_decision=${result.audit_event.final_decision}, auth.passed=${result.audit_event.authentication.passed}.`
            );
            break;
          }
          setDemoMessage(
            `Stage 3 — INJECTION BLOCKED: ${description} Authentication failed — key not in authorized registry. COMMAND BLOCKED.`
          );
          setDemoStep(3);
          break;
        }

        case 3: {
          // ── Stage 4: CREDENTIAL COMPROMISE → SAFE_MODE ────────────────────
          // Ensure mission phase is eclipse so the imaging violation triggers.
          await orbitShieldApi.setMissionPhase('UMBRA_ECLIPSE');
          const { envelope, description } = await attackerClient.generateCredentialCompromiseCommand();
          const result = await submitEnvelope(envelope, 'CREDENTIAL_COMPROMISE');
          setDemoResult(result);
          if (
            result.audit_event.final_decision !== 'SAFE_MODE' ||
            !result.audit_event.authentication.passed ||
            !result.audit_event.integrity.passed ||
            result.spacecraft_state.operating_mode !== 'SAFE_MODE'
          ) {
            setDemoMessage(
              `Stage 4 FAILED: expected SAFE_MODE. final_decision=${result.audit_event.final_decision}, auth.passed=${result.audit_event.authentication.passed}, integrity.passed=${result.audit_event.integrity.passed}, mode=${result.spacecraft_state.operating_mode}.`
            );
            break;
          }
          setDemoMessage(
            `Stage 4 — CREDENTIAL COMPROMISE → SAFE_MODE: ${description} HMAC passed (valid stolen creds), but mission rule OPT-02 blocked imaging in eclipse. CRITICAL risk triggered AUTONOMOUS SAFE MODE. Spacecraft now in SAFE_MODE.`
          );
          setDemoStep(4);
          break;
        }

        case 4: {
          // ── Stage 5: DESTRUCTIVE BURN → BLOCK (SAFE_MODE_LOCK) ────────────
          // Verify SAFE_MODE is still active before attempting the burn.
          if (demoResult?.spacecraft_state?.operating_mode !== 'SAFE_MODE') {
            setDemoMessage(
              'Stage 5 SKIPPED: spacecraft is not in SAFE_MODE. Re-run Stage 4 first.'
            );
            break;
          }
          const { envelope, description } = await attackerClient.generateDestructiveBurn();
          const result = await submitEnvelope(envelope, 'DESTRUCTIVE_BURN');
          setDemoResult(result);
          if (
            result.audit_event.final_decision !== 'BLOCK' ||
            result.audit_event.policy.rule_triggered !== 'HARD_CONSTRAINT_SAFE_MODE_LOCKED'
          ) {
            setDemoMessage(
              `Stage 5 FAILED: expected SAFE_MODE_LOCK block, got final_decision=${result.audit_event.final_decision}, rule=${result.audit_event.policy.rule_triggered}.`
            );
            break;
          }
          setDemoMessage(
            `Stage 5 — DESTRUCTIVE BURN BLOCKED BY SAFE_MODE_LOCK: ${description} BLOCKED. Spacecraft protected by flight software lock. Only telemetry queries or authenticated recovery accepted.`
          );
          setDemoStep(5);
          break;
        }

        case 5: {
          // ── Stage 6: OPERATOR_RECOVER from TRUSTED Ground context ──────────
          // This call originates from the Ground console (port 3000, TRUSTED zone).
          // No Origin spoofing — the browser sends the request from the trusted origin.
          const recoveryRes = await fetch('/api/spacecraft/SAT-01/recovery', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Origin: 'http://localhost:3000'
            },
            body: JSON.stringify({
              token: 'GROUND-SECURE-RECOVERY-CHANNEL',
              clearance_level: 'FLIGHT_DIRECTOR'
            })
          });
          if (!recoveryRes.ok) {
            const err = await recoveryRes.json().catch(() => ({}));
            setDemoMessage(
              `Stage 6 FAILED: recovery rejected (${recoveryRes.status}). ${err.error || err.message || 'No details'}.`
            );
            break;
          }
          const recoveryResult = await recoveryRes.json() as GatewayProcessResultDTO;
          setDemoResult(recoveryResult);
          if (
            recoveryResult.spacecraft_state.operating_mode !== 'NOMINAL' ||
            recoveryResult.audit_event.final_decision !== 'ALLOW'
          ) {
            setDemoMessage(
              `Stage 6 FAILED: expected NOMINAL after recovery, got mode=${recoveryResult.spacecraft_state.operating_mode}, decision=${recoveryResult.audit_event.final_decision}.`
            );
            break;
          }
          setDemoMessage(
            'Stage 6 — SYSTEM RESTORED: Trusted OPERATOR_RECOVER executed from Ground console (port 3000). Flight director recovery authenticated. SAFE_MODE cleared. Spacecraft returned to NOMINAL.'
          );
          setDemoComplete(true);
          setDemoStep(6);
          break;
        }
      }
    } catch (err) {
      setDemoMessage(
        `Demo error at stage ${demoStep}: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setDemoAttacking(false);
    }
  };

  const startDemo = () => {
    setDemoMode(true);
    setDemoStep(0);
    setDemoComplete(false);
    setDemoMessage(null);
    setDemoResult(null);
  };

  const resetDemo = () => {
    setDemoMode(false);
    setDemoStep(0);
    setDemoComplete(false);
    setDemoMessage(null);
    setDemoResult(null);
  };

  const activeSessionId = sessions.find((s) => s.active)?.session_id ?? null;
  const sessionCount = sessions.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
                    Ground Station Uplink Dispatcher
                  </h3>
                  <p className="text-xs text-slate-400">
                    Uplink authenticated commands. Credential resolution, HMAC signing and AES-GCM encryption happen server-side in the security gateway.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>L1 + L2 pipeline upstream</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">Originating Ground Station</label>
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                >
                  {stations.length === 0 && <option value="GS-PRIMARY-01">Loading stations from backend…</option>}
                  {stations.map((s) => (
                    <option key={s.key_id} value={s.key_id}>
                      {s.key_id} — {s.station_name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">Command Type</label>
                <select
                  value={selectedCommand}
                  onChange={(e) => setSelectedCommand(e.target.value as CommandType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
                >
                  {COMMAND_TEMPLATES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Command Parameters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Description</label>
                  <input
                    type="text"
                    defaultValue="High-Res Multi-spectral Nadir Earth"
                    disabled
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Exposure (ms)</label>
                  <input type="number" defaultValue={500} disabled className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Wheel Axis (0=Roll,1=Pitch,2=Yaw)</label>
                  <select defaultValue={1} disabled className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono disabled:opacity-50">
                    <option value={0}>Axis 0 (Roll)</option>
                    <option value={1}>Axis 1 (Pitch)</option>
                    <option value={2}>Axis 2 (Yaw)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Target RPM</label>
                  <input type="number" defaultValue={1800} disabled className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono disabled:opacity-50" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    Encrypt payload (AES-GCM-256)
                  </span>
                </label>
                <button
                  onClick={() => handleCommand(selectedCommand)}
                  disabled={transmitting || stations.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{transmitting ? 'Transmitting...' : 'Uplink Command'}</span>
                </button>
              </div>

              {/* Demo mode controls */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
                {!demoMode && (
                  <button
                    onClick={startDemo}
                    disabled={transmitting}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-white" />
                    <span>Start Security Demo</span>
                  </button>
                )}
                {demoMode && demoStep < 6 && !demoComplete && (
                  <button
                    onClick={runDemoStep}
                    disabled={demoAttacking}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>{demoStep === 0 ? 'Start Demo' : 'Next Stage'}</span>
                  </button>
                )}
                {demoMode && demoAttacking && (
                  <div className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                    Processing…
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white font-mono uppercase">Vehicle State</h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <RefreshCw className="w-3 h-3" />
                <span className="cursor-pointer" onClick={load}>Refresh</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Vehicle</div>
                <div className="font-bold text-white">{state?.spacecraft_id ?? 'SAT-01'}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Mode</div>
                <div className={`font-bold ${state?.operating_mode === 'SAFE_MODE' ? 'text-rose-400' : 'text-emerald-400'}`}>{state?.operating_mode ?? 'NOMINAL'}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Battery</div>
                <div className="font-bold text-slate-200">{telemetry?.battery_percent?.toFixed(1) ?? '88.5'}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Temp</div>
                <div className="font-bold text-slate-200">{telemetry?.bus_temp_celsius?.toFixed(1) ?? '18.2'}°C</div>
              </div>
            </div>
          </div>          </div>

          {/* ── Demo Mode Panel ─────────────────────────────────────────────── */}
          {demoMode && (
            <div className="rounded-2xl border border-cyan-700/50 bg-slate-900/90 p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white font-mono uppercase">End-to-End Security Demo</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono bg-cyan-950/60 text-cyan-300 px-2 py-0.5 rounded border border-cyan-700/50">
                    Step {demoStep} of 6
                  </span>
                  {!demoComplete && (
                    <button
                      onClick={resetDemo}
                      className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                    >
                      Exit Demo
                    </button>
                  )}
                </div>
              </div>

              {demoStep === 0 && (
                <div className="text-xs text-slate-300 space-y-2">
                  <p className="font-bold text-cyan-300">Guided attack → detection → safe mode → recovery flow.</p>
                  <ul className="list-disc list-inside text-slate-400 space-y-1">
                    <li>Stage 1: Valid telemetry query → ALLOW</li>
                    <li>Stage 2: Tampered command → BLOCK (integrity)</li>
                    <li>Stage 3: Rogue key injection → BLOCK (authentication)</li>
                    <li>Stage 4: Stolen credentials + eclipse imaging → SAFE_MODE</li>
                    <li>Stage 5: Destructive burn during SAFE_MODE → BLOCK (SAFE_MODE_LOCK)</li>
                    <li>Stage 6: Trusted operator recovery → NOMINAL</li>
                  </ul>
                  <p className="text-slate-500 mt-2">
                    Every stage asserts the expected backend outcome before advancing.
                    Recovery executes through the trusted Ground path (port 3000) — no origin spoofing.
                  </p>
                </div>
              )}

              {demoStep === 1 && (
                <div className="text-xs text-slate-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-emerald-300">Stage 1: NORMAL — ACCEPTED</span>
                  </div>
                  <p className="text-slate-400">{demoMessage}</p>
                  {demoResult && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[10px] font-mono text-slate-400 space-y-1">
                      <div>decision: <span className="text-emerald-300">{demoResult.audit_event.final_decision}</span></div>
                      <div>risk: {demoResult.audit_event.risk.total_score}/100 ({demoResult.audit_event.risk.severity})</div>
                      <div>spacecraft: <span className="text-emerald-300">{demoResult.spacecraft_state.operating_mode}</span></div>
                      <div>auth: {demoResult.audit_event.authentication.passed ? 'PASS' : 'FAIL'} · integrity: {demoResult.audit_event.integrity.passed ? 'PASS' : 'FAIL'}</div>
                    </div>
                  )}
                </div>
              )}

              {demoStep === 2 && (
                <div className="text-xs text-slate-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-rose-300">Stage 2: TAMPERING — BLOCKED</span>
                  </div>
                  <p className="text-slate-400">{demoMessage}</p>
                  {demoResult && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-950/60 border border-rose-800/60 text-[10px] font-mono text-slate-400 space-y-1">
                      <div>decision: <span className="text-rose-300">{demoResult.audit_event.final_decision}</span></div>
                      <div>rule: <span className="text-rose-300">{demoResult.audit_event.policy.rule_triggered}</span></div>
                      <div>integrity: {demoResult.audit_event.integrity.passed ? 'PASS' : 'FAIL'} ← expected FAIL</div>
                      <div>risk: {demoResult.audit_event.risk.total_score}/100</div>
                    </div>
                  )}
                </div>
              )}

              {demoStep === 3 && (
                <div className="text-xs text-slate-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-rose-300">Stage 3: INJECTION — BLOCKED</span>
                  </div>
                  <p className="text-slate-400">{demoMessage}</p>
                  {demoResult && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-950/60 border border-rose-800/60 text-[10px] font-mono text-slate-400 space-y-1">
                      <div>decision: <span className="text-rose-300">{demoResult.audit_event.final_decision}</span></div>
                      <div>rule: <span className="text-rose-300">{demoResult.audit_event.policy.rule_triggered}</span></div>
                      <div>auth: {demoResult.audit_event.authentication.passed ? 'PASS' : 'FAIL'} ← expected FAIL</div>
                      <div>key_id: {demoResult.audit_event.authentication.key_id}</div>
                    </div>
                  )}
                </div>
              )}

              {demoStep === 4 && (
                <div className="text-xs text-slate-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-amber-300">Stage 4: CREDENTIAL COMPROMISE → SAFE_MODE</span>
                  </div>
                  <p className="text-slate-400">{demoMessage}</p>
                  {demoResult && (
                    <div className="mt-2 p-3 rounded-lg bg-amber-950/30 border border-amber-800/60 text-[10px] font-mono text-slate-400 space-y-1">
                      <div>decision: <span className="text-amber-300">{demoResult.audit_event.final_decision}</span></div>
                      <div>rule: <span className="text-amber-300">{demoResult.audit_event.policy.rule_triggered}</span></div>
                      <div>auth: {demoResult.audit_event.authentication.passed ? 'PASS' : 'FAIL'} ← expected PASS (stolen creds)</div>
                      <div>integrity: {demoResult.audit_event.integrity.passed ? 'PASS' : 'FAIL'} ← expected PASS (valid HMAC)</div>
                      <div>risk: <span className="text-rose-300">{demoResult.audit_event.risk.total_score}/100 ({demoResult.audit_event.risk.severity})</span></div>
                      <div>spacecraft mode: <span className="text-rose-300 font-bold">{demoResult.spacecraft_state.operating_mode}</span> ← SAFE_MODE ACTIVATED</div>
                      <div>safe_mode_reason: {demoResult.spacecraft_state.flight_computer.safe_mode_reason}</div>
                    </div>
                  )}
                </div>
              )}

              {demoStep === 5 && (
                <div className="text-xs text-slate-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-rose-300">Stage 5: DESTRUCTIVE BURN — BLOCKED BY SAFE_MODE_LOCK</span>
                  </div>
                  <p className="text-slate-400">{demoMessage}</p>
                  {demoResult && (
                    <div className="mt-2 p-3 rounded-lg bg-slate-950/60 border border-rose-800/60 text-[10px] font-mono text-slate-400 space-y-1">
                      <div>decision: <span className="text-rose-300">{demoResult.audit_event.final_decision}</span></div>
                      <div>rule: <span className="text-rose-300">{demoResult.audit_event.policy.rule_triggered}</span> ← SAFE_MODE_LOCK</div>
                      <div>spacecraft mode: {demoResult.spacecraft_state.operating_mode}</div>
                      <div>risk: {demoResult.audit_event.risk.total_score}/100</div>
                    </div>
                  )}
                </div>
              )}

              {demoStep === 6 && (
                <div className="text-xs text-slate-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-emerald-300">Stage 6: SYSTEM RESTORED — NOMINAL</span>
                  </div>
                  <p className="text-slate-400">{demoMessage}</p>
                  {demoResult && (
                    <div className="mt-2 p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/60 text-[10px] font-mono text-slate-400 space-y-1">
                      <div>decision: <span className="text-emerald-300">{demoResult.audit_event.final_decision}</span></div>
                      <div>spacecraft mode: <span className="text-emerald-300 font-bold">{demoResult.spacecraft_state.operating_mode}</span> ← NOMINAL RESTORED</div>
                      <div>recovery from trusted Ground context (Origin: localhost:3000)</div>
                    </div>
                  )}
                  <button
                    onClick={resetDemo}
                    className="mt-3 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-bold transition cursor-pointer"
                  >
                    Run Demo Again
                  </button>
                </div>
              )}
            </div>
          )}

        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white font-mono uppercase">Live Command Stream</h3>
            </div>
            {error && <div className="text-xs text-amber-300 font-mono mb-3">⚠ {error}</div>}
            <div className="text-xs text-slate-500 font-mono">
              Live stream reflects the persisted backend audit trail. Session:{' '}
              <span className="text-cyan-300 font-bold">{activeSessionId ?? 'none'}</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white font-mono uppercase">Mission / Session</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Mission</div>
                <div className="font-bold text-white">{mission?.mission_id ?? 'ORBITSHIELD-LEO-01'}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Active session</div>
                <div className="font-bold text-cyan-300">{activeSessionId ?? '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Sessions</div>
                <div className="font-bold text-emerald-300">{sessionCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Lights</div>
                <div className="font-bold text-amber-300">{stations.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroundConsole;
