import React, { useState, useEffect } from 'react';
import { Server, Satellite, Lock, ShieldAlert, Database, Activity, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface ServiceStatus {
  name: string;
  port: number;
  zone: 'TRUSTED' | 'INTERNAL' | 'UNTRUSTED' | 'PRIVATE';
  status: 'ONLINE' | 'OFFLINE' | 'QUARANTINED' | 'UNKNOWN';
  icon: React.ReactNode;
  description: string;
  healthUrl?: string;
}

const zoneBadgeStyles = {
  TRUSTED: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  INTERNAL: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
  UNTRUSTED: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  PRIVATE: 'bg-slate-500/15 text-slate-300 border-slate-500/40'
};

const statusIndicatorStyles = {
  ONLINE: 'bg-emerald-500',
  OFFLINE: 'bg-slate-600',
  QUARANTINED: 'bg-rose-500 animate-pulse',
  UNKNOWN: 'bg-amber-500'
};

export const SecurityStatusCards: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'Ground Console',
      port: 3000,
      zone: 'TRUSTED',
      status: 'UNKNOWN',
      icon: <Server className="w-4 h-4" />,
      description: 'Main OrbitShield control/ground interface'
    },
    {
      name: 'SpaceTwin',
      port: 3100,
      zone: 'TRUSTED',
      status: 'UNKNOWN',
      icon: <Satellite className="w-4 h-4" />,
      description: 'Spacecraft digital twin / simulator'
    },
    {
      name: 'Security Gateway',
      port: 4000,
      zone: 'INTERNAL',
      status: 'UNKNOWN',
      icon: <Lock className="w-4 h-4" />,
      description: 'Reserved backend/API service',
      healthUrl: '/api/health'
    },
    {
      name: 'Attacker Simulator',
      port: 3500,
      zone: 'UNTRUSTED',
      status: 'UNKNOWN',
      icon: <ShieldAlert className="w-4 h-4" />,
      description: 'Simulated malicious/unwanted guest'
    },
    {
      name: 'Database',
      port: 0,
      zone: 'PRIVATE',
      status: 'UNKNOWN',
      icon: <Database className="w-4 h-4" />,
      description: 'SQLite — persistent state only'
    }
  ]);

  useEffect(() => {
    const checkHealth = async () => {
      const updated = [...services];

      // Check backend health via API
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          const backendIdx = updated.findIndex(s => s.port === 4000);
          if (backendIdx >= 0) {
            updated[backendIdx] = {
              ...updated[backendIdx],
              status: data.status === 'ok' ? 'ONLINE' : 'OFFLINE'
            };
          }
          // Also update database status
          const dbIdx = updated.findIndex(s => s.name === 'Database');
          if (dbIdx >= 0) {
            updated[dbIdx] = {
              ...updated[dbIdx],
              status: data.database === 'connected' ? 'ONLINE' : 'OFFLINE'
            };
          }
        }
      } catch {
        // Backend offline
      }

      // Check other services via direct fetch
      const checkPort = async (port: number, name: string) => {
        try {
          const res = await fetch(`http://localhost:${port}`, {
            method: 'HEAD',
            mode: 'no-cors'
          });
          const idx = updated.findIndex(s => s.port === port);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              status: 'ONLINE'
            };
          }
        } catch {
          // Service offline or not reachable
        }
      };

      await checkPort(3000, 'Ground Console');
      await checkPort(3100, 'SpaceTwin');
      await checkPort(3500, 'Attacker Simulator');

      setServices(updated);
    };

    // Initial check
    checkHealth();

    // Periodic refresh
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-mono">Service Status</h2>
            <p className="text-xs text-slate-400">Real-time service health monitoring</p>
          </div>
        </div>
        <button
          onClick={() => setServices(prev => prev.map(s => ({
            ...s,
            status: 'UNKNOWN'
          })))}
          className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <div
            key={service.name}
            className="bg-slate-950/70 border rounded-xl p-4 shadow-lg transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg border shadow-sm ${service.status === 'ONLINE' ? 'bg-emerald-950/30 border-emerald-700/50' : service.status === 'OFFLINE' ? 'bg-slate-900 border-slate-700' : 'bg-rose-950/30 border-rose-700/50'}`}>
                  <div className={`w-3 h-3 rounded-full ${statusIndicatorStyles[service.status]} flex items-center justify-center`}>
                    {service.status === 'ONLINE' && <CheckCircle className="w-3 h-3 text-white" />}
                    {service.status === 'OFFLINE' && <XCircle className="w-3 h-3 text-slate-400" />}
                    {service.status === 'QUARANTINED' && <AlertTriangle className="w-3 h-3 text-white" />}
                  </div>
                  {service.icon && <div className="mt-2">{service.icon}</div>}
                </div>
                <div>
                  <div className="text-sm font-bold text-white font-mono">{service.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {service.port > 0 ? `:${service.port}` : 'internal'}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${zoneBadgeStyles[service.zone]}`}>
                {service.zone}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <div className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                service.status === 'ONLINE'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : service.status === 'OFFLINE'
                  ? 'bg-slate-900/80 text-slate-400 border-slate-700'
                  : service.status === 'QUARANTINED'
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800'
              }`}>
                {service.status}
              </div>
              <div className="text-[10px] text-slate-500">
                {service.description}
              </div>
            </div>

            {/* Trust indicators */}
            {service.zone === 'TRUSTED' && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-cyan-400">
                <CheckCircle className="w-3 h-3" />
                <span>Can communicate with trusted services</span>
              </div>
            )}
            {service.zone === 'UNTRUSTED' && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-rose-400">
                <XCircle className="w-3 h-3" />
                <span>Blocked from trusted services</span>
              </div>
            )}
            {service.zone === 'PRIVATE' && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                <Lock className="w-3 h-3" />
                <span>Only accessible through backend</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Security state summary */}
      <div className="mt-5 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <div className="text-slate-500 font-mono">Security State:</div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-mono font-bold">MONITORING</span>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-slate-500 font-mono">
          All services are being monitored for security events.
          {services.filter(s => s.status === 'ONLINE').length} of {services.length} services online.
        </div>
      </div>
    </div>
  );
};

export default SecurityStatusCards;
