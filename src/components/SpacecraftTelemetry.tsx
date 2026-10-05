import React, { useState } from 'react';
import {
  BatteryCharging,
  Sun,
  Moon,
  Thermometer,
  Compass,
  Camera,
  Cpu,
  Radio,
  AlertTriangle,
  KeyRound,
  RotateCw
} from 'lucide-react';
import { SpacecraftState, EssentialTelemetry } from '../models/spacecraft';

interface SpacecraftTelemetryProps {
  state: SpacecraftState;
  telemetry: EssentialTelemetry;
  onExecuteRecovery: () => void;
  onRefreshTelemetry: () => void;
}

export const SpacecraftTelemetry: React.FC<SpacecraftTelemetryProps> = ({
  state,
  telemetry,
  onExecuteRecovery,
  onRefreshTelemetry
}) => {
  const [operatorToken, setOperatorToken] = useState('OPS-DIR-SVALBARD-SIG-991');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const isSafeMode = state.operating_mode === 'SAFE_MODE';
  const isEclipse = state.power.in_eclipse;

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorToken.trim()) {
      setRecoveryError('Operator authorization token is required.');
      return;
    }
    setRecoveryError(null);
    onExecuteRecovery();
  };

  return (
    <div className="space-y-5">
      {/* SAFE MODE ALERT BANNER */}
      {isSafeMode && (
        <div className="bg-rose-950/90 border-2 border-rose-600 rounded-2xl p-5 shadow-2xl animate-pulse">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                  SPACECRAFT AUTONOMOUS SAFE MODE ENGAGED
                </h3>
                <p className="text-xs text-rose-200 mt-0.5">
                  Reason: <strong>{state.flight_computer.safe_mode_reason || 'Critical contextual security threshold exceeded'}</strong>
                </p>
                <p className="text-[11px] text-rose-300/80 mt-1">
                  Protective software locks active. Thrusters, high-draw payloads, and attitude slewing locked.
                  <strong> Essential Telemetry stream preserved over carrier channel.</strong>
                </p>
              </div>
            </div>

            {/* Operator Recovery Action */}
            <form onSubmit={handleRecoverySubmit} className="flex items-center gap-2 w-full md:w-auto bg-slate-950/80 p-3 rounded-xl border border-rose-800/80">
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                  Flight Director Recovery Token
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={operatorToken}
                    onChange={e => setOperatorToken(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 w-52"
                    placeholder="Enter clearance token..."
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Clear Safe Mode</span>
                  </button>
                </div>
                {recoveryError && <p className="text-[10px] text-rose-400 mt-1">{recoveryError}</p>}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-SYSTEMS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. POWER SUBSYSTEM */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span className="font-mono uppercase flex items-center gap-1.5 text-white">
              <BatteryCharging className="w-4 h-4 text-cyan-400" />
              Power & Battery
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              {state.power.battery_voltage.toFixed(1)} V
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-3xl font-extrabold font-mono text-white">
                {state.power.battery_percent.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Draw: {state.power.consumption_watts.toFixed(0)} W
              </span>
            </div>

            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  state.power.battery_percent < 30
                    ? 'bg-rose-500'
                    : state.power.battery_percent < 50
                    ? 'bg-amber-400'
                    : 'bg-cyan-400'
                }`}
                style={{ width: `${Math.max(5, state.power.battery_percent)}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-lg p-2.5 text-[11px] font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                {isEclipse ? <Moon className="w-3 h-3 text-indigo-400" /> : <Sun className="w-3 h-3 text-amber-400" />}
                Solar Flux:
              </span>
              <span className={isEclipse ? 'text-indigo-300 font-bold' : 'text-amber-300 font-bold'}>
                {state.power.solar_generation_watts.toFixed(0)} W ({isEclipse ? 'Eclipse' : 'Sunlit'})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Net Flow:</span>
              <span className={state.power.solar_generation_watts > state.power.consumption_watts ? 'text-emerald-400' : 'text-rose-400'}>
                {(state.power.solar_generation_watts - state.power.consumption_watts).toFixed(1)} W
              </span>
            </div>
          </div>
        </div>

        {/* 2. THERMAL SUBSYSTEM */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span className="font-mono uppercase flex items-center gap-1.5 text-white">
              <Thermometer className="w-4 h-4 text-amber-400" />
              Thermal Control
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${state.thermal.heaters_active ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-slate-400'}`}>
              Heaters {state.thermal.heaters_active ? 'ON' : 'OFF'}
            </span>
          </div>

          <div className="my-3">
            <div className="text-3xl font-extrabold font-mono text-white">
              {state.thermal.bus_temp_celsius.toFixed(1)}°C
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Bus Internal Temperature
            </p>
          </div>

          <div className="bg-slate-950/60 rounded-lg p-2.5 text-[11px] font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Payload Temp:</span>
              <span className="text-slate-200">{state.thermal.payload_temp_celsius.toFixed(1)}°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Thermal Envelope:</span>
              <span className="text-emerald-400 font-medium">NOMINAL (-10 to +40°C)</span>
            </div>
          </div>
        </div>

        {/* 3. GUIDANCE & ATTITUDE */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span className="font-mono uppercase flex items-center gap-1.5 text-white">
              <Compass className="w-4 h-4 text-emerald-400" />
              Attitude & Prop
            </span>
            <span className="text-[11px] font-mono text-emerald-400">
              Fuel: {state.navigation.fuel_remaining_kg.toFixed(2)} kg
            </span>
          </div>

          <div className="my-2 space-y-1">
            <div className="text-xs text-slate-400 font-mono">Reaction Wheels (X / Y / Z):</div>
            <div className="text-sm font-bold font-mono text-white">
              {state.navigation.reaction_wheel_rpm[0]} / {state.navigation.reaction_wheel_rpm[1]} / {state.navigation.reaction_wheel_rpm[2]} <span className="text-[10px] text-slate-400 font-normal">RPM</span>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-lg p-2.5 text-[11px] font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Yaw / Pitch:</span>
              <span className="text-slate-200">
                {state.navigation.attitude.yaw_deg.toFixed(1)}° / {state.navigation.attitude.pitch_deg.toFixed(1)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Thruster Burn:</span>
              <span className="text-slate-300 truncate max-w-[120px]">
                {state.navigation.last_thruster_burn ? new Date(state.navigation.last_thruster_burn).toLocaleTimeString() : 'None this orbit'}
              </span>
            </div>
          </div>
        </div>

        {/* 4. PAYLOAD & FLIGHT COMPUTER */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span className="font-mono uppercase flex items-center gap-1.5 text-white">
              <Camera className="w-4 h-4 text-indigo-400" />
              Camera Payload
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              state.camera.status === 'DISABLED'
                ? 'bg-rose-950 text-rose-300'
                : state.camera.status === 'CAPTURING'
                ? 'bg-cyan-950 text-cyan-300 animate-pulse'
                : 'bg-slate-800 text-slate-300'
            }`}>
              {state.camera.status}
            </span>
          </div>

          <div className="my-2">
            <div className="text-xl font-bold font-mono text-white">
              {state.camera.images_captured} Frames
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {state.camera.resolution}
            </p>
          </div>

          <div className="bg-slate-950/60 rounded-lg p-2.5 text-[11px] font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                CPU / RAM:
              </span>
              <span className="text-slate-200">
                {state.flight_computer.cpu_load_percent.toFixed(0)}% / {state.flight_computer.memory_used_mb}MB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Uptime:</span>
              <span className="text-slate-300">
                {Math.floor(state.flight_computer.uptime_seconds / 3600)}h {Math.floor((state.flight_computer.uptime_seconds % 3600) / 60)}m
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ESSENTIAL TELEMETRY STREAM MONITOR */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Essential Telemetry Stream (High-Reliability Carrier Channel)
            </h4>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">
              Heartbeat: <strong className="text-cyan-400">#{telemetry.heartbeat_counter}</strong>
            </span>
            <button
              onClick={onRefreshTelemetry}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
            >
              <RotateCw className="w-3 h-3" />
              <span>Poll</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs font-mono">
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block">Vehicle ID</span>
            <span className="font-bold text-white">{telemetry.spacecraft_id}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block">Carrier Link</span>
            <span className="font-bold text-cyan-400">{telemetry.comm_status}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block">Mode Status</span>
            <span className={`font-bold ${telemetry.safe_mode_active ? 'text-rose-400' : 'text-emerald-400'}`}>
              {telemetry.operating_mode}
            </span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block">Telemetry Battery</span>
            <span className="font-bold text-slate-200">{telemetry.battery_percent.toFixed(1)}%</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block">Telemetry Temp</span>
            <span className="font-bold text-slate-200">{telemetry.bus_temp_celsius.toFixed(1)}°C</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <span className="text-[10px] text-slate-500 uppercase block">Last Packet</span>
            <span className="text-slate-400 text-[10px] truncate block">
              {new Date(telemetry.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
