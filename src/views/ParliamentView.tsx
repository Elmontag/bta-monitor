import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Parliament, ParliamentPeriod, Poll } from '../types/api';
import { VoteCard } from '../components/VoteCard';

interface ParliamentViewProps {
  period: ParliamentPeriod;
  parliament: Parliament;
  onSelectPoll: (poll: Poll) => void;
}

type AcceptedFilter = 'all' | 'accepted' | 'rejected';

const PAGE_SIZE = 50;

export function ParliamentView({ period, parliament, onSelectPoll }: ParliamentViewProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [total, setTotal] = useState(0);
  const [rangeStart, setRangeStart] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AcceptedFilter>('all');
  const [search, setSearch] = useState('');

  const loadPolls = useCallback(async (periodId: number, start: number, append: boolean) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const { polls: data, total: t } = await api.getPolls(periodId, start, start + PAGE_SIZE);
      if (append) {
        setPolls((prev) => [...prev, ...data]);
      } else {
        setPolls(data);
        setTotal(t);
        setRangeStart(data.length);
      }
      setTotal(t);
      setRangeStart(start + data.length);
      setError(null);
    } catch {
      setError('Abstimmungen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPolls([]);
    setRangeStart(0);
    setSearch('');
    setFilter('all');
    loadPolls(period.id, 0, false);
  }, [period.id, loadPolls]);

  const filtered = polls.filter((p) => {
    const matchFilter =
      filter === 'all' ||
      (filter === 'accepted' && p.field_accepted) ||
      (filter === 'rejected' && !p.field_accepted);
    const matchSearch =
      !search ||
      p.label.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900">Abstimmungen</h1>
          {total > 0 && (
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-sm rounded-full font-medium">
              {total} gesamt
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          {parliament.label} · {period.label}
        </p>
      </div>

      {/* Filter + search row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1">
          {(['all', 'accepted', 'rejected'] as AcceptedFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'Alle' : f === 'accepted' ? 'Angenommen' : 'Abgelehnt'}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Abstimmung suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Poll list */}
      {!loading && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              Keine Abstimmungen gefunden.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((poll) => (
                <VoteCard key={poll.id} poll={poll} onClick={() => onSelectPoll(poll)} />
              ))}
            </div>
          )}

          {polls.length < total && !search && filter === 'all' && (
            <div className="mt-5 text-center">
              <button
                onClick={() => loadPolls(period.id, rangeStart, true)}
                disabled={loadingMore}
                className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Laden…' : `Mehr laden (${total - polls.length} weitere)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
