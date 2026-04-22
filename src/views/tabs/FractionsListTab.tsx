import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { api, extractLabel } from '../../api/client';
import type { ParliamentPeriod, Fraction } from '../../types/api';
import { fractionColors } from '../../utils/voteUtils';

interface FractionsListTabProps {
  period: ParliamentPeriod;
  onSelectFraction: (id: number, name: string) => void;
}

export function FractionsListTab({ period, onSelectFraction }: FractionsListTabProps) {
  const [fractions, setFractions] = useState<Fraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFractions([]);
    api.getFractionsForPeriod(period.id)
      .then((data) => { setFractions(data); setError(null); })
      .catch(() => setError('Fraktionsdaten konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [period.id]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900 mb-5">Fraktionen</h1>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">{error}</div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && fractions.length === 0 && !error && (
        <div className="text-center py-16 text-slate-500 text-sm">Keine Fraktionsdaten verfügbar.</div>
      )}

      {!loading && fractions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fractions.map((f) => {
            const name = extractLabel(f.label);
            const colors = fractionColors(name);
            return (
              <button
                key={f.id}
                onClick={() => onSelectFraction(f.id, name)}
                className={`text-left p-4 rounded-xl border-l-4 bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow ${colors.border}`}
              >
                <div className={`font-semibold text-sm ${colors.text} mb-2`}>{name}</div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Users className="w-3 h-3" />
                  <span>Fraktion öffnen</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
