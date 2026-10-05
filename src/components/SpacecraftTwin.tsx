import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Satellite, Orbit, BarChart3, BatteryFull, Thermometer, Radio, AlertTriangle, Activity } from 'lucide-react';
import { EssentialTelemetry, SpacecraftState } from '../models/spacecraft';

interface TwinPayload {
  spacecraft_id: string;
  position: { x_px: number; y_px: number; orbit_progress: number };
  orbit: { altitude_km: number; inclination_deg: number; period_minutes: number; orbit_type: string };
  altitude_km: number;
  solar_condition: string;
  operating_mode: string;
  battery_percent: number;
  temperature: number;
  communication_status: string;
  security_posture: 'NORMAL' | 'SUSPICIOUS' | 'CRITICAL';
  orbit_progress: number;
}

interface SpacecraftTwinProps {
  spacecraftId?: string;
  onRefresh?: () => void;
}

const postureStyles: Record<string, string> = {
  NORMAL: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  SUSPICIOUS: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  CRITICAL: 'bg-rose-500/15 text-rose-300 border-rose-500/40'
};

function useProjection(payload: TwinPayload | null, tick: number) {
  return useMemo(() => {
    if (!payload) return null;
    const progress = ((payload.orbit_progress * 10000 + tick) % 10000) / 10000;
    return {
      orbit_progress: progress,
      x_px: (progress * 2 - 1) * 280,
      y_px: Math.sin(progress * Math.PI * 2) * 120
    };
  }, [payload, tick]);
}

