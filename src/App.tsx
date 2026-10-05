import React, { useState, useEffect, useCallback, useMemo } from 'react';
import OperatorShell from './components/OperatorShell';
import { GroundConsole } from './components/GroundConsole';
import { SpacecraftTwin } from './components/SpacecraftTwin';
import { AttackSimulator } from './components/AttackSimulator';
import { SessionView } from './components/SessionView';
import { BackendMonitor } from './components/BackendMonitor';
import { ServiceTopology } from './components/ServiceTopology';
import { SecurityStatusCards } from './components/SecurityStatusCards';
import { SecurityEventLog } from './components/SecurityEventLog';

interface AppProps {
  activeScreen?: 'ground' | 'twin' | 'attacker';
}

export function App({ activeScreen: initialScreen = 'ground' }: AppProps) {
  const [activeScreen, setActiveScreen] = useState<'ground' | 'twin' | 'attacker'>(initialScreen);
  const [sessionList, setSessionList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessionList(data.sessions ?? []);
    } catch {
      // backend offline - leave existing state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const timer = setInterval(loadSessions, 3000);
    return () => clearInterval(timer);
  }, [loadSessions]);

  const activeSpacecraft =
    sessionList.find((s) => s.active)?.spacecraft_id ?? 'SAT-01';
  const sessionCount = sessionList.length;
  const activeCount = sessionList.filter((s) => s.active).length;

  const section = useMemo(() => {
    switch (activeScreen) {
      case 'ground':
        return <GroundConsole spacecraftId={activeSpacecraft} />;
      case 'twin':
        return <SpacecraftTwin spacecraftId={activeSpacecraft} />;
      case 'attacker':
        return <AttackSimulator onAttackResult={(s, r) => {}} />;
    }
  }, [activeScreen, activeSpacecraft]);

  return (
    <OperatorShell
      activeScreen={activeScreen}
      onNavigate={setActiveScreen}
      title={
        <span className="flex items-center gap-2">
          {activeScreen === 'ground' && (
            <>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Ground Console
            </>
          )}
          {activeScreen === 'twin' && (
            <>
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              Spacecraft Twin
            </>
          )}
          {activeScreen === 'attacker' && (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              Attack Simulator
            </>
          )}
        </span>
      }
    >
      {loading ? (
        <div className="h-48 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center text-xs text-slate-500 font-mono">
          Loading session state…
        </div>
      ) : (
        <>
          {/* Service Topology & Status */}
          <div className="grid grid-cols-1 gap-6 mb-6">
            <ServiceTopology />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SecurityStatusCards />
              <SecurityEventLog />
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] uppercase font-mono text-slate-500">Active Spacecraft</div>
              <div className="text-lg font-mono font-bold text-cyan-300">{activeSpacecraft}</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] uppercase font-mono text-slate-500">Active Sessions</div>
              <div className="text-lg font-mono font-bold text-emerald-300">{activeCount} / {sessionCount}</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] uppercase font-mono text-slate-500">Backend</div>
              <div className="text-lg font-mono font-bold text-emerald-300">4000</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {section}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SessionView />
              <BackendMonitor restarting={false} />
            </div>
          </div>
        </>
      )}
    </OperatorShell>
  );
}

export default App;
