import { useState, useEffect } from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getDawumData, AW_TO_DAWUM, PARTY_COLORS } from '../../api/dawum';
import type { Parliament, ParliamentPeriod, DawumData, DawumSurvey } from '../../types/api';

interface PollsTrendTabProps {
  parliament: Parliament;
  period: ParliamentPeriod;
}

const MIN_PERCENTAGE = 3;
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export function PollsTrendTab({ parliament, period: _period }: PollsTrendTabProps) {
  const [dawumData, setDawumData] = useState<DawumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getDawumData()
      .then((data) => { setDawumData(data); setError(null); })
      .catch(() => setError('Umfragedaten konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, []);

  const dawumId = Object.entries(AW_TO_DAWUM).find(([key]) =>
    parliament.label.includes(key) || (parliament.label_external_long ?? '').includes(key)
  )?.[1];

  if (!dawumId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Umfragen</h1>
        <div className="text-center py-16 text-slate-500 text-sm">
          Keine Umfragedaten verfügbar für {parliament.label}.
        </div>
      </div>
    );
  }

  const surveys: DawumSurvey[] = (dawumData?.surveys ?? []).filter((s) => s.parliament_id === dawumId);

  const latestByInstitute = new Map<string, DawumSurvey>();
  for (const s of surveys) {
    const existing = latestByInstitute.get(s.institute_id);
    if (!existing || s.date > existing.date) {
      latestByInstitute.set(s.institute_id, s);
    }
  }
  const latestSurveys = Array.from(latestByInstitute.values()).sort((a, b) => b.date.localeCompare(a.date));

  const allPartyIds = new Set<string>();
  for (const s of latestSurveys) {
    Object.keys(s.results).forEach((id) => allPartyIds.add(id));
  }

  const partyEntries = Array.from(allPartyIds)
    .map((id) => ({
      id,
      shortcut: dawumData?.parties[id]?.Shortcut ?? id,
    }))
    .filter((p) => {
      const avg = latestSurveys.reduce((sum, s) => sum + (s.results[p.id] ?? 0), 0) / Math.max(latestSurveys.length, 1);
      return avg >= MIN_PERCENTAGE;
    })
    .sort((a, b) => {
      const avgA = latestSurveys.reduce((sum, s) => sum + (s.results[a.id] ?? 0), 0) / Math.max(latestSurveys.length, 1);
      const avgB = latestSurveys.reduce((sum, s) => sum + (s.results[b.id] ?? 0), 0) / Math.max(latestSurveys.length, 1);
      return avgB - avgA;
    });

  const chartData = partyEntries.map((p) => {
    const entry: Record<string, string | number> = { party: p.shortcut };
    for (const s of latestSurveys) {
      const institute = dawumData?.institutes[s.institute_id]?.Name ?? s.institute_id;
      entry[institute] = s.results[p.id] ?? 0;
    }
    return entry;
  });

  const instituteNames = latestSurveys.map((s) =>
    dawumData?.institutes[s.institute_id]?.Name ?? s.institute_id
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Umfragen</h1>
        </div>
        <a
          href="https://dawum.de"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
        >
          <ExternalLink className="w-3 h-3" />
          dawum.de
        </a>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {!loading && !error && latestSurveys.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm">
          Keine aktuellen Umfragedaten verfügbar.
        </div>
      )}

      {!loading && !error && latestSurveys.length > 0 && (
        <>
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Aktueller Stand nach Institut</h3>
              <p className="text-xs text-slate-400 mb-4">
                Neueste Umfrage je Institut · Parteien mit mind. {MIN_PERCENTAGE}%
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="party" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => typeof v === 'number' ? `${v}%` : String(v)} />
                  <Legend />
                  {instituteNames.map((name, i) => (
                    <Bar key={name} dataKey={name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-4">
            {latestSurveys.map((s) => {
              const institute = dawumData?.institutes[s.institute_id]?.Name ?? s.institute_id;
              return (
                <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-slate-700 text-sm">{institute}</span>
                    <div className="text-xs text-slate-400">
                      {new Date(s.date).toLocaleDateString('de-DE')}
                      {s.surveyed_persons ? ` · n=${s.surveyed_persons}` : ''}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {Object.entries(s.results)
                      .filter(([, pct]) => pct >= MIN_PERCENTAGE)
                      .sort(([, a], [, b]) => b - a)
                      .map(([partyId, pct]) => {
                        const shortcut = dawumData?.parties[partyId]?.Shortcut ?? partyId;
                        const color = PARTY_COLORS[shortcut] ?? '#94a3b8';
                        return (
                          <div key={partyId} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="font-medium text-slate-700 w-12 truncate">{shortcut}</span>
                            <span className="text-slate-500">{pct}%</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Daten von{' '}
            <a href="https://dawum.de" target="_blank" rel="noopener noreferrer" className="underline">
              dawum.de
            </a>{' '}
            (Open Database License ODC-ODbL)
          </p>
        </>
      )}
    </div>
  );
}
