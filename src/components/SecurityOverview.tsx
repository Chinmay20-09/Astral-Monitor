import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Lock, Activity, Eye, Zap, RefreshCw, AlertOctagon } from 'lucide-react';
import { AuditEvent, RiskSeverity } from '../models/audit';

interface SecurityOverviewProps {
  auditLog: AuditEvent[];
  onResetGateway: () => void;
}

export const SecurityOverview: React.FC<SecurityOverviewProps> = ({ auditLog, onResetGateway }) => {
  const total = auditLog.length;
  const allowed = auditLog.filter(e => e.final_decision === 'ALLOW').length;
  const monitored = auditLog.filter(e => e.final_decision === 'MONITOR').length;
  const blocked = auditLog.filter(e => e.final_decision === 'BLOCK').length;
  const safeModeCount = auditLog.filter(e => e.final_decision === 'SAFE_MODE').length;

  const latestEvent = auditLog[0];
  const currentRiskScore = latestEvent ? latestEvent.risk.total_score : 12;
  const currentSeverity: RiskSeverity = latestEvent ? latestEvent.risk.severity : 'NORMAL';

  const getSeverityBadge = (sev: RiskSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      case 'SUSPICIOUS':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
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
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Security Control Plane
              <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                ST-02 Enforcement Point
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Deterministic verification, behavioral anomaly detection, and autonomous vehicle protection
            </p>
          </div>
        </div>

        <button
          onClick={onResetGateway}
          className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
          title="Reset gateway cache and logs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Session</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        {/* Threat Posture Meter */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-mono uppercase">Threat Posture</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-mono border font-bold ${getSeverityBadge(currentSeverity)}`}>
              {currentSeverity}
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className={`text-3xl font-extrabold font-mono ${getSeverityColor(currentSeverity)}`}>
              {currentRiskScore}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ 100 Risk</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full transition-all duration-500 ${
                currentRiskScore >= 75
                  ? 'bg-rose-500'
                  : currentRiskScore >= 50
                  ? 'bg-orange-500'
                  : currentRiskScore >= 25
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.max(5, currentRiskScore)}%` }}
            />
          </div>
        </div>

        {/* Total Processed & Allowed */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase">Traffic Cleared</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {allowed + monitored} <span className="text-xs font-normal text-slate-500 font-sans">/ {total} Total</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Nominal execution rate: {total > 0 ? (((allowed + monitored) / total) * 100).toFixed(0) : 100}%
            </p>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {monitored} with elevated monitor telemetry
          </div>
        </div>

        {/* Blocked Threats */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase">Threats Blocked</span>
            <ShieldAlert className="w-4 h-4 text-orange-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-orange-400">
              {blocked}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Cryptographic, replay & high-risk rejections
            </p>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Deterministic hard boundaries intact
          </div>
        </div>

        {/* Safe Mode Triggers */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase">Safe Mode Triggers</span>
            <AlertOctagon className="w-4 h-4 text-rose-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-rose-400">
              {safeModeCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Autonomous vehicle protection events
            </p>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Telemetry carrier maintained 100%
          </div>
        </div>
      </div>

      {/* Gateway Layer Badges */}
      <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/80">
        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-2">
          Active Defense Pipelines (TRD Sec 4)
        </span>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <Lock className="w-3 h-3 text-cyan-400" />
            <strong className="text-white">L1 Integrity:</strong> HMAC-SHA256 Integrity/Authentication Tag
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <Shield className="w-3 h-3 text-indigo-400" />
            <strong className="text-white">L2 Auth:</strong> Key ID & Clearance Registry
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <Activity className="w-3 h-3 text-teal-400" />
            <strong className="text-white">L3 Replay:</strong> Nonce + Monotonic Sequence + 60s Skew
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <Eye className="w-3 h-3 text-amber-400" />
            <strong className="text-white">L4 Behavioral:</strong> Sequence Anomaly & Burst Filter
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <Zap className="w-3 h-3 text-fuchsia-400" />
            <strong className="text-white">L5 Context:</strong> Eclipse & Flight Rule Compliance
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            <strong className="text-white">L6 Safety:</strong> Deterministic Policy Override
          </span>
        </div>
      </div>
    </div>
  );
};
