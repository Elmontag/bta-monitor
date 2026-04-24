import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, ExternalLink, Vote } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { getDawumFullData, AW_TO_DAWUM, PARTY_COLORS } from '../../api/dawum';
import { findPeriodElection, type ElectionResult } from '../../data/elections';
import type { Parliament, ParliamentPeriod, DawumData, DawumSurvey } from '../../types/api';

interface PollsTrendTabProps {
  parliament: Parliament;
  period: ParliamentPeriod;
}

const MIN_PERCENTAGE = 3;
const INSTITUTE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#64748b'];

function getDawumParliamentId(parliament: Parliament) {
  return Object.entries(AW_TO_DAWUM).find(([key]) =>
    parliament.label.includes(key) || (parliament.label_external_long ?? '').includes(key)
  )?.[1] ?? null;
}

export function PollsTrendTab({ parliament, period }: PollsTrendTabProps) {
  const [dawumData, setDawumData] = useState<DawumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getDawumFullData()
      .then((data) => { setDawumData(data); setError(null); })
      .catch(() => setError('Umfragedaten konnten nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, [parliament.id]);

  const today = new Date().toISOString().slice(0, 10);
  const isPastPeriod = !!period.end_date_period && period.end_date_period < today;
  const cutoffDate = isPastPeriod ? period.end_date_period : today;
  const dawumId = getDawumParliamentId(parliament);

  // Election result is ALWAYS sourced from the curated table, never from dawum.
  // dawum.de does not publish official election results, so mixing them into the
  // same chart as survey forecasts would create misleading empty bars.
  const election: ElectionResult | null = useMemo(
    () => findPeriodElection(parliament.label, period.start_date_period),
    [parliament.label, period.start_date_period],
  );

  const surveysModel = useMemo(() => {
    if (!dawumData || !dawumId) return null;

    const surveys = dawumData.surveys
      .filter((survey) => survey.parliament_id === dawumId && survey.date <= cutoffDate)
      .sort((a, b) => b.date.localeCompare(a.date));

    // For past periods we only want to show the election result card — no survey chart.
    if (isPastPeriod) return { latestSurveys: [] as DawumSurvey[], chartData: [], instituteNames: [] };

    const latestByInstitute = new Map<string, DawumSurvey>();
    for (const survey of surveys) {
      const existing = latestByInstitute.get(survey.institute_id);
      if (!existing || survey.date > existing.date) {
        latestByInstitute.set(survey.institute_id, survey);
      }
    }
    const latestSurveys = Array.from(latestByInstitute.values()).sort((a, b) => b.date.localeCompare(a.date));

    const allPartyIds = new Set<string>();
    for (const survey of latestSurveys) Object.keys(survey.results).forEach((id) => allPartyIds.add(id));

    const partyEntries = Array.from(allPartyIds)
      .map((id) => ({
        id,
        shortcut: dawumData.parties[id]?.Shortcut ?? id,
        latestAverage: latestSurveys.length > 0
          ? latestSurveys.reduce((sum, survey) => sum + (survey.results[id] ?? 0), 0) / latestSurveys.length
          : 0,
      }))
      .filter((party) => party.latestAverage >= MIN_PERCENTAGE)
      .sort((a, b) => b.latestAverage - a.latestAverage);

    const chartData = partyEntries.map((party) => {
      const entry: Record<string, string | number> = { party: party.shortcut };
      for (const survey of latestSurveys) {
        const institute = dawumData.institutes[survey.institute_id]?.Name ?? survey.institute_id;
        entry[institute] = survey.results[party.id] ?? 0;
      }
      return entry;
    });

    return {
      latestSurveys,
      chartData,
      instituteNames: latestSurveys.map((survey) => dawumData.institutes[survey.institute_id]?.Name ?? survey.institute_id),
    };
  }, [cutoffDate, dawumData, dawumId, isPastPeriod]);

  const electionChartData = useMemo(() => {
    if (!election) return [];
    return Object.entries(election.results)
      .filter(([, pct]) => pct >= MIN_PERCENTAGE)
      .sort(([, a], [, b]) => b - a)
      .map(([shortcut, pct]) => ({ party: shortcut, value: pct, color: PARTY_COLORS[shortcut] ?? '#94a3b8' }));
  }, [election]);

  if (!dawumId && !election) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">{isPastPeriod ? 'Wahlergebnisse' : 'Umfragen'}</h1>
        <div className="text-center py-16 text-slate-500 text-sm">
          Keine Daten verfügbar für {parliament.label}.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          {isPastPeriod ? <Vote className="w-5 h-5 text-slate-600" /> : <TrendingUp className="w-5 h-5 text-blue-600" />}
          <h1 className="text-xl font-bold text-slate-900">{isPastPeriod ? 'Wahlergebnis' : 'Umfragen & Wahlergebnis'}</h1>
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

      {error && !election && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {!loading && !election && (!surveysModel || surveysModel.latestSurveys.length === 0) && (
        <div className="text-center py-16 text-slate-500 text-sm">
          {isPastPeriod ? 'Keine Wahlergebnisse verfügbar.' : 'Keine aktuellen Umfragedaten verfügbar.'}
        </div>
      )}

      {/* ─── Wahlergebnis (separate section from forecasts) ─── */}
      {election && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Vote className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Amtliches Wahlergebnis</h2>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
              <div>
                <div className="font-semibold text-slate-800">
                  {new Date(election.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Quelle: <a href={election.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">{election.source}</a>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={electionChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="party" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : String(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {electionChartData.map((entry) => (
                    <Cell key={entry.party} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ─── Umfragen (only for current periods) ─── */}
      {!isPastPeriod && surveysModel && surveysModel.latestSurveys.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Aktuelle Umfragen</h2>
          </div>

          {surveysModel.chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Umfragen je Institut</h3>
              <p className="text-xs text-slate-400 mb-4">Neueste Umfrage je Institut (aktuelle Legislaturperiode)</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={surveysModel.chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="party" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => typeof v === 'number' ? `${v}%` : String(v)} />
                  <Legend />
                  {surveysModel.instituteNames.map((name, index) => (
                    <Bar key={name} dataKey={name} fill={INSTITUTE_COLORS[index % INSTITUTE_COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-4">
            {surveysModel.latestSurveys.map((survey) => {
              const institute = dawumData?.institutes[survey.institute_id]?.Name ?? survey.institute_id;
              return (
                <div key={survey.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-slate-700 text-sm">{institute}</span>
                    <div className="text-xs text-slate-400">
                      {new Date(survey.date).toLocaleDateString('de-DE')}
                      {survey.surveyed_persons ? ` · n=${survey.surveyed_persons}` : ''}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {Object.entries(survey.results)
                      .filter(([, pct]) => pct >= MIN_PERCENTAGE)
                      .sort(([, a], [, b]) => b - a)
                      .map(([partyId, pct]) => {
                        const shortcut = dawumData?.parties[partyId]?.Shortcut ?? partyId;
                        const color = PARTY_COLORS[shortcut] ?? '#94a3b8';
                        const electionPct = election?.results[shortcut];
                        return (
                          <div key={partyId} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="font-medium text-slate-700 w-12 truncate">{shortcut}</span>
                            <span className="text-slate-500">{pct}%</span>
                            {electionPct != null && (
                              <span className="text-[11px] text-slate-400">(Wahl: {electionPct.toFixed(1)}%)</span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Umfragedaten von{' '}
        <a href="https://dawum.de" target="_blank" rel="noopener noreferrer" className="underline">
          dawum.de
        </a>{' '}
        (Open Database License ODC-ODbL)
        {election && (
          <>
            {' · '}Wahlergebnis:{' '}
            <a href={election.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {election.source}
            </a>
          </>
        )}
      </p>
    </div>
  );
}
