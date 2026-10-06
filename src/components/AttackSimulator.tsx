import React, { useEffect, useState } from 'react';
import {
  Skull,
  ShieldAlert,
  Play,
  CheckCircle,
  FileCode,
  Repeat,
  Key,
  Flame,
  Radio,
  Eye,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  XCircle,
  Lock
} from 'lucide-react';
import { AttackScenario, ATTACK_SCENARIOS, scenarioKey } from '../models/attacks';
import { attackerClient } from '../attacker/attackerClient';
import { AuditEvent } from '../models/audit';
import { SpacecraftState, EssentialTelemetry } from '../models/spacecraft';

interface AttackResultDTO {
  scenario: string;
  description: string;
  audit_event: AuditEvent;
  executed: boolean;
  execution_message?: string;
  spacecraft_state: SpacecraftState;
  telemetry?: EssentialTelemetry;
}

interface AttackerBlockResult {
  success: boolean;
  status: number;
  blocked: boolean;
  perimeterBlocked: boolean;
  gatewayProcessed: boolean;
  error?: string;
  result?: unknown;
  description: string;
  scenario: string;
}

interface SecurityEventDTO {
  id: string;
  timestamp: string;
  type: string;
  severity: string;
  source: string;
  target: string;
  decision: string;
  riskScore: number;
  message: string;
}

interface AttackSimulatorProps {
  onAttackResult?: (scenario: string, result: AttackResultDTO | AttackerBlockResult) => void;
}

const ATTACK_SCENARIO_IDS = [
  'TAMPERING',
  'INJECTION',
  'REPLAY',
  'CREDENTIAL_COMPROMISE',
  'DESTRUCTIVE_BURN',
  'EAVESDROP'
] as const;

const SCENARIO_MAP: Record<string, (() => Promise<{ envelope: any; description: string }>)> = {
  TAMPERING: () => attackerClient.generateTamperedCommand(),
  INJECTION: () => attackerClient.generateUnauthorizedInjection(),
  REPLAY: () => attackerClient.generateReplayCommand(),
  CREDENTIAL_COMPROMISE: () => attackerClient.generateCredentialCompromiseCommand(),
  DESTRUCTIVE_BURN: () => attackerClient.generateDestructiveBurn()
};

const FALLBACK_SCENARIO_BORDER = 'border-slate-700/60 hover:border-slate-600/70';

const SCENARIO_ICONS: Record<string, typeof Skull> = {
  TAMPERING: FileCode,
  INJECTION: Key,
  REPLAY: Repeat,
  CREDENTIAL_COMPROMISE: ShieldAlert,
  DESTRUCTIVE_BURN: Flame,
  EAVESDROP: Eye
};

const SCENARIO_COLORS: Record<string, string> = {
  TAMPERING: 'border-rose-700/60 hover:border-rose-600/70',
  INJECTION: 'border-orange-700/60 hover:border-orange-600/70',
  REPLAY: 'border-teal-700/60 hover:border-teal-600/70',
  CREDENTIAL_COMPROMISE: 'border-purple-700/60 hover:border-purple-600/70',
  DESTRUCTIVE_BURN: 'border-rose-600/60 hover:border-rose-500/70',
  EAVESDROP: 'border-cyan-700/60 hover:border-cyan-600/70'
};

const SCENARIO_HIGHLIGHTS: Record<string, string> = {
  TAMPERING: 'from-rose-950/80',
  INJECTION: 'from-orange-950/80',
  REPLAY: 'from-teal-950/80',
  CREDENTIAL_COMPROMISE: 'from-purple-950/80',
  DESTRUCTIVE_BURN: 'from-rose-900/80',
  EAVESDROP: 'from-cyan-950/80'
};

