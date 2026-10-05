import React from 'react';
import { Shield, Radio, Satellite, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';
import { SpacecraftState } from '../models/spacecraft';
import { MissionState } from '../models/mission';

interface HeaderProps {
  spacecraftState: SpacecraftState;
  missionState: MissionState;
  onTogglePhase: () => void;
  onSimulateTick: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  spacecraftState,
  missionState,
  onTogglePhase,
  activeTab,
  setActiveTab
}) => {
  const isSafeMode = spacecraftState.operating_mode === 'SAFE_MODE';
  const isEclipse = missionState.current_phase.solar_condition === 'UMBRA_ECLIPSE';

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${isSafeMode ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
                Orbit<span className="text-cyan-400">Shield</span>
              </h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                ST-02 Gateway
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>Spacecraft: <strong className="text-slate-200">{spacecraftState.spacecraft_id} (Sentinel LEO)</strong></span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                <Clock className="w-3 h-3 text-cyan-400" />
                {new Date(spacecraftState.timestamp).toLocaleTimeString()} UTC
              </span>
            </p>
          </div>
        </div>

        {/* Spacecraft Status Pills */}
        <div className="flex items-center gap-3">
          {/* Orbital Phase Badge */}
          <button
            onClick={onTogglePhase}
            title="Click to toggle between Umbra Eclipse & Full Sun pass"
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
              isEclipse
                ? 'bg-indigo-950/70 border-indigo-700 text-indigo-200 hover:bg-indigo-900/80'
                : 'bg-amber-950/70 border-amber-600 text-amber-200 hover:bg-amber-900/80'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isEclipse ? 'text-indigo-400' : 'text-amber-400'}`} />
            <span>Phase: <strong>{missionState.current_phase.name}</strong></span>
            <span className="text-[10px] text-slate-400 underline ml-1">Toggle</span>
          </button>

          {/* Operating Mode Status Pill */}
          <div
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-2 ${
              isSafeMode
                ? 'bg-rose-950/80 border-rose-600 text-rose-200 animate-pulse'
                : 'bg-emerald-950/70 border-emerald-700 text-emerald-200'
            }`}
          >
            {isSafeMode ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-bold">PROTECTED SAFE MODE</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>MODE: <strong className="font-bold text-white">{spacecraftState.operating_mode}</strong></span>
              </>
            )}
          </div>

          {/* Comm Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-mono text-slate-300">
            <Radio className={`w-3 h-3 ${isSafeMode ? 'text-amber-400 animate-pulse' : 'text-cyan-400'}`} />
            <span>RF: {spacecraftState.communication_status}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="w-full sm:w-auto flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          {[
            { id: 'dashboard', label: 'Command & Gateway' },
            { id: 'telemetry', label: 'Spacecraft Twin' },
            { id: 'attacks', label: 'Attack Simulator' },
            { id: 'mission', label: 'Flight Rules & Docs' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
