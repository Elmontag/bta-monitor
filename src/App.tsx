import { useState } from 'react';
import './index.css';
import type { ParliamentPeriod, Poll } from './types/api';
import { Sidebar } from './components/Sidebar';
import { VoteDetail } from './components/VoteDetail';
import { WelcomeScreen } from './components/WelcomeScreen';

export default function App() {
  const [selectedPeriod, setSelectedPeriod] = useState<ParliamentPeriod | null>(null);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handlePeriodSelect(period: ParliamentPeriod) {
    setSelectedPeriod(period);
    setSelectedPoll(null);
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-80 flex-shrink-0
          bg-slate-900 text-white
          flex flex-col
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <Sidebar
          selectedPeriod={selectedPeriod}
          selectedPoll={selectedPoll}
          onPeriodSelect={handlePeriodSelect}
          onPollSelect={(poll) => {
            setSelectedPoll(poll);
            setSidebarOpen(false);
          }}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 text-white shadow">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded hover:bg-slate-700 transition"
            aria-label="Menü öffnen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-sm truncate">
            {selectedPoll?.label ?? selectedPeriod?.label ?? 'Parlament wählen'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedPoll ? (
            <VoteDetail
              poll={selectedPoll}
              onBack={() => setSelectedPoll(null)}
            />
          ) : (
            <WelcomeScreen hasPeriod={!!selectedPeriod} />
          )}
        </div>
      </main>
    </div>
  );
}

