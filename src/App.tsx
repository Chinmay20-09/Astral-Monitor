import React, { useState, useEffect, useCallback, useMemo } from 'react';
import OperatorShell from './components/OperatorShell';
import { GroundConsole } from './components/GroundConsole';
import { SpacecraftTwin } from './components/SpacecraftTwin';
import { AttackSimulator } from './components/AttackSimulator';

interface AppProps {
  activeScreen?: 'ground' | 'twin' | 'attacker';
}

export function App({ activeScreen: initialScreen = 'ground' }: AppProps) {
  const [activeScreen, setActiveScreen] = useState<'ground' | 'twin' | 'attacker'>(initialScreen);

  // Shared spacecraft id across all screens (defaults to SAT-01 if no session)
  const [activeSpacecraft, setActiveSpacecraft] = useState<string>('SAT-01');

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
