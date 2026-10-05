import React, { useState } from 'react';
import { Radio, Send, Lock, ShieldCheck, ChevronRight, Sliders } from 'lucide-react';
import { CommandType } from '../models/command';
import { GroundStationSnapshot } from '../api/client';

interface GroundStationTerminalProps {
  onDispatchCommand: (
    stationKeyId: string,
    commandType: CommandType,
    params: Record<string, any>,
    encrypt: boolean
  ) => void;
  isTransmitting: boolean;
  /** Sanitized registry snapshot fetched from the backend (no credential material). */
  stations: GroundStationSnapshot[];
}

export const GroundStationTerminal: React.FC<GroundStationTerminalProps> = ({
  onDispatchCommand,
  isTransmitting,
  stations
}) => {
  const [stationKeyId, setStationKeyId] = useState('GS-PRIMARY-01');
  const [commandType, setCommandType] = useState<CommandType>('QUERY_TELEMETRY');
  const [encrypt, setEncrypt] = useState(false);

  // Command parameter states
  const [cameraTarget, setCameraTarget] = useState('High-Res Multi-spectral Nadir Earth');
  const [cameraExposure, setCameraExposure] = useState(500);
  const [wheelAxis, setWheelAxis] = useState(1);
  const [wheelRpm, setWheelRpm] = useState(1800);
  const [deltaV, setDeltaV] = useState(0.8);
  const [burnDuration, setBurnDuration] = useState(4000);
  const [powerMode, setPowerMode] = useState('SCIENCE');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let params: Record<string, any> = {};

    switch (commandType) {
      case 'QUERY_TELEMETRY':
        params = { subsystems: ['power', 'thermal', 'navigation', 'camera'] };
        break;
      case 'CAPTURE_IMAGE':
        params = { target: cameraTarget, exposure_ms: cameraExposure, resolution: '4096x3072' };
        break;
      case 'ROTATE_REACTION_WHEEL':
        params = { axis: wheelAxis, rpm: wheelRpm, duration_s: 30 };
        break;
      case 'FIRE_THRUSTER':
        params = { delta_v: deltaV, burn_duration_ms: burnDuration };
        break;
      case 'SET_POWER_MODE':
        params = { mode: powerMode };
        break;
      case 'TRANSMIT_DATA':
        params = { destination: 'SVALBARD-GROUND-LINK', packet_count: 120 };
        break;
      case 'SYSTEM_REBOOT':
        params = { delay_sec: 5, preserve_logs: true };
        break;
      case 'OPERATOR_RECOVER':
        params = { clearance_level: 'FLIGHT_DIRECTOR', auth_token: 'CLEAR-SAFE-MODE-2026' };
        break;
    }

    onDispatchCommand(stationKeyId, commandType, params, encrypt);
  };

  const selectedStation = stations.find(st => st.key_id === stationKeyId);

  return (
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
              Compose and uplink structured commands — credential resolution, HMAC signing and
              AES-GCM encryption happen inside the security gateway backend (TRD Section 3)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Gateway HMAC Signing</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Ground Station Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
              Originating Ground Station
            </label>
            <select
              value={stationKeyId}
              onChange={e => setStationKeyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
            >
              {stations.length === 0 && (
                <option value="GS-PRIMARY-01">Loading stations from backend…</option>
              )}
              {stations.map(st => (
                <option key={st.key_id} value={st.key_id}>
                  {st.key_id} — {st.station_name} ({st.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
              Command Type
            </label>
            <select
              value={commandType}
              onChange={e => setCommandType(e.target.value as CommandType)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
            >
              <option value="QUERY_TELEMETRY">QUERY_TELEMETRY (Safe diagnostic telemetry read)</option>
              <option value="CAPTURE_IMAGE">CAPTURE_IMAGE (High-draw optical imaging)</option>
              <option value="ROTATE_REACTION_WHEEL">ROTATE_REACTION_WHEEL (Attitude wheel slew)</option>
              <option value="FIRE_THRUSTER">FIRE_THRUSTER (Station-keeping orbital burn)</option>
              <option value="SET_POWER_MODE">SET_POWER_MODE (Modify spacecraft power state)</option>
              <option value="TRANSMIT_DATA">TRANSMIT_DATA (Downlink data pass)</option>
              <option value="SYSTEM_REBOOT">SYSTEM_REBOOT (Flight computer warm restart)</option>
              <option value="OPERATOR_RECOVER">OPERATOR_RECOVER (Clear safe mode with token)</option>
            </select>
          </div>
        </div>

        {/* Dynamic Parameter Fields */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Command Parameters ({commandType})</span>
          </div>

          {commandType === 'CAPTURE_IMAGE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Description</label>
                <input
                  type="text"
                  value={cameraTarget}
                  onChange={e => setCameraTarget(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Exposure Duration (ms)</label>
                <input
                  type="number"
                  value={cameraExposure}
                  onChange={e => setCameraExposure(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
            </div>
          )}

          {commandType === 'ROTATE_REACTION_WHEEL' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Wheel Axis (0=Roll, 1=Pitch, 2=Yaw)</label>
                <select
                  value={wheelAxis}
                  onChange={e => setWheelAxis(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                >
                  <option value={0}>Axis 0 (X-Roll)</option>
                  <option value={1}>Axis 1 (Y-Pitch)</option>
                  <option value={2}>Axis 2 (Z-Yaw)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Slew RPM (Max safe 5500)</label>
                <input
                  type="number"
                  value={wheelRpm}
                  onChange={e => setWheelRpm(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
            </div>
          )}

          {commandType === 'FIRE_THRUSTER' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Delta-V (m/s — Safe limit: &lt;= 2.0)</label>
                <input
                  type="number"
                  step="0.1"
                  value={deltaV}
                  onChange={e => setDeltaV(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Burn Duration (ms)</label>
                <input
                  type="number"
                  value={burnDuration}
                  onChange={e => setBurnDuration(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
            </div>
          )}

          {commandType === 'SET_POWER_MODE' && (
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Power State</label>
              <select
                value={powerMode}
                onChange={e => setPowerMode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs"
              >
                <option value="NOMINAL">NOMINAL (Standard balance)</option>
                <option value="SCIENCE">SCIENCE (Payload priority)</option>
                <option value="LOW_POWER">LOW_POWER (Minimal power drift)</option>
              </select>
            </div>
          )}

          {commandType === 'QUERY_TELEMETRY' && (
            <p className="text-xs text-slate-400">
              Queries high-rate telemetry across power, thermal, navigation, and flight computer registers.
            </p>
          )}

          {commandType === 'SYSTEM_REBOOT' && (
            <p className="text-xs text-amber-300">
              Warning: Causes 10-second flight computer restart. Prohibited in eclipse or marginal battery.
            </p>
          )}

          {commandType === 'OPERATOR_RECOVER' && (
            <p className="text-xs text-emerald-300">
              Clear vehicle Safe Mode lock and restore nominal flight software authority.
            </p>
          )}
        </div>

        {/* Security Transport Options & Submit */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={encrypt}
              onChange={e => setEncrypt(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              Encrypt Payload with AES-GCM-256 (Confidentiality)
            </span>
          </label>

          <button
            type="submit"
            disabled={isTransmitting || stations.length === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isTransmitting ? 'Transmitting...' : 'Uplink Command'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
