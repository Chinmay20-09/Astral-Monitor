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

type Screen = 'ground' | 'twin' | 'attacker';

interface AppProps {
  activeScreen?: Screen;
}

/**
 * Resolve the operator screen for this URL. The three Vite services (:3000
 * Ground, :3100 Twin, :3500 Attacker) all serve the same index.html, so the
 * screen must come from the URL — `start.bat` opens /twin and /attacker, and
 * the per-service ports are a fallback. The dedicated entries
 * (main.twin.tsx / main.attacker.tsx) still pass `activeScreen` explicitly,
 * which takes precedence over this detection.
 */
function detectScreen(): Screen {
  const path = window.location.pathname.toLowerCase();
  if (path === '/twin' || path.startsWith('/twin/')) return 'twin';
  if (path === '/attacker' || path.startsWith('/attacker/')) return 'attacker';

  const { port } = window.location;
  if (port === '3100' || port === '3010') return 'twin';
  if (port === '3500') return 'attacker';
  return 'ground';
}

export function App({ activeScreen: initialScreen }: AppProps) {
  const [activeScreen, setActiveScreen] = useState<Screen>(
    () => initialScreen ?? detectScreen()
  );
  const [sessionList, setSessionList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load active spacecraft from backend (shared across all screens)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/sessions');
        if (!res.ok) return;
        const data = await res.json();
        const active = data.sessions?.find((s: any) => s.active);
        if (active && !cancelled) {
          setActiveSpacecraft(active.spacecraft_id ?? 'SAT-01');
        }
      } catch {
        // backend offline - keep default
      }
    }
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const section = useMemo(() => {
    switch (activeScreen) {
      case 'ground':
        return <GroundConsole spacecraftId={activeSpacecraft} />;
      case 'twin':
        return (
          <div className="max-w-5xl mx-auto">
            <SpacecraftTwin spacecraftId={activeSpacecraft} />
          </div>
        );
      case 'attacker':
        return (
          <div className="max-w-4xl mx-auto">
            <AttackSimulator onAttackResult={(s, r) => {}} />
          </div>
        );
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
      {section}
    </OperatorShell>
  );
}

export default App;
