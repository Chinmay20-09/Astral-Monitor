import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Radio, Send, Lock, ShieldCheck, Sliders, AlertTriangle, Activity, RefreshCw, Trash2, Plus, Route } from 'lucide-react';
import { orbitShieldApi, GroundStationSnapshot, OperatorCommandIntent, GatewayProcessResultDTO } from '../api/client';
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
          </div>
        </div>

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
