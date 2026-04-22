import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { api, extractLabel } from '../../api/client';
import type { ParliamentPeriod, CandidacyMandate } from '../../types/api';

interface MembersListTabProps {
  period: ParliamentPeriod;
  onSelectMember: (mandateId: number, name: string, fractionName: string) => void;
}

export function MembersListTab({ period, onSelectMember }: MembersListTabProps) {
  const [mandates, setMandates] = useState<CandidacyMandate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rangeStart, setRangeStart] = useState(0);

  useEffect(() => {
    setLoading(true);
    setMandates([]);
    setRangeStart(0);
    setSearch('');
    api.getMandatesForPeriod(period.id, 0, 100)
      .then(({ mandates: data, total: t }) => {
        setMandates(data);
        setTotal(t);
        setRangeStart(data.length);
        setError(null);
      })
      .catch(() => setError('Abgeordnetendaten konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [period.id]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const { mandates: more, total: t } = await api.getMandatesForPeriod(period.id, rangeStart, rangeStart + 100);
      setMandates((prev) => [...prev, ...more]);
      setTotal(t);
      setRangeStart((s) => s + more.length);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = mandates.filter((m) => {
    if (!search) return true;
    return extractLabel(m.label).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-baseline gap-3 flex-wrap mb-5">
        <h1 className="text-xl font-bold text-slate-900">Abgeordnete</h1>
        {total > 0 && (
          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-sm rounded-full font-medium">
            {total} gesamt
          </span>
        )}
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="Name suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">{error}</div>
      )}

      {loading && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">Keine Abgeordneten gefunden.</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Fraktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((m) => {
                    const name = extractLabel(m.label);
                    const fractionName = m.fraction_membership?.[0]
                      ? extractLabel(m.fraction_membership[0].fraction.label)
                      : '—';
                    return (
                      <tr
                        key={m.id}
                        onClick={() => onSelectMember(m.id, name, fractionName)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-2.5 font-medium text-blue-700">{name}</td>
                        <td className="px-4 py-2.5 text-slate-500">{fractionName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {mandates.length < total && !search && (
            <div className="mt-5 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Laden...' : `Mehr laden (${total - mandates.length} weitere)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
