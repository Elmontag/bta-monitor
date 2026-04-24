import { useState, useEffect, useMemo } from 'react';
import { ExternalLink, Calendar, TrendingUp, Coins, BarChart3, Hash, Lock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Donation } from '../../data/donations';
import { fractionColors } from '../../utils/voteUtils';
import { config } from '../../config';

interface DonationsManifest {
  years: number[];
  lastUpdated: string;
  totalCount: number;
}

interface DonationsTabProps {
  onSelectFraction?: (fractionId: number, fractionName: string) => void;
}

type SortKey = 'date' | 'amount';
type SortDir = 'asc' | 'desc';

const PARTY_HEX: Record<string, string> = {
  CDU: '#57534e', CSU: '#0284c7', SPD: '#ef4444', FDP: '#eab308',
  Grüne: '#22c55e', AfD: '#0ea5e9', Linke: '#ec4899', BSW: '#a855f7',
  SSW: '#6366f1', MLPD: '#f97316',
};

function partyHex(party: string) { return PARTY_HEX[party] ?? '#94a3b8'; }
function fmt(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export function DonationsTab({ onSelectFraction: _onSelectFraction }: DonationsTabProps) {
  // Privacy mode: show no donor data at all
  if (config.privacyMode) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <Lock className="w-6 h-6 text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-700">Datenschutzmodus aktiv</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Spenderdaten werden aus Datenschutzgründen nicht geladen.
            Zum Aktivieren <code className="text-xs bg-slate-100 px-1 rounded">VITE_PRIVACY_MODE=false</code> setzen.
          </p>
        </div>
        <a
          href="https://www.bundestag.de/parlament/praesidium/parteienfinanzierung/fundstellen50000"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mt-2"
        >
          <ExternalLink className="w-3 h-3" />
          Quellseite Bundestag
        </a>
      </div>
    );
  }

  const [manifest, setManifest] = useState<DonationsManifest | null>(null);
  const [loadedData, setLoadedData] = useState<Record<number, Donation[]>>({});
  const [loadingYears, setLoadingYears] = useState<Set<number>>(new Set());
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Load manifest on mount
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/donations/manifest.json`)
      .then((r) => r.json())
      .then((m: DonationsManifest) => {
        setManifest(m);
        // Pre-load the two most recent years
        const toLoad = m.years.slice(0, 2);
        toLoad.forEach(loadYear);
      })
      .catch(() => {
        // Fallback: use static TS data if JSON not available
        import('../../data/donations').then(({ DONATIONS, DONATIONS_LAST_UPDATED }) => {
          const byYear: Record<number, Donation[]> = {};
          for (const d of DONATIONS) {
            (byYear[d.year] ??= []).push(d);
          }
          setLoadedData(byYear);
          setManifest({
            years: Object.keys(byYear).map(Number).sort((a, b) => b - a),
            lastUpdated: DONATIONS_LAST_UPDATED,
            totalCount: DONATIONS.length,
          });
        });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadYear(year: number) {
    if (loadedData[year] !== undefined || loadingYears.has(year)) return;
    setLoadingYears((s) => new Set(s).add(year));
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/donations/${year}.json`);
      const json = await res.json();
      setLoadedData((prev) => ({ ...prev, [year]: json.donations }));
    } finally {
      setLoadingYears((s) => { const ns = new Set(s); ns.delete(year); return ns; });
    }
  }

  async function handleSelectYear(year: number | null) {
    setSelectedYear(year);
    if (year !== null) await loadYear(year);
    else if (manifest) {
      // Load all years when "all" is selected
      for (const yr of manifest.years) await loadYear(yr);
    }
  }

  const allDonations = useMemo(() => {
    return Object.values(loadedData).flat();
  }, [loadedData]);

  const parties = useMemo(() => {
    return [...new Set(allDonations.map((d) => d.party))].sort();
  }, [allDonations]);

  const filtered = useMemo(() => {
    return allDonations.filter((d) => {
      if (selectedYear !== null && d.year !== selectedYear) return false;
      if (selectedParty !== null && d.party !== selectedParty) return false;
      return true;
    }).sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      if (sortKey === 'date') return mul * a.date.localeCompare(b.date);
      return mul * (a.amount - b.amount);
    });
  }, [allDonations, selectedYear, selectedParty, sortKey, sortDir]);

  const kpis = useMemo(() => {
    if (filtered.length === 0) return { total: 0, avg: 0, median: 0, count: 0 };
    const amounts = filtered.map((d) => d.amount);
    const total = amounts.reduce((s, a) => s + a, 0);
    const avg = Math.round(total / amounts.length);
    const sorted = [...amounts].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    const median = sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
    return { total, avg, median, count: filtered.length };
  }, [filtered]);

  const chartData = useMemo(() => {
    const src = filtered;
    const byParty: Record<string, number> = {};
    for (const d of src) byParty[d.party] = (byParty[d.party] ?? 0) + d.amount;
    return Object.entries(byParty)
      .map(([party, amount]) => ({ party, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  const isLoading = loadingYears.size > 0;
  const years = manifest?.years ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Parteispenden</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Großspenden &gt; 50.000 € · §25 Abs. 3 PartG
            {manifest && ` · Stand: ${new Date(manifest.lastUpdated).toLocaleDateString('de-DE')}`}
          </p>
        </div>
        <a
          href="https://www.bundestag.de/parlament/praesidium/parteienfinanzierung/fundstellen50000"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
        >
          <ExternalLink className="w-3 h-3" />
          Quellseite Bundestag
        </a>
      </div>

      {/* Year filter */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        <button
          onClick={() => handleSelectYear(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedYear === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Alle Jahre
        </button>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => handleSelectYear(y === selectedYear ? null : y)}
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
            selectedParty === null ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Coins,     label: 'Gesamtvolumen', value: fmt(kpis.total) },
          { icon: Hash,      label: 'Anzahl Spenden', value: kpis.count.toLocaleString('de-DE') },
          { icon: TrendingUp,label: 'Durchschnitt',   value: fmt(kpis.avg) },
          { icon: BarChart3, label: 'Median',          value: fmt(kpis.median) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <div className="font-bold text-slate-900 text-sm leading-tight">{value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Gesamtspenden nach Partei {selectedYear ? `(${selectedYear})` : '(alle Jahre)'}
          </h3>
          {isLoading && (
            <div className="h-2 bg-slate-100 rounded animate-pulse mb-2" />
          )}
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="party" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) => typeof v === 'number' ? fmt(v) : String(v)}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.party} fill={partyHex(entry.party)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th
                  className="px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:text-slate-800 whitespace-nowrap"
                  onClick={() => toggleSort('date')}
                >
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Datum {sortKey === 'date' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </span>
                </th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Partei</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Spender</th>
                <th
                  className="px-4 py-3 font-semibold text-slate-600 text-right cursor-pointer hover:text-slate-800 whitespace-nowrap"
                  onClick={() => toggleSort('amount')}
                >
                  Betrag {sortKey === 'amount' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Kategorie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => {
                const colors = fractionColors(d.party);
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(d.date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                        {d.party}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 max-w-xs">
                      {d.donor}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {fmt(d.amount)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        d.category === 'Unternehmen' ? 'bg-blue-50 text-blue-700' :
                        d.category === 'Verband'     ? 'bg-green-50 text-green-700' :
                        d.category === 'Stiftung'    ? 'bg-purple-50 text-purple-700' :
                                                       'bg-slate-100 text-slate-500'
                      }`}>
                        {d.category}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && !isLoading && (
          <div className="text-center py-8 text-slate-400 text-sm">Keine Spenden gefunden.</div>
        )}
        {isLoading && (
          <div className="text-center py-4 text-slate-400 text-sm">Daten werden geladen…</div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Quelle: Bundestag.de · §25 Abs. 3 Parteiengesetz · Jahresattribution nach Eingang der Spende
        {config.privacyMode && ' · Privatpersonen werden anonymisiert dargestellt'}
      </p>
    </div>
  );
}
