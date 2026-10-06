import React from 'react';

interface OperatorShellProps {
  activeScreen: 'ground' | 'twin' | 'attacker';
  onNavigate: (screen: 'ground' | 'twin' | 'attacker') => void;
  title: React.ReactNode;
  children: React.ReactNode;
}

export const OperatorShell: React.FC<OperatorShellProps> = ({
  activeScreen,
  onNavigate,
  title,
  children
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V8.26l7-3.89v8.62z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-mono">
                Orbit<span className="text-cyan-400">Shield</span>
              </h1>
              <p className="text-[10px] uppercase font-mono text-slate-500 tracking-wide">
                ST-02 Multi-Screen Operator Platform
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {(
              [
                { id: 'ground' as const, label: 'Ground Console' },
                { id: 'twin' as const, label: 'Spacecraft Twin' },
                { id: 'attacker' as const, label: 'Attack Simulator' }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeScreen === tab.id
                    ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 py-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-white font-mono">{title}</h2>
          <p className="text-xs text-slate-400 font-mono">
            All three screens (Ground :3000, Twin :3100, Attacker :3500) share one backend :4000 and the same active session.
          </p>
        </div>

        {children}
      </main>
    </div>
  );
};

export default OperatorShell;
