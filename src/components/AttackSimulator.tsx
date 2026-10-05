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
  ShieldCheck
} from 'lucide-react';
import { AttackScenario, ATTACK_SCENARIOS } from '../models/attacks';

interface AttackResultDTO {
  scenario: string;
  description: string;
  audit_event: {
    final_decision: string;
    risk: { total_score: number; severity: string };
    policy: { explanation: string; rule_triggered?: string };
    replay: { passed: boolean };
    envelope: { security: { ciphertext?: string; iv?: string; signature: string; algorithm: string; key_id: string } };
    behavioral: { is_anomalous: boolean };
  };
  executed: boolean;
  execution_message?: string;
  spacecraft_state: {
    operating_mode: string;
    communication_status: string;
    power: { battery_percent: number };
  };
}

interface AttackSimulatorProps {
  onAttackResult?: (scenario: string, result: AttackResultDTO) => void;
}

const ATTACK_SCENARIO_IDS = [
  'TAMPERING',
  'INJECTION',
  'REPLAY',
  'CREDENTIAL_COMPROMISE',
  'DESTRUCTIVE_BURN',
  'EAVESDROP'
] as const;

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
  const [brief, setBrief] = useState<string | null>(null);
  const [details, setDetails] = useState<AttackResultDTO | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    if (onAttackResult) {
      const handler = (_scenario: string, result: AttackResultDTO) => {
        setResults((prev) => [...prev, result]);
        onAttackResult(_scenario, result);
      };
      return () => {
        // noop — intra-app wiring is handled by parent
      };
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
      const data = (await res.json()) as AttackResultDTO;
      setResults((prev) => [...prev, data]);
      setBrief(data.audit_event.policy.explanation);
      setDetails(data);
      onAttackResult?.('NORMAL', data);
    } finally {
      setIsSimulating(false);
    }
  };

  const runAttack = async (scenario: string) => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/attacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      const data = (await res.json()) as AttackResultDTO;
      setResults((prev) => [...prev, data]);
      setBrief(data.audit_event.policy.explanation);
      setDetails(data);
      onAttackResult?.(scenario, data);
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
              Stage 1: Normal telemetry → Stage 2: In-transit tampering (integrity block) → Stage 3: Rogue key / unauthorized injection (auth block) → Stage 4: Stolen credential in eclipse imaging (mission conflict) → Stage 5: Destructive burn (autonomous safe mode). All hostile envelopes are manufactured server-side; the browser sends scenario intents only.
            </p>

            <div className="pt-2">
              <div className="flex items-center justify-center gap-2 text-[11px] font-mono">
                {['1', '2'].map((s) => (
                  <div key={s} className="h-2.5 rounded-full bg-emerald-500/60" />
                ))}
                <div className="flex -space-x-1">
                  {['1', '2'].map((s) => (
                    <div key={s} className="w-2.5 h-2.5 rounded-full border-2 bg-purple-500 border-purple-300" />
                  ))}
                </div>

              </div>
            </div>
          </div>

          <button
            onClick={runNormal}
            disabled={isSimulating}
            className="w-full lg:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono font-bold text-sm shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Run 2-Stage Demo</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ATTACK_SCENARIOS.map((scenario) => {
          const Icon = SCENARIO_ICONS[scenario.id];
          const isDownload = scenario.id === 'EAVESDROP';
          return (
            <div
              key={scenario.id}
              className={`rounded-2xl border bg-slate-900/70 p-4 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl ${SCENARIO_COLORS[scenario.id]} ${SCENARIO_HIGHLIGHTS[scenario.id]}`}
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
                onClick={() => runAttack(scenario.id)}
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
            <span className="text-[10px] text-slate-500 font-mono">{results.length} requests</span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {results.length === 0 ? (
            <div className="h-32 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500 font-mono">
              No attacks launched yet. Select a scenario above.
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/70"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`px-2.5 py-1 rounded text-[10px] font-mono border ${
                    r.audit_event.final_decision === 'ALLOW'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                      : r.audit_event.final_decision === 'SAFE_MODE'
                      ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                      : 'bg-amber-950/60 text-amber-300 border-amber-800'
                  }`}>
                    {r.audit_event.final_decision}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-white">{r.scenario}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{r.description}</div>
                  </div>
                </div>
                <div className="text-right text-[10px] font-mono text-slate-400 sm:text-center">
                  risk {r.audit_event.risk.total_score}/100 · {r.audit_event.risk.severity}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AttackSimulator;