export const SpacecraftTwin: React.FC<SpacecraftTwinProps> = ({ spacecraftId = 'SAT-01', onRefresh }) => {
  const [payload, setPayload] = useState<TwinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/spacecraft/${spacecraftId}/twin`);
        if (!res.ok) throw new Error(`twin request failed: ${res.status}`);
        const data = (await res.json()) as TwinPayload;
        if (cancelled) return;
        setPayload(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Twin load failed');
        setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = setInterval(() => setTick((t) => t + 1), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [spacecraftId]);

  const projection = tick > 0 ? useProjection(payload, tick) : null;

  const isEclipse = payload?.solar_condition === 'UMBRA_ECLIPSE';
  const isSafe = payload?.operating_mode === 'SAFE_MODE';
  const posture = payload?.security_posture ?? 'NORMAL';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
          <Compass className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white font-mono">Spacecraft Twin</h3>
          <p className="text-xs text-slate-400 font-mono">
            {payload
              ? `Live twin of ${payload.spacecraft_id} — deterministic orbital projection (read-only)`
              : 'Loading twin…'}
          </p>
        </div>
      </div>

      {loading && (
        <div className="h-64 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center text-xs text-slate-500 font-mono">
          Establishing twin link…
        </div>
      )}

      {error && !loading && (
        <div className="h-64 rounded-2xl border border-amber-700/50 bg-amber-950/20 flex items-center justify-center text-xs text-amber-200 font-mono">
          ⚠ {error}
        </div>
      )}

      {payload && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Satellite className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-white">{payload.spacecraft_id} Twin</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${postureStyles[posture]}`}>
                    {posture.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                  <span>Orbit {payload.orbit.period_minutes.toFixed(1)} min</span>
                  <span>Alt {payload.orbit.altitude_km.toFixed(1)} km</span>
                  <span>Progress {Math.round(payload.orbit_progress * 100)}%</span>
                </div>
              </div>

              <div className="relative flex items-center justify-center py-6">
                <div className="relative w-[520px] h-[520px] rounded-full border-2 border-slate-800 overflow-hidden bg-slate-950/40">
                  {[
                    { t: 0, cls: 'border-cyan-900/60' },
                    { t: 0.25, cls: 'border-indigo-900/40' },
                    { t: 0.5, cls: 'border-violet-900/40' },
                    { t: 0.75, cls: 'border-blue-900/40' },
                    { t: 1, cls: 'border-cyan-900/60' }
                  ].map((seg) => (
                    <div
                      key={seg.t}
                      className={`absolute inset-0 rounded-full ${seg.cls}`}
                      style={{ transform: `rotate(${seg.t * 360}deg)`, transformOrigin: 'center' }}
                    />
                  ))}

                  <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
                    <circle
                      cx="260"
                      cy="260"
                      r="220"
                      fill="none"
                      stroke="rgba(56,189,248,0.06)"
                      strokeWidth="1.5"
                      strokeDasharray="12 14"
                      strokeLinecap="round"
                    />
                  </svg>

                  <div
                    className="relative z-10 transition-all duration-[2000ms] ease-out"
                    style={{
                      transform: `translate(${projection?.x_px ?? 0}px, ${projection?.y_px ?? 0}px) scale(1.15)`,
                      transformOrigin: 'center'
                    }}
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/40 border-2 border-slate-950">
                        <Satellite className="w-4 h-4 text-white" />
                      </div>
                      <div className="absolute -inset-2 rounded-full border border-cyan-500/30 animate-ping" />
                    </div>
                  </div>

                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-[10px] font-mono text-slate-500 pointer-events-none"
                    style={{ transform: 'translate(-50%, -50%)', transformOrigin: '50% 50%' }}
                  >
                    ⟳ {Math.round(payload.orbit_progress * 100)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Inclination</div>
                  <div className="text-sm font-mono font-bold text-white">{payload.orbit.inclination_deg.toFixed(1)}°</div>
                </div>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Altitude</div>
                  <div className="text-sm font-mono font-bold text-cyan-300">{payload.altitude_km.toFixed(1)} km</div>
                </div>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Sunlight</div>
                  <div className="text-sm font-mono font-bold text-amber-300">{isEclipse ? 'UMBRA (eclipse)' : 'full sun'}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-3 text-xs font-mono">
                <div className="text-slate-500 uppercase">Mode</div>
                <div className={`font-bold ${isSafe ? 'text-rose-300' : 'text-white'}`}>{payload.operating_mode}</div>
              </div>
              <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-3 text-xs font-mono">
                <div className="text-slate-500 uppercase">Battery</div>
                <div className="flex items-center justify-center gap-2 font-bold text-amber-300">
                  <BatteryFull className="w-3 h-3" /> {payload.battery_percent.toFixed(1)}%
                </div>
              </div>
              <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-3 text-xs font-mono">
                <div className="text-slate-500 uppercase">Temp</div>
                <div className="font-mono font-bold text-slate-200">{payload.temperature.toFixed(1)}°C</div>
              </div>
              <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-3 text-xs font-mono">
                <div className="text-slate-500 uppercase">Comm</div>
                <div className="font-mono font-bold text-cyan-300">{payload.communication_status}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-mono font-bold text-white">Essential Telemetry</span>
                </div>
                <button
                  onClick={onRefresh}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                >
                  <Radio className="w-3 h-3" /> Refresh
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">ID</div>
                  <div className="font-bold text-white">{payload.spacecraft_id}</div>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">Mode</div>
                  <div className={`font-bold ${isSafe ? 'text-rose-400' : 'text-emerald-400'}`}>{payload.operating_mode}</div>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">Battery</div>
                  <div className="font-bold text-slate-200">{payload.battery_percent.toFixed(1)}%</div>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">Temp</div>
                  <div className="font-bold text-slate-200">{payload.temperature.toFixed(1)}°C</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono font-bold text-white">Security Posture</span>
              </div>
              <div className={`rounded-xl border-px p-4 text-center ${postureStyles[posture]} border`}>
                <div className="text-2xl font-extrabold font-mono">{posture}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  {posture === 'NORMAL'
                    ? 'All multi-factor checks nominal'
                    : posture === 'SUSPICIOUS'
                      ? 'Elevated or marginal signal — monitor closely'
                      : 'Critical posture — deterministic safeguards engaged'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpacecraftTwin;
