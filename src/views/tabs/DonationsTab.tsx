import { useState, useMemo } from 'react';
import { ExternalLink, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DONATIONS } from '../../data/donations';
import { fractionColors } from '../../utils/voteUtils';

interface DonationsTabProps {
  onSelectFraction?: (fractionId: number, fractionName: string) => void;
}

type SortKey = 'date' | 'amount';
type SortDir = 'asc' | 'desc';

const PARTY_CHART_COLORS: Record<string, string> = {
  CDU: '#1a1a1a',
  CSU: '#008dd2',
  SPD: '#e3000f',
  FDP: '#d4a800',
  Grüne: '#46962b',
  AfD: '#009ee0',
  Linke: '#be3075',
  BSW: '#702082',
};

function partyColor(party: string): string {
  return PARTY_CHART_COLORS[party] ?? '#94a3b8';
}

export function DonationsTab({ onSelectFraction: _onSelectFraction }: DonationsTabProps) {
  const years = useMemo(() => {
    return [...new Set(DONATIONS.map((d) => d.year))].sort((a, b) => b - a);
  }, []);
  const parties = useMemo(() => {
    return [...new Set(DONATIONS.map((d) => d.party))].sort();
  }, []);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    return DONATIONS.filter((d) => {
      if (selectedYear !== null && d.year !== selectedYear) return false;
      if (selectedParty !== null && d.party !== selectedParty) return false;
      return true;
    }).sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      if (sortKey === 'date') return mul * a.date.localeCompare(b.date);
      return mul * (a.amount - b.amount);
    });
  }, [selectedYear, selectedParty, sortKey, sortDir]);

  const chartData = useMemo(() => {
    const byParty: Record<string, number> = {};
    const source = selectedYear !== null ? DONATIONS.filter((d) => d.year === selectedYear) : DONATIONS;
    for (const d of source) {
      byParty[d.party] = (byParty[d.party] ?? 0) + d.amount;
    }
    return Object.entries(byParty)
      .map(([party, amount]) => ({ party, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [selectedYear]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h1 className="text-xl font-bold text-slate-900">Parteispenden</h1>
        <a
          href="https://www.bundestag.de/parlament/praesidium/parteienfinanzierung/fundstellen50000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
        >
          <ExternalLink className="w-3 h-3" />
          Aktuelle Daten beim Bundestag
        </a>
      </div>

      {/* Year filter */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        <button
          onClick={() => setSelectedYear(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedYear === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Alle Jahre
        </button>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y === selectedYear ? null : y)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedYear === y ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Party filter */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        <button
          onClick={() => setSelectedParty(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedParty === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Alle Parteien
        </button>
        {parties.map((p) => {
          const colors = fractionColors(p);
          return (
            <button
              key={p}
              onClick={() => setSelectedParty(p === selectedParty ? null : p)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedParty === p
                  ? `${colors.bg} ${colors.text} ${colors.border}`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-transparent'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Gesamtspenden nach Partei {selectedYear ? `(${selectedYear})` : '(alle Jahre)'}
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="party" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(v) =>
                typeof v === 'number'
                  ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)
                  : String(v)
              }
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.party} fill={partyColor(entry.party)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th
                className="px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:text-slate-800"
                onClick={() => toggleSort('date')}
              >
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Datum {sortKey === 'date' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </span>
              </th>
              <th className="px-4 py-3 font-semibold text-slate-600">Partei</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Spender</th>
              <th
                className="px-4 py-3 font-semibold text-slate-600 text-right cursor-pointer hover:text-slate-800"
                onClick={() => toggleSort('amount')}
              >
                Betrag {sortKey === 'amount' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th className="px-4 py-3 font-semibold text-slate-600">Kategorie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((d) => {
              const colors = fractionColors(d.party);
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                    {new Date(d.date).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                      {d.party}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{d.donor}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800 whitespace-nowrap">
                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(d.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{d.category}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">Keine Spenden gefunden.</div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Quelle: Bundestagsdrucksachen (§ 25 Abs. 3 Parteiengesetz) · Daten möglicherweise unvollständig, Stand: 2025
      </p>
    </div>
  );
}
