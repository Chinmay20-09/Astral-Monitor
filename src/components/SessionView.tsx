import React, { useEffect, useState } from 'react';
import { Route, Users, Activity, Plus, RefreshCw } from 'lucide-react';

export const SessionView: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        setSessions(data.sessions ?? []);
      } catch {
        // backend offline
      } finally {
        setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white font-mono uppercase">Active Session</h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <RefreshCw className="w-3 h-3" />
          <span className="cursor-pointer">Refresh</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Active session</div>
          <div className="font-bold text-cyan-300">
            {sessions.find((s) => s.active)?.session_id ?? 'none'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Active spacecraft</div>
          <div className="font-bold text-cyan-300">
            {sessions.find((s) => s.active)?.spacecraft_id ?? 'SAT-01'}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Total sessions</div>
          <div className="font-bold text-emerald-300">{sessions.length}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase">Active</div>
          <div className="font-bold text-emerald-300">
            {sessions.filter((s) => s.active).length}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-mono uppercase text-slate-500 mb-2">Session List</div>
        <div className="space-y-1">
          {sessions.map((s) => (
            <div
              key={s.session_id}
              className={`flex items-center justify-between p-2 rounded-lg border text-xs font-mono ${
                s.active
                  ? 'bg-cyan-950/30 border-cyan-700/50 text-cyan-200'
                  : 'bg-slate-950/40 border-slate-800/60 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${s.active ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                <div>
                  <div className="font-mono">{s.session_id}</div>
                  <div className="text-[10px] text-slate-500">{s.spacecraft_id}</div>
                </div>
              </div>
              <div className="text-[10px] font-mono">
                {new Date(s.last_active_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-slate-500 font-mono">
          Experiential development: Session → Spacecraft → Mission → Security Gateway → Telemetry / Audit / State
        </div>
      </div>
    </div>
  );
};

export default SessionView;
