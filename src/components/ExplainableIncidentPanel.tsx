import React from 'react';
import {
  X,
  Shield,
  Key,
  Repeat,
  Brain,
  Compass,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Lock,
  Terminal
} from 'lucide-react';
import { AuditEvent, SecurityDecision, RiskSeverity } from '../models/audit';

interface ExplainableIncidentPanelProps {
  event: AuditEvent | null;
  onClose: () => void;
}

export const ExplainableIncidentPanel: React.FC<ExplainableIncidentPanelProps> = ({ event, onClose }) => {
  if (!event) return null;

  const getDecisionBadge = (decision: SecurityDecision) => {
    switch (decision) {
      case 'ALLOW':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
      case 'MONITOR':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      case 'BLOCK':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
      case 'SAFE_MODE':
        return 'bg-rose-600 text-white font-bold border-rose-400 animate-pulse';
    }
  };

  const getSeverityColor = (sev: RiskSeverity) => {
    switch (sev) {
      case 'CRITICAL': return 'text-rose-400';
      case 'HIGH': return 'text-orange-400';
      case 'SUSPICIOUS': return 'text-amber-400';
      default: return 'text-emerald-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Panel Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">
                  Forensic Security Event: {event.command_id}
                </h3>
                <span className={`px-2 py-0.5 rounded text-xs font-mono border ${getDecisionBadge(event.final_decision)}`}>
                  VERDICT: {event.final_decision}
                </span>
                {event.simulated_attack_type && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                    {event.simulated_attack_type}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Event ID: {event.event_id} • Time: {new Date(event.timestamp).toUTCString()}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel Body: Multi-tab or multi-section inspection */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Executive Summary Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
              Decision & Safety Policy Explanation
            </h4>
            <div className="text-sm text-slate-200 leading-relaxed font-sans">
              {event.policy.explanation}
            </div>
            {event.policy.rule_triggered && (
              <div className="mt-2 text-xs font-mono text-cyan-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Deterministic Enforcement Rule: <strong>{event.policy.rule_triggered}</strong></span>
              </div>
            )}
          </div>

          {/* 6-Layer Security Verification Pipeline */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
              Sequential Gateway Pipeline Verification
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Layer 1: Cryptographic Integrity */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    1. Cryptographic Integrity
                  </span>
                  {event.integrity.passed ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                      <CheckCircle className="w-3.5 h-3.5" /> PASSED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-rose-400 font-mono font-bold">
                      <XCircle className="w-3.5 h-3.5" /> FAILED
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono space-y-1 text-slate-400">
                  <div>Algorithm: <span className="text-slate-200">{event.integrity.algorithm}</span></div>
                  <div className="truncate">Received Sig: <span className="text-slate-300">{event.integrity.received_signature ? event.integrity.received_signature.substring(0, 24) + '...' : 'NONE'}</span></div>
                  {event.integrity.error && (
                    <div className="text-rose-400 font-sans mt-1 p-1.5 rounded bg-rose-950/50 border border-rose-900/60 text-xs">
                      {event.integrity.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Layer 2: Key Authentication */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    2. Authentication & Clearance
                  </span>
                  {event.authentication.passed ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                      <CheckCircle className="w-3.5 h-3.5" /> AUTHENTICATED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-rose-400 font-mono font-bold">
                      <XCircle className="w-3.5 h-3.5" /> UNRECOGNIZED
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono space-y-1 text-slate-400">
                  <div>Key ID: <span className="text-cyan-300 font-bold">{event.authentication.key_id}</span></div>
                  <div>Station: <span className="text-slate-200">{event.authentication.authorized_identity || 'Unauthorized'}</span></div>
                  {event.authentication.role && (
                    <div>Role: <span className="text-indigo-300">{event.authentication.role}</span></div>
                  )}
                  {event.authentication.error && (
                    <div className="text-rose-400 font-sans mt-1 p-1.5 rounded bg-rose-950/50 border border-rose-900/60 text-xs">
                      {event.authentication.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Layer 3: Replay Protection */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-teal-400" />
                    3. Replay & Sequence Guard
                  </span>
                  {event.replay.passed ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                      <CheckCircle className="w-3.5 h-3.5" /> FRESH
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-rose-400 font-mono font-bold">
                      <XCircle className="w-3.5 h-3.5" /> REPLAY DETECTED
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono space-y-1 text-slate-400">
                  <div>Nonce Unique: <span className={event.replay.nonce_is_fresh ? 'text-emerald-400' : 'text-rose-400'}>{event.replay.nonce_is_fresh ? 'Yes' : 'DUPLICATE'}</span></div>
                  <div>Sequence: <span className={event.replay.sequence_valid ? 'text-emerald-400' : 'text-rose-400'}>{event.replay.received_sequence} (monotonic)</span></div>
                  <div>Timestamp Skew: <span className="text-slate-200">{event.replay.clock_skew_seconds}s</span></div>
                  {event.replay.error && (
                    <div className="text-rose-400 font-sans mt-1 p-1.5 rounded bg-rose-950/50 border border-rose-900/60 text-xs">
                      {event.replay.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Layer 4: Behavioral Analysis */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-amber-400" />
                    4. Behavioral Sequence AI
                  </span>
                  {event.behavioral.is_anomalous ? (
                    <span className="flex items-center gap-1 text-xs text-amber-400 font-mono font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" /> ANOMALY
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                      <CheckCircle className="w-3.5 h-3.5" /> NOMINAL
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono space-y-1 text-slate-400">
                  <div className="flex justify-between">
                    <span>Anomaly Score:</span>
                    <span className="text-amber-300 font-bold">{event.behavioral.anomaly_score} / 100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Model Confidence:</span>
                    <span className="text-slate-200">{(event.behavioral.confidence * 100).toFixed(0)}%</span>
                  </div>
                  {event.behavioral.findings.map((f, i) => (
                    <div key={i} className="text-slate-300 font-sans text-xs bg-slate-900/70 p-1.5 rounded border border-slate-800 mt-1">
                      • {f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Layer 5: Mission Context */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-fuchsia-400" />
                    5. Mission Context & Rules
                  </span>
                  {event.mission_context.is_compliant ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                      <CheckCircle className="w-3.5 h-3.5" /> COMPLIANT
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-rose-400 font-mono font-bold">
                      <XCircle className="w-3.5 h-3.5" /> CONFLICT
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono space-y-1 text-slate-400">
                  <div>Active Phase: <span className="text-cyan-300">{event.mission_context.current_phase}</span></div>
                  {event.mission_context.conflicting_rules.length > 0 ? (
                    event.mission_context.conflicting_rules.map((rule, idx) => (
                      <div key={idx} className="text-rose-300 font-mono text-[10px] bg-rose-950/40 p-1.5 rounded border border-rose-900">
                        {rule}
                      </div>
                    ))
                  ) : (
                    <div className="text-emerald-400/80 font-sans text-xs">
                      Permitted under current flight timeline & solar power budget.
                    </div>
                  )}
                </div>
              </div>

              {/* Layer 6: Contextual Risk Engine */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-rose-400" />
                    6. Contextual Risk Engine
                  </span>
                  <span className={`text-xs font-mono font-extrabold ${getSeverityColor(event.risk.severity)}`}>
                    {event.risk.total_score} / 100 ({event.risk.severity})
                  </span>
                </div>
                <div className="text-[11px] font-mono space-y-1 text-slate-400">
                  <div className="flex justify-between">
                    <span>Crypto Penalty:</span>
                    <span className={event.risk.breakdown.cryptographic_penalty > 0 ? 'text-rose-400' : 'text-slate-300'}>
                      +{event.risk.breakdown.cryptographic_penalty}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Behavioral Penalty:</span>
                    <span className={event.risk.breakdown.behavioral_penalty > 0 ? 'text-amber-400' : 'text-slate-300'}>
                      +{event.risk.breakdown.behavioral_penalty}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mission Conflict Penalty:</span>
                    <span className={event.risk.breakdown.mission_conflict_penalty > 0 ? 'text-orange-400' : 'text-slate-300'}>
                      +{event.risk.breakdown.mission_conflict_penalty}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Inherent Criticality:</span>
                    <span className="text-slate-300">+{event.risk.breakdown.command_inherent_criticality}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Raw Command Envelope Inspection */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-200">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                Raw Command Envelope JSON
              </span>
              <span>RFC-compliant Structured Schema</span>
            </div>
            <pre className="text-[11px] font-mono text-cyan-200/90 bg-slate-900/90 p-3 rounded-lg overflow-x-auto max-h-48">
              {JSON.stringify(event.envelope, null, 2)}
            </pre>
          </div>
        </div>

        {/* Panel Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            Close Incident Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