export const AttackSimulator: React.FC<AttackSimulatorProps> = ({ onAttackResult }) => {
  const [results, setResults] = useState<AttackResultDTO[]>([]);
  const [blocks, setBlocks] = useState<AttackerBlockResult[]>([]);
  const [brief, setBrief] = useState<string | null>(null);
  const [details, setDetails] = useState<AttackResultDTO | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    if (onAttackResult) {
      const handler = (_scenario: string, result: AttackResultDTO | AttackerBlockResult) => {
        if ('audit_event' in result) {
          setResults((prev) => [...prev, result as AttackResultDTO]);
        } else {
          setBlocks((prev) => [...prev, result as AttackerBlockResult]);
        }
        onAttackResult(_scenario, result);
      };
      return () => {};
    }
  }, [onAttackResult]);

  const runNormal = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/commands/operator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_id: 'GS-PRIMARY-01',
          command_type: 'QUERY_TELEMETRY',
          parameters: { subsystems: ['power', 'thermal'] }
        })
      });
      if (res.ok) {
        const data = (await res.json()) as AttackResultDTO;
        setResults((prev) => [...prev, data]);
        setBrief(data.audit_event.policy.explanation);
        setDetails(data);
        onAttackResult?.('NORMAL', data);
      } else {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setBrief(`Normal command failed: ${err.error || res.statusText}`);
      }
    } finally {
      setIsSimulating(false);
    }
  };

  /**
   * Launch attack from attacker's independent client.
   * The attacker generates the envelope client-side and sends it directly
   * to the backend's /api/commands endpoint.
   * The backend security middleware detects untrusted origin and blocks it.
   */
  const runAttack = async (scenario: string) => {
    setIsSimulating(true);
    try {
      // 1. Generate envelope client-side (attacker's independent capability)
      const generator = SCENARIO_MAP[scenario];
      if (!generator) {
        // Passive scenarios have no command envelope to transmit — say so
        // instead of reporting an unknown scenario.
        setBrief(
          `${scenario} is passive: the channel is only observed, so no command envelope is sent. Launch TAMPERING or INJECTION first and watch the gateway record the intercepted ciphertext.`
        );
        return;
      }

      const { envelope, description } = await generator();

      // 2. Send directly to backend (attacker's independent action)
      // The attacker posts to /api/commands which is allowed through the perimeter
      // for security demo purposes. The gateway then processes the envelope through
      // the full pipeline (auth → integrity → replay → behavioral → mission → risk → policy).
      const blockResult = await attackerClient.sendAttack(envelope);

      // 3. Record the result
      if (blockResult.gatewayProcessed) {
        // Gateway processed the envelope and returned a full audit result
        // This means the command went through the FULL pipeline and was decided by the gateway
        const result = blockResult.result as AttackResultDTO;
        setResults((prev) => [...prev, result]);
        setDetails(result);
        setBrief(result.description || description);
        onAttackResult?.(scenario, result);
      } else {
        // Perimeter block or network error — the gateway never saw the envelope
        const attackerBlock: AttackerBlockResult = {
          success: blockResult.success,
          status: blockResult.status,
          blocked: blockResult.blocked,
          perimeterBlocked: blockResult.perimeterBlocked,
          gatewayProcessed: blockResult.gatewayProcessed,
          error: blockResult.error,
          result: blockResult.result,
          description,
          scenario
        };
        setBlocks((prev) => [...prev, attackerBlock]);
        setBrief(description);
        onAttackResult?.(scenario, attackerBlock);
      }
    } finally {
      setIsSimulating(false);
    }
  };



  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 via-slate-900 to-indigo-950/40 p-5 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                PRIMARY HACKATHON DEMONSTRATION
              </span>
              <span className="text-[10px] text-slate-500 font-mono">PRD Section 5 / DECISIONS D17</span>
            </div>
            <h3 className="text-xl font-bold text-white font-mono">
              Multi-Stage Cyber Attack & Safe-Command Escalation
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Stage 1: Normal telemetry → Stage 2: In-transit tampering (integrity block) → Stage 3: Rogue key / unauthorized injection (auth block) → Stage 4: Stolen credential in eclipse imaging (mission conflict) → Stage 5: Destructive burn (autonomous safe mode). Attacker generates envelopes client-side on port 3500; backend security middleware blocks untrusted origins.
            </p>            <div className="pt-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={runNormal}
                  disabled={isSimulating}
                  className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono font-bold text-sm shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Run Normal (trusted path)</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-mono">
                Normal commands use the trusted operator path (/api/commands/operator). 
                Attacks use the direct path (/api/commands) from the untrusted attacker zone.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ATTACK_SCENARIOS.map((scenario) => {
          const key = scenarioKey(scenario.id);
          // Never render an undefined component: an unmapped scenario falls back
          // to a real icon/border instead of crashing React.
          const Icon = SCENARIO_ICONS[key] ?? ShieldAlert;
          const isDownload = key === 'EAVESDROP';
          return (
            <div
              key={scenario.id}
              className={`rounded-2xl border bg-slate-900/70 p-4 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl ${SCENARIO_COLORS[key] ?? FALLBACK_SCENARIO_BORDER} ${SCENARIO_HIGHLIGHTS[key] ?? ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${isDownload ? 'bg-cyan-950/40' : 'bg-slate-950/50'} border border-slate-800/80 text-slate-400`}>
                    {isDownload ? <Eye className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono">{scenario.name}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{scenario.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  {scenario.expectedGatewayOutcome === 'BLOCK' && <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />}
                  {scenario.expectedGatewayOutcome === 'SAFE_MODE' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                  {scenario.expectedGatewayOutcome === 'PASSIVE' && <Radio className="w-3.5 h-3.5 text-cyan-400" />}
                  <span className="text-[10px] text-slate-500 font-mono">{scenario.expectedGatewayOutcome}</span>
                </div>
              </div>

              <button
                onClick={() => runAttack(key)}
                disabled={isSimulating}
                className={`mt-3 w-full py-2.5 rounded-xl text-xs font-mono font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
                  isDownload
                    ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white hover:from-cyan-500 hover:to-cyan-400'
                    : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700/90'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>{isDownload ? 'Simulate Downlink Sniff' : 'Launch Attack'}</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Skull className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-mono font-bold text-white">Attack Run Log</span>
            <span className="text-[10px] text-slate-500 font-mono">{results.length + blocks.length} attacks</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800">
              ATTACKER :3500 UNTRUSTED
            </span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {(results.length === 0 && blocks.length === 0) ? (
            <div className="h-32 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500 font-mono">
              No attacks launched yet. Select a scenario above.
            </div>
          ) : (
            <>
              {blocks.map((block, i) => (
                <div
                  key={`block-${i}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-rose-950/30 border border-rose-800/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-rose-900/60 border border-rose-700/50">
                      <XCircle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-rose-300 font-bold">{block.scenario} — BLOCKED</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{block.description}</div>
                      {block.perimeterBlocked && (
                        <div className="text-[10px] text-rose-400 font-mono mt-1">
                          ⟶ Perimeter block: request rejected at security edge (403)
                        </div>
                      )}
                      {block.gatewayProcessed && block.error && (
                        <div className="text-[10px] text-amber-400 font-mono mt-1">
                          ⟶ Gateway block: {block.error}
                        </div>
                      )}
                      {!block.perimeterBlocked && !block.gatewayProcessed && block.error && (
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          {block.error}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-[10px] font-mono text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/50">
                      HTTP {block.status} {block.blocked ? 'BLOCKED' : 'DENIED'}
                    </span>
                    {block.gatewayProcessed && (
                      <div className="mt-1 text-emerald-400 font-bold">↳ GATEWAY PROCESSED</div>
                    )}
                    {block.perimeterBlocked && (
                      <div className="mt-1 text-rose-400 font-bold">↳ PERIMETER BLOCK</div>
                    )}
                  </div>
                </div>
              ))}
              {results.map((r, i) => (
                <div
                  key={`result-${i}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/70"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`px-2.5 py-1 rounded text-[10px] font-mono border ${
                      r.audit_event.final_decision === 'ALLOW'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        : r.audit_event.final_decision === 'SAFE_MODE'
                        ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                        : r.audit_event.final_decision === 'BLOCK'
                        ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                        : 'bg-amber-950/60 text-amber-300 border-amber-800'
                    }`}>
                      {r.audit_event.final_decision}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-white">{r.scenario}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{r.description}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        auth: {r.audit_event.authentication.passed ? 'PASS' : 'FAIL'} · 
                        integrity: {r.audit_event.integrity.passed ? 'PASS' : 'FAIL'} · 
                        replay: {r.audit_event.replay.passed ? 'PASS' : 'FAIL'}
                      </div>
                      {r.audit_event.policy.rule_triggered && (
                        <div className="text-[10px] text-cyan-400 font-mono mt-0.5">
                          rule: {r.audit_event.policy.rule_triggered}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-[10px] font-mono text-slate-400 sm:text-center">
                    <div className="font-bold">risk {r.audit_event.risk.total_score}/100</div>
                    <div>{r.audit_event.risk.severity}</div>
                    {r.audit_event.final_decision === 'BLOCK' && (
                      <div className="text-rose-400 font-bold mt-1">↳ GATEWAY BLOCKED</div>
                    )}
                    {r.audit_event.final_decision === 'SAFE_MODE' && (
                      <div className="text-amber-400 font-bold mt-1">↳ SAFE MODE TRIGGERED</div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttackSimulator;
