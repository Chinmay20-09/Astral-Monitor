import React, { useState } from 'react';
import { Terminal, Search, CheckCircle, XCircle, AlertTriangle, ShieldAlert, ArrowRight } from 'lucide-react';
import { AuditEvent, SecurityDecision } from '../models/audit';

interface LiveCommandStreamProps {
  auditLog: AuditEvent[];
  onSelectEvent: (event: AuditEvent) => void;
}

export const LiveCommandStream: React.FC<LiveCommandStreamProps> = ({ auditLog, onSelectEvent }) => {
  const [filter, setFilter] = useState<'ALL' | 'ALLOW' | 'BLOCK' | 'SAFE_MODE' | 'ATTACKS'>('ALL');
  const [search, setSearch] = useState('');

  const filteredLog = auditLog.filter(event => {
    // Verdict / category filter
    if (filter === 'ALLOW' && event.final_decision !== 'ALLOW') return false;
    if (filter === 'BLOCK' && event.final_decision !== 'BLOCK') return false;
    if (filter === 'SAFE_MODE' && event.final_decision !== 'SAFE_MODE') return false;
    if (filter === 'ATTACKS' && !event.simulated_attack_type) return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchCmd = event.command_id.toLowerCase().includes(q);
      const matchType = event.envelope.payload.command_type.toLowerCase().includes(q);
      const matchSender = event.sender_identity.toLowerCase().includes(q);
      const matchKey = event.envelope.security.key_id?.toLowerCase().includes(q);
      return matchCmd || matchType || matchSender || matchKey;
    }

    return true;
  });

  const getDecisionBadge = (decision: SecurityDecision) => {
    switch (decision) {
      case 'ALLOW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" /> ALLOW
          </span>
        );
      case 'MONITOR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> MONITOR
          </span>
        );
      case 'BLOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" /> BLOCK
          </span>
        );
      case 'SAFE_MODE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-600 text-white border border-rose-400 animate-pulse">
            <ShieldAlert className="w-3 h-3" /> SAFE MODE
          </span>
        );
    }
  };

  const getRiskPill = (score: number) => {
    let color = 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
    if (score >= 75) color = 'text-rose-400 bg-rose-950/60 border-rose-800';
    else if (score >= 50) color = 'text-orange-400 bg-orange-950/60 border-orange-800';
    else if (score >= 25) color = 'text-amber-400 bg-amber-950/60 border-amber-800';

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${color}`}>
        {score} / 100
      </span>
    );
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* Header with Search and Filter Tabs */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
            Live Command Stream & Verification Log
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            {filteredLog.length} {filter !== 'ALL' ? filter : 'Total'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search command..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
            {(['ALL', 'ALLOW', 'BLOCK', 'SAFE_MODE', 'ATTACKS'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer text-[11px] ${
                  filter === tab
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table / List */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-[11px] uppercase">
              <th className="py-2.5 px-4 font-medium">Time (UTC)</th>
              <th className="py-2.5 px-3 font-medium">Command ID</th>
              <th className="py-2.5 px-3 font-medium">Type</th>
              <th className="py-2.5 px-3 font-medium">Sender Identity</th>
              <th className="py-2.5 px-3 font-medium">Verdict</th>
              <th className="py-2.5 px-3 font-medium">Risk Score</th>
              <th className="py-2.5 px-3 font-medium text-right">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLog.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 font-sans text-xs">
                  No command events matching criteria. Send commands from the Ground Station Terminal or run Attack Simulator.
                </td>
              </tr>
            ) : (
              filteredLog.map(event => (
                <tr
                  key={event.event_id}
                  onClick={() => onSelectEvent(event)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-200 whitespace-nowrap">
                    {event.command_id}
                  </td>
                  <td className="py-2.5 px-3 text-cyan-300 whitespace-nowrap">
                    {event.envelope.payload.command_type}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap truncate max-w-[140px]" title={event.sender_identity}>
                    {event.sender_identity}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {getDecisionBadge(event.final_decision)}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {getRiskPill(event.risk.total_score)}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onSelectEvent(event);
                      }}
                      className="px-2 py-1 rounded bg-slate-800 group-hover:bg-cyan-950 text-slate-300 group-hover:text-cyan-300 text-[11px] border border-slate-700 group-hover:border-cyan-800 transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
