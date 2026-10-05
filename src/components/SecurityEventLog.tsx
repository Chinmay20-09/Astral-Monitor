import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Clock, User, Target, ShieldCheck, XCircle, RefreshCw } from 'lucide-react';

interface SecurityEvent {
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

const severityStyles = {
  NORMAL: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  SUSPICIOUS: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  HIGH: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  CRITICAL: 'bg-rose-500/15 text-rose-300 border-rose-500/40'
};

const decisionStyles = {
  ALLOW: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
  BLOCK: 'bg-rose-950/60 text-rose-300 border-rose-800',
  SAFE_MODE: 'bg-rose-900/60 text-rose-200 border-rose-700',
  MONITOR: 'bg-amber-950/60 text-amber-300 border-amber-800'
};

function EventItem({ event }: { event: SecurityEvent }) {
  return (
    <div className={`p-3 rounded-xl border ${
      event.severity === 'CRITICAL' || event.severity === 'HIGH'
        ? 'bg-rose-950/20 border-rose-800/30'
        : event.severity === 'SUSPICIOUS'
        ? 'bg-amber-950/20 border-amber-800/30'
        : 'bg-slate-950/40 border-slate-800/70'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`px-2 py-0.5 rounded text-[10px] font-mono border ${severityStyles[event.severity as keyof typeof severityStyles] || severityStyles.NORMAL}`}>
            {event.severity}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-mono text-white truncate">{event.type}</div>
            <div className="text-[10px] text-slate-400 font-mono truncate">{event.message}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${decisionStyles[event.decision as keyof typeof decisionStyles] || decisionStyles.ALLOW}`}>
            {event.decision}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500 font-mono">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {event.source}
        </span>
        <span className="flex items-center gap-1">
          <Target className="w-3 h-3" />
          {event.target}
        </span>
        <span className="text-slate-600">
          risk {event.riskScore}/100
        </span>
      </div>
    </div>
  );
}

export const SecurityEventLog: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/security/events?limit=20');
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch {
        // Backend offline
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, []);

  const totalEvents = events.length;
  const blockedEvents = events.filter(e => e.decision === 'BLOCK').length;
  const criticalEvents = events.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH').length;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/50 text-rose-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-mono">Security Event Log</h2>
            <p className="text-xs text-slate-400">Real-time security telemetry</p>
          </div>
        </div>
        <button
          onClick={() => setEvents(prev => [])}
          className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Clear
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Total Events</div>
          <div className="text-xl font-bold font-mono text-white">{totalEvents}</div>
        </div>
        <div className="bg-rose-950/30 border border-rose-800/50 rounded-xl p-3">
          <div className="text-[10px] text-rose-400 uppercase font-mono mb-1 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Blocked
          </div>
          <div className="text-xl font-bold font-mono text-rose-300">{blockedEvents}</div>
        </div>
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3">
          <div className="text-[10px] text-amber-400 uppercase font-mono mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Critical
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">{criticalEvents}</div>
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-center text-xs text-slate-500 py-8">
            Loading security events...
          </div>
        ) : events.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-8">
            <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div>No security events yet</div>
            <div className="text-[10px] text-slate-600 mt-1">Events will appear when attacks are simulated</div>
          </div>
        ) : (
          [...events].reverse().map((event, index) => (
            <EventItem key={`${event.id}-${index}`} event={event} />
          ))
        )}
      </div>

      {/* Event type legend */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> UNAUTHORIZED_ACCESS
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> THREAT_DETECTED
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-400" /> ATTACKER_QUARANTINED
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" /> SERVICE_STARTED
          </span>
        </div>
      </div>
    </div>
  );
};

export default SecurityEventLog;
