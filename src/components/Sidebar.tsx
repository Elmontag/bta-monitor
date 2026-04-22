import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Parliament, ParliamentPeriod, Poll } from '../types/api';

interface SidebarProps {
  selectedPeriod: ParliamentPeriod | null;
  selectedPoll: Poll | null;
  onPeriodSelect: (period: ParliamentPeriod) => void;
  onPollSelect: (poll: Poll) => void;
}

type FilterType = 'all' | 'named' | 'unnamed';

export function Sidebar({ selectedPeriod, selectedPoll, onPeriodSelect, onPollSelect }: SidebarProps) {
  const [parliaments, setParliaments] = useState<Parliament[]>([]);
  const [periods, setPeriods] = useState<ParliamentPeriod[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [totalPolls, setTotalPolls] = useState(0);
  const [rangeStart, setRangeStart] = useState(0);
  const [selectedParl, setSelectedParl] = useState<Parliament | null>(null);
  const [showParliamentPicker, setShowParliamentPicker] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loadingParliaments, setLoadingParliaments] = useState(true);
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 50;

  // Load parliaments on mount
  useEffect(() => {
    api.getParliaments()
      .then((data) => {
        setParliaments(data);
        // Default: Bundestag (id=5)
        const bundestag = data.find((p) => p.id === 5) ?? data[0];
        if (bundestag) setSelectedParl(bundestag);
      })
      .catch(() => setError('Parlamente konnten nicht geladen werden.'))
      .finally(() => setLoadingParliaments(false));
  }, []);

  // Load periods when parliament changes
  useEffect(() => {
    if (!selectedParl) return;
    api.getParliamentPeriods(selectedParl.id)
      .then((data) => {
        setPeriods(data);
        if (data.length > 0 && !selectedPeriod) {
          onPeriodSelect(data[0]);
        }
      })
      .catch(() => setError('Perioden konnten nicht geladen werden.'));
  }, [selectedParl?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load polls when period changes
  const loadPolls = useCallback(async (period: ParliamentPeriod, start: number) => {
    if (start === 0) {
      setPolls([]);
      setRangeStart(0);
    }
    setLoadingPolls(true);
    try {
      const { polls: data, total } = await api.getPolls(period.id, start, start + PAGE_SIZE);
      if (start === 0) {
        setPolls(data);
      } else {
        setPolls((prev) => [...prev, ...data]);
      }
      setTotalPolls(total);
      setRangeStart(start + data.length);
    } catch {
      setError('Abstimmungen konnten nicht geladen werden.');
    } finally {
      setLoadingPolls(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPeriod) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPolls(selectedPeriod, 0);
  }, [selectedPeriod?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPolls = polls.filter((p) => {
    if (filter === 'named') return p.field_intro?.toLowerCase().includes('namentlich');
    if (filter === 'unnamed') return !p.field_intro?.toLowerCase().includes('namentlich');
    return true;
  });

  const isNamed = (poll: Poll) =>
    poll.field_intro?.toLowerCase().includes('namentlich') ?? false;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-slate-700/60">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📊</span>
          <h1 className="text-base font-bold text-white leading-tight">
            Parlamentabstimmungen
          </h1>
        </div>
        <p className="text-xs text-slate-400">Abstimmungsverhalten visualisieren</p>
      </div>

      {/* Parliament picker */}
      <div className="px-4 pt-3 pb-2 border-b border-slate-700/60">
        {loadingParliaments ? (
          <div className="h-8 bg-slate-700 rounded animate-pulse" />
        ) : (
          <div>
            <button
              onClick={() => setShowParliamentPicker(!showParliamentPicker)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-sm"
            >
              <span className="text-white font-medium truncate">
                {selectedParl?.label_external_long ?? selectedParl?.label ?? '— Parlament wählen —'}
              </span>
              <svg
                className={`w-4 h-4 text-slate-400 flex-shrink-0 ml-2 transition-transform ${showParliamentPicker ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showParliamentPicker && (
              <div className="mt-1 rounded-lg bg-slate-800 overflow-hidden border border-slate-700 shadow-xl max-h-60 overflow-y-auto">
                {parliaments.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedParl(p);
                      setShowParliamentPicker(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition hover:bg-slate-700 ${
                      selectedParl?.id === p.id ? 'bg-slate-700 text-blue-300' : 'text-slate-200'
                    }`}
                  >
                    {p.label_external_long ?? p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Period picker */}
      {periods.length > 0 && (
        <div className="px-4 pt-2 pb-2 border-b border-slate-700/60">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">Legislaturperiode</p>
          <div className="flex flex-col gap-1">
            {periods.slice(0, 6).map((period) => (
              <button
                key={period.id}
                onClick={() => onPeriodSelect(period)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition ${
                  selectedPeriod?.id === period.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vote filter tabs */}
      {selectedPeriod && (
        <div className="px-4 pt-3 pb-2 border-b border-slate-700/60">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
            Abstimmungen{totalPolls > 0 && <span className="ml-1 text-slate-400">({totalPolls})</span>}
          </p>
          <div className="flex gap-1">
            {(['all', 'named', 'unnamed'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1 text-xs rounded transition ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {f === 'all' ? 'Alle' : f === 'named' ? 'Namentlich' : 'Anonym'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Poll list */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-xs">
            {error}
          </div>
        )}

        {loadingPolls && polls.length === 0 && (
          <div className="px-4 pt-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        <div className="px-2 pt-2 pb-2 space-y-0.5">
          {filteredPolls.map((poll) => {
            const named = isNamed(poll);
            return (
              <button
                key={poll.id}
                onClick={() => onPollSelect(poll)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition group ${
                  selectedPoll?.id === poll.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${
                    poll.field_accepted ? 'bg-emerald-400' : 'bg-red-400'
                  } ${selectedPoll?.id === poll.id ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight line-clamp-2">{poll.label}</div>
                    <div className={`flex items-center gap-2 mt-1 flex-wrap`}>
                      {poll.field_poll_date && (
                        <span className={`text-xs ${selectedPoll?.id === poll.id ? 'text-blue-200' : 'text-slate-500'}`}>
                          {new Date(poll.field_poll_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      )}
                      {named && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          selectedPoll?.id === poll.id
                            ? 'bg-blue-500 text-blue-100'
                            : 'bg-slate-700 text-slate-400'
                        }`}>
                          namentlich
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Load more */}
        {polls.length < totalPolls && (
          <div className="px-4 pb-4">
            <button
              onClick={() => selectedPeriod && loadPolls(selectedPeriod, rangeStart)}
              disabled={loadingPolls}
              className="w-full py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loadingPolls ? 'Laden…' : `Mehr laden (${totalPolls - polls.length} weitere)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
