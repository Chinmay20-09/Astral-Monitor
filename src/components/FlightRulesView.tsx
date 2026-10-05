import React from 'react';
import { BookOpen, Shield, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { MissionState } from '../models/mission';

interface FlightRulesViewProps {
  missionState: MissionState;
}

export const FlightRulesView: React.FC<FlightRulesViewProps> = ({ missionState }) => {
  return (
    <div className="space-y-6">
      {/* Active Mission Phase & Constraints */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-800">
          <BookOpen className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
              Active Mission Flight Plan & Operational Constraints (TRD Section 10)
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated by Gateway Context Resolver against every candidate command envelope
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Current Active Flight Phase</span>
            <div className="text-base font-bold font-mono text-cyan-300">
              {missionState.current_phase.name}
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {missionState.current_phase.description}
            </p>
            <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs font-mono space-y-1">
              <div className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Allowed: {missionState.current_phase.allowed_commands.join(', ')}</span>
              </div>
              <div className="text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Restricted: {missionState.current_phase.restricted_commands.join(', ')}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Orbit Mechanics</span>
            <div className="text-base font-bold font-mono text-white">
              Altitude: {missionState.orbit_altitude_km} km (Low Earth Orbit)
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Orbital Period: 95.4 minutes • Eclipse Window: 36.0 minutes • Sunlight Window: 59.4 minutes.
            </p>
            <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400">
              Solar Flux Condition: <strong className="text-amber-400">{missionState.current_phase.solar_condition}</strong>
            </div>
          </div>
        </div>

        {/* Operating Constraints List */}
        <div>
          <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
            Active Safety Directives & Thresholds
          </h4>
          <div className="space-y-2.5">
            {missionState.active_constraints.map(constraint => (
              <div key={constraint.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">{constraint.id}: {constraint.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                      {constraint.rule_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {constraint.description}
                  </p>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-500 whitespace-nowrap">
                  Auth: {constraint.evaluator}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flight Operations Documentation */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
          <FileText className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
              Flight Operations Plan Documents (Mission Repository)
            </h3>
            <p className="text-xs text-slate-400">
              Authoritative procedural guides referenced during contextual threat verification
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {missionState.mission_documents.map(doc => (
            <div key={doc.id} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-sm text-cyan-300">{doc.title}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {doc.id} v{doc.version} • {doc.classification}
                </span>
              </div>
              <p className="text-xs text-slate-300 mb-3">{doc.summary}</p>
              <pre className="text-[11px] font-mono text-slate-400 bg-slate-900 p-3 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                {doc.content}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
