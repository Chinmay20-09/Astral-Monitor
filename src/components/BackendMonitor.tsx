import React, { useState, useEffect } from 'react';
import { Activity, Server, Database, RefreshCw, RotateCcw } from 'lucide-react';

interface Health {
  status: string;
  database: string;
  version: string;
  spacecraft_id?: string;
  operating_mode?: string;
  mission_phase?: string;
  uptime_seconds?: number;
  persistence?: Record<string, unknown>;
}

export const BackendMonitor: React.FC<{ restarting: boolean }> = ({ restarting }) => {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/health');
        const data = (await res.json()) as Health;
        setHealth(data);
      } catch {
        setHealth({ status: 'offline', database: 'disconnected', version: '—' });
      } finally {
        setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-800">
          <Server className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-bold text-white font-mono uppercase">Backend Monitor</h3>
        </div>
        <div className="text-xs text-slate-500 font-mono">Connecting…</div>
      </div>
    );
  }

  const statusColor =
    health?.database === 'connected' && health.status === 'ok'
      ? 'text-emerald-400'
      : 'text-amber-400';

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-bold text-white font-mono uppercase">Backend Monitor</h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${health?.database === 'connected' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' : 'bg-amber-950/60 text-amber-300 border-amber-800'}`}>
            {health?.database ?? 'disconnected'}
          </span>
          {restarting && <span className="text-xs text-amber-300 font-mono">Restarting...</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Status</div>
          <div className={`font-bold text-lg ${statusColor}`}>{health?.status ?? 'offline'}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Version</div>
          <div className="font-mono font-bold text-white">{health?.version ?? '—'}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Vehicle</div>
          <div className="font-mono font-bold text-white">{health?.spacecraft_id ?? 'SAT-01'}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Mission phase</div>
          <div className="font-mono font-bold text-cyan-300">{health?.mission_phase ?? '—'}</div>
        </div>
      </div>

      {health?.persistence && (
        <div className="mt-3 text-xs text-slate-400 font-mono space-y-1">
          {Object.entries(health.persistence).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-slate-500">{k}</span>
              <span className="text-slate-200">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 text-[10px] text-slate-500 font-mono">
        <Activity className="inline w-3 h-3 mr-1" />
        PostgreSQL → GraphQL / REST / WS (persistent, audit-logged)
      </div>
    </div>
  );
};

export default BackendMonitor;
