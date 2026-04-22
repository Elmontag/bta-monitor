import { useState, useRef, useEffect } from 'react';
import type { Parliament, ParliamentPeriod } from '../types/api';

interface NavbarProps {
  parliaments: Parliament[];
  periods: ParliamentPeriod[];
  selectedParliament: Parliament | null;
  selectedPeriod: ParliamentPeriod | null;
  loading: boolean;
  onParliamentChange: (p: Parliament) => void;
  onPeriodChange: (p: ParliamentPeriod) => void;
  breadcrumb?: React.ReactNode;
}

export function Navbar({
  parliaments,
  periods,
  selectedParliament,
  selectedPeriod,
  loading,
  onParliamentChange,
  onPeriodChange,
  breadcrumb,
}: NavbarProps) {
  const [parlOpen, setParlOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const parlRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (parlRef.current && !parlRef.current.contains(e.target as Node)) setParlOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const VISIBLE_PERIODS = 4;
  const visiblePeriods = periods.slice(0, VISIBLE_PERIODS);
  const extraPeriods = periods.slice(VISIBLE_PERIODS);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="h-14 flex items-center gap-4 px-4 max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xl">📊</span>
          <span className="font-bold text-slate-800 text-sm hidden sm:block">Abstimmungen</span>
        </div>

        <div className="h-5 w-px bg-slate-200 flex-shrink-0" />

        {/* Parliament selector */}
        <div className="relative flex-shrink-0" ref={parlRef}>
          {loading ? (
            <div className="h-8 w-40 bg-slate-100 rounded animate-pulse" />
          ) : (
            <button
              onClick={() => setParlOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200"
            >
              <span className="max-w-[160px] truncate">
                {selectedParliament?.label ?? '— Parlament —'}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${parlOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {parlOpen && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto py-1">
              {parliaments.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onParliamentChange(p); setParlOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                    selectedParliament?.id === p.id ? 'text-blue-600 font-medium bg-blue-50' : 'text-slate-700'
                  }`}
                >
                  {p.label_external_long ?? p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Period chips */}
        {periods.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0 hide-scrollbar">
            {visiblePeriods.map((period) => (
              <button
                key={period.id}
                onClick={() => onPeriodChange(period)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedPeriod?.id === period.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {period.label}
              </button>
            ))}

            {extraPeriods.length > 0 && (
              <div className="relative flex-shrink-0" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen((o) => !o)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    moreOpen ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ···
                </button>
                {moreOpen && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
                    {extraPeriods.map((period) => (
                      <button
                        key={period.id}
                        onClick={() => { onPeriodChange(period); setMoreOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                          selectedPeriod?.id === period.id ? 'text-blue-600 font-medium' : 'text-slate-700'
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      {breadcrumb && (
        <div className="h-8 flex items-center px-4 max-w-7xl mx-auto border-t border-slate-100">
          {breadcrumb}
        </div>
      )}
    </header>
  );
}
