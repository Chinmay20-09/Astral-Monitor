import React from 'react';
import {
  Server,
  Satellite,
  ShieldAlert,
  Lock,
  XCircle,
  CheckCircle,
  Link2,
  Link2Off,
  AlertTriangle,
  Activity
} from 'lucide-react';

interface ServiceCardProps {
  name: string;
  port: number;
  zone: 'TRUSTED' | 'INTERNAL' | 'UNTRUSTED' | 'PRIVATE';
  status: 'ONLINE' | 'OFFLINE' | 'QUARANTINED';
  icon: React.ReactNode;
  connections?: Array<{
    target: string;
    status: 'ALLOW' | 'BLOCK' | 'DENY';
  }>;
}

const zoneStyles = {
  TRUSTED: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  INTERNAL: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
  UNTRUSTED: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  PRIVATE: 'bg-slate-500/15 text-slate-300 border-slate-500/40'
};

const statusStyles = {
  ONLINE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  OFFLINE: 'bg-slate-500/15 text-slate-400 border-slate-500/40',
  QUARANTINED: 'bg-rose-500/20 text-rose-300 border-rose-500/50'
};

function ServiceCard({ name, port, zone, status, icon, connections }: ServiceCardProps) {
  return (
    <div className="bg-slate-900/80 border rounded-xl p-4 shadow-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400">
            {icon}
          </div>
          <div>
            <div className="text-sm font-bold text-white font-mono">{name}</div>
            <div className="text-[10px] text-slate-500 font-mono">:{port}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${zoneStyles[zone]}`}>
            {zone}
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${statusStyles[status]}`}>
            {status}
          </span>
        </div>
      </div>

      {connections && connections.length > 0 && (
        <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase font-mono mb-2">Connections</div>
          {connections.map((conn, i) => (
            <div key={i} className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">{conn.target}</span>
              {conn.status === 'ALLOW' ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> ALLOW
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> BLOCK
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ConnectionLineProps {
  source: string;
  target: string;
  status: 'ALLOW' | 'BLOCK';
  label?: string;
}

function ConnectionLine({ source, target, status, label }: ConnectionLineProps) {
  return (
    <div className="flex items-center justify-between text-[11px] font-mono py-1">
      <div className="flex items-center gap-2">
        <span className="text-slate-300 font-semibold">{source}</span>
        {status === 'ALLOW' ? (
          <Link2 className="w-4 h-4 text-cyan-400" />
        ) : (
          <Link2Off className="w-4 h-4 text-rose-400" />
        )}
        <span className="text-slate-300 font-semibold">{target}</span>
      </div>
      <div className="flex items-center gap-2">
        {label && <span className="text-slate-500 text-[10px]">({label})</span>}
        {status === 'ALLOW' ? (
          <span className="text-emerald-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> ALLOW
          </span>
        ) : (
          <span className="text-rose-400 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> BLOCK
          </span>
        )}
      </div>
    </div>
  );
}

export const ServiceTopology: React.FC = () => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-mono">Service Topology</h2>
            <p className="text-xs text-slate-400">Network segmentation & trust boundaries</p>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          ST-02 Security Architecture
        </div>
      </div>

      {/* Service cards in a grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ServiceCard
          name="Ground Console"
          port={3000}
          zone="TRUSTED"
          status="ONLINE"
          icon={<Server className="w-4 h-4" />}
          connections={[
            { target: 'SpaceTwin :3100', status: 'ALLOW' },
            { target: 'Backend :4000', status: 'ALLOW' },
            { target: 'Attacker :3500', status: 'BLOCK' }
          ]}
        />
        <ServiceCard
          name="SpaceTwin"
          port={3100}
          zone="TRUSTED"
          status="ONLINE"
          icon={<Satellite className="w-4 h-4" />}
          connections={[
            { target: 'Ground :3000', status: 'ALLOW' },
            { target: 'Backend :4000', status: 'ALLOW' },
            { target: 'Attacker :3500', status: 'BLOCK' }
          ]}
        />
        <ServiceCard
          name="Security Gateway"
          port={4000}
          zone="INTERNAL"
          status="ONLINE"
          icon={<Lock className="w-4 h-4" />}
          connections={[
            { target: 'Ground :3000', status: 'ALLOW' },
            { target: 'SpaceTwin :3100', status: 'ALLOW' },
            { target: 'Attacker :3500', status: 'BLOCK' }
          ]}
        />
        <ServiceCard
          name="Attacker"
          port={3500}
          zone="UNTRUSTED"
          status="ONLINE"
          icon={<ShieldAlert className="w-4 h-4" />}
          connections={[
            { target: 'Ground :3000', status: 'BLOCK' },
            { target: 'SpaceTwin :3100', status: 'BLOCK' },
            { target: 'Backend :4000', status: 'BLOCK' }
          ]}
        />
      </div>

      {/* Database card */}
      <div className="mb-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-white font-mono">Database</div>
                <div className="text-[10px] text-slate-500 font-mono">SQLite — PRIVATE</div>
              </div>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${zoneStyles.PRIVATE}`}>
              PRIVATE
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 font-mono">
            Only accessible through backend/data layer. Never exposed to browser or attacker.
          </div>
        </div>
      </div>

      {/* Connection lines */}
      <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800/80 mb-4">
        <div className="text-[10px] text-slate-500 uppercase font-mono mb-3">Communication Matrix</div>
        <div className="space-y-1">
          <ConnectionLine
            source="Ground :3000"
            target="SpaceTwin :3100"
            status="ALLOW"
            label="trusted link"
          />
          <ConnectionLine
            source="SpaceTwin :3100"
            target="Ground :3000"
            status="ALLOW"
            label="trusted link"
          />
          <ConnectionLine
            source="Ground :3000"
            target="Backend :4000"
            status="ALLOW"
          />
          <ConnectionLine
            source="SpaceTwin :3100"
            target="Backend :4000"
            status="ALLOW"
          />
          <ConnectionLine
            source="Attacker :3500"
            target="Ground :3000"
            status="BLOCK"
            label="denied"
          />
          <ConnectionLine
            source="Attacker :3500"
            target="SpaceTwin :3100"
            status="BLOCK"
            label="denied"
          />
          <ConnectionLine
            source="Attacker :3500"
            target="Backend :4000"
            status="BLOCK"
            label="denied"
          />
        </div>
      </div>

      {/* Security principle banner */}
      <div className="bg-gradient-to-r from-cyan-950/30 to-indigo-950/30 border border-cyan-800/30 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span className="font-mono">DEFAULT DENY</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono">EXPLICIT ALLOW</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono">LEAST PRIVILEGE</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          Network Segmentation · Quarantine · Recovery
        </div>
      </div>
    </div>
  );
};

export default ServiceTopology;
