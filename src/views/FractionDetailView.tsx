import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, TrendingUp, Vote, Coins, BarChart3 } from 'lucide-react';
import type { Parliament, ParliamentPeriod, Poll, VoteResult, CandidacyMandate, DawumData } from '../types/api';
import { computeFractionStats, fractionColors, voteLabel, voteBadge } from '../utils/voteUtils';
import { api, extractLabel } from '../api/client';
import { getDawumFullData, AW_TO_DAWUM } from '../api/dawum';
import { findPeriodElectionResultForParty } from '../data/elections';
import { config } from '../config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

/** Map a fraction name to donation JSON `party` field values */
function fractionToPartyKeys(name: string): string[] {
  const n = name.toLowerCase();
  if (n.includes('cdu') && n.includes('csu')) return ['CDU', 'CSU'];
  if (n.includes('cdu'))   return ['CDU'];
  if (n.includes('csu'))   return ['CSU'];
  if (n.includes('spd'))   return ['SPD'];
  if (n.includes('fdp'))   return ['FDP'];
  if (n.includes('grün') || n.includes('bündnis') || n.includes('b90')) return ['Grüne'];
  if (n.includes('linke')) return ['Linke'];
  if (n.includes('afd'))   return ['AfD'];
  if (n.includes('bsw'))   return ['BSW'];
  if (n.includes('ssw'))   return ['SSW'];
  if (n.includes('freie wähler')) return ['Freie Wähler'];
  return [];
}

/** Find the dawum party ID whose shortcut best matches a fraction name */
function matchPartyId(
  fractionName: string,
  parties: Record<string, { Shortcut: string; Name: string }>,
): string | null {
  const n = fractionName.toLowerCase();
  for (const [id, p] of Object.entries(parties)) {
    if (p.Shortcut.toLowerCase() === n) return id;
  }
  for (const [id, p] of Object.entries(parties)) {
    const sc = p.Shortcut.toLowerCase();
    if (n.includes(sc) || sc.includes(n)) return id;
  }
  const aliases: Record<string, string[]> = {
    grüne: ['grün', 'bündnis', 'b90'],
    linke: ['die linke'],
    'cdu/csu': ['cdu', 'csu'],
    bsw: ['wagenknecht'],
  };
  for (const [id, p] of Object.entries(parties)) {
    const sc = p.Shortcut.toLowerCase();
    const alts = aliases[sc] ?? [];
    if (alts.some(a => n.includes(a))) return id;
  }
  return null;
}

interface DawumStats {
  currentForecast: number | null;
  latestSurveyDate: string | null;
  latestSurveyPeriod: { start: string; end: string } | null;
  latestInstituteName: string | null;
  lastElectionResult: number | null;
  electionDate: string | null;
  electionYear: number | null;
}

function computeDawumStats(
  fractionName: string,
  parliament: Parliament,
  dawum: DawumData,
  period?: ParliamentPeriod,
): DawumStats {
  const empty: DawumStats = {
    currentForecast: null, latestSurveyDate: null, latestSurveyPeriod: null,
    latestInstituteName: null, lastElectionResult: null, electionDate: null, electionYear: null,
  };

  // Election result comes from the curated elections table — dawum.de doesn't publish
  // official results, so we can't derive it from survey data.
  const electionMatch = findPeriodElectionResultForParty(
    parliament.label,
    period?.start_date_period,
    fractionName,
  );

  const dawumParliamentId = AW_TO_DAWUM[parliament.label_external_long ?? '']
    ?? AW_TO_DAWUM[parliament.label ?? ''];
  if (!dawumParliamentId) {
    if (!electionMatch) return empty;
    return {
      ...empty,
      lastElectionResult: electionMatch.result,
      electionDate: electionMatch.election.date,
      electionYear: new Date(electionMatch.election.date).getFullYear(),
    };
  }
  const partyId = matchPartyId(fractionName, dawum.parties);

  // Constrain to the selected period's end date (if period has ended, only show data up to that date)
  const today = new Date().toISOString().slice(0, 10);
  const cutoffDate = period?.end_date_period && period.end_date_period < today
    ? period.end_date_period
    : today;

  const latestForecast = partyId
    ? dawum.surveys
      .filter(s => s.parliament_id === dawumParliamentId && s.results[partyId] != null && s.date <= cutoffDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    : undefined;

  return {
    currentForecast: latestForecast && partyId ? latestForecast.results[partyId] ?? null : null,
    latestSurveyDate: latestForecast?.survey_period?.end ?? latestForecast?.date ?? null,
    latestSurveyPeriod: latestForecast?.survey_period ?? null,
    latestInstituteName: latestForecast
      ? (dawum.institutes[latestForecast.institute_id]?.Name ?? null)
      : null,
    lastElectionResult: electionMatch?.result ?? null,
    electionDate: electionMatch?.election.date ?? null,
    electionYear: electionMatch ? new Date(electionMatch.election.date).getFullYear() : null,
  };
}

interface DonationStats {
  currentYearTotal: number;
  currentYearCount: number;
  periodTotal: number;
  periodCount: number;
}

interface FractionDetailViewProps {
  fractionId: number;
  fractionName: string;
  period: ParliamentPeriod;
  parliament: Parliament;
  onBack: () => void;
  onSelectMember: (mandateId: number, mandateName: string, fractionName: string) => void;
  onSelectPoll: (poll: Poll) => void;
  contextVotes?: VoteResult[];
  contextPoll?: Poll;
}

export function FractionDetailView({
  fractionId,
  fractionName,
  period,
  parliament,
  onBack,
  onSelectMember,
  contextVotes,
  contextPoll,
}: FractionDetailViewProps) {
  const colors = fractionColors(fractionName);
  const isBundestag = parliament.id === 5;
  const today = new Date().toISOString().slice(0, 10);
  const isPastPeriod = !!period.end_date_period && period.end_date_period < today;
  const todayYear = new Date().getFullYear();
  // For donation KPI: use the period's last year if it has ended, otherwise current year
  const activeYear = period.end_date_period && period.end_date_period < today
    ? new Date(period.end_date_period).getFullYear()
    : todayYear;

  const [apiMembers,     setApiMembers]     = useState<CandidacyMandate[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [dawumStats,     setDawumStats]     = useState<DawumStats | null>(null);
  const [donationStats,  setDonationStats]  = useState<DonationStats | null>(null);

  // Load members when there is no vote context
  useEffect(() => {
    if (contextVotes && contextVotes.length > 0) return;
    setLoadingMembers(true);
    setApiMembers([]);

    const loadAll = async (): Promise<CandidacyMandate[]> => {
      return api.getAllMandatesForPeriod(period.id);
    };

    loadAll()
      .then((all) => {
        // Dedup by politician.id before filtering by fraction
        const seen = new Set<number>();
        const unique = all.filter((m) => {
          const pid = m.politician?.id ?? m.id;
          if (seen.has(pid)) return false;
          seen.add(pid);
          return true;
        });
        const members = unique.filter((m) =>
          m.fraction_membership?.some((fm) => fm.fraction.id === fractionId)
        );
        // Sort alphabetically
        members.sort((a, b) => extractLabel(a.label).localeCompare(extractLabel(b.label), 'de'));
        setApiMembers(members);
      })
      .finally(() => setLoadingMembers(false));
  }, [period.id, fractionId, contextVotes]);

  // Load dawum stats — filtered to the selected period
  useEffect(() => {
    getDawumFullData()
      .then(data => setDawumStats(computeDawumStats(fractionName, parliament, data, period)))
      .catch(() => {});
  }, [fractionName, parliament, period.id]);

  // Load donation stats (Bundestag only, privacy mode off)
  useEffect(() => {
    if (!isBundestag || config.privacyMode) return;
    const partyKeys = fractionToPartyKeys(fractionName);
    if (partyKeys.length === 0) return;

    // Exact period boundaries (not just year boundaries)
    const periodStart = period.start_date_period ?? '';
    const periodEnd = period.end_date_period && period.end_date_period < today
      ? period.end_date_period
      : today;
    const activeYearStart = `${activeYear}-01-01`;

    // Load all year files that overlap with the period
    const periodStartYear = periodStart ? new Date(periodStart).getFullYear() : activeYear;
    const periodEndYear = new Date(periodEnd).getFullYear();
    const yearsToLoad: number[] = [];
    for (let y = periodStartYear; y <= periodEndYear; y++) yearsToLoad.push(y);

    Promise.all(
      yearsToLoad.map(y =>
        fetch(`${import.meta.env.BASE_URL}data/donations/${y}.json`).then(r => r.ok ? r.json() : null).catch(() => null)
      )
    ).then(results => {
      let currentYearTotal = 0, currentYearCount = 0, periodTotal = 0, periodCount = 0;
      for (const res of results) {
        if (!res?.donations) continue;
        for (const d of res.donations as { party: string; amount: number; date: string }[]) {
          if (!partyKeys.includes(d.party)) continue;
          // Filter by exact period dates
          if (d.date < periodStart || d.date > periodEnd) continue;
          periodTotal += d.amount;
          periodCount++;
          if (d.date >= activeYearStart) { currentYearTotal += d.amount; currentYearCount++; }
        }
      }
      setDonationStats({ currentYearTotal, currentYearCount, periodTotal, periodCount });
    });
  }, [isBundestag, fractionName, period, activeYear, today]);

  // From vote context: per-member vote list for this fraction
  const fractionVotes = (contextVotes ?? []).filter((v) => v.fraction.id === fractionId);

  // Compute stats for this fraction from context votes
  const allStats = contextVotes ? computeFractionStats(contextVotes) : [];
  const stats = allStats.find((s) => s.fractionId === fractionId);

  // Members to display in table
  const membersFromVotes = fractionVotes.length > 0;
  const membersFromApi = !membersFromVotes && apiMembers.length > 0;

  // Dynamic KPI cards
  const kpis = useMemo(() => {
    const cards: { label: string; value: string; sub?: string; icon: React.ReactNode }[] = [];
    if (!isPastPeriod && dawumStats?.currentForecast != null) {
      // Format the survey period: "DD. Mon YYYY – DD. Mon YYYY" or single date
      let surveySub: string | undefined;
      if (dawumStats.latestSurveyPeriod) {
        const { start, end } = dawumStats.latestSurveyPeriod;
        const fmtDate = (d: string) =>
          new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
        surveySub = start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`;
      } else if (dawumStats.latestSurveyDate) {
        surveySub = new Date(dawumStats.latestSurveyDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      if (dawumStats.latestInstituteName) {
        surveySub = surveySub ? `${dawumStats.latestInstituteName} · ${surveySub}` : dawumStats.latestInstituteName;
      }
      cards.push({
        label: 'Aktuelle Prognose',
        value: `${dawumStats.currentForecast.toFixed(1)}\u202f%`,
        sub: surveySub,
        icon: <TrendingUp className="w-4 h-4 text-blue-500" />,
      });
    }
    if (dawumStats?.lastElectionResult != null) {
      const electionLabel = dawumStats.electionYear
        ? `Wahlergebnis ${dawumStats.electionYear}`
        : 'Letztes Wahlergebnis';
      cards.push({
        label: electionLabel,
        value: `${dawumStats.lastElectionResult.toFixed(1)}\u202f%`,
        sub: dawumStats.electionDate
          ? new Date(dawumStats.electionDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
          : undefined,
        icon: <Vote className="w-4 h-4 text-slate-400" />,
      });
    }
    if (donationStats && donationStats.currentYearTotal > 0) {
      cards.push({
        label: `Spenden ${activeYear}`,
        value: fmt(donationStats.currentYearTotal),
        sub: `${donationStats.currentYearCount} Spende(n)`,
        icon: <Coins className="w-4 h-4 text-amber-500" />,
      });
    }
    if (donationStats && donationStats.periodTotal > 0 && donationStats.periodTotal !== donationStats.currentYearTotal) {
      cards.push({
        label: 'Spenden Legislatur',
        value: fmt(donationStats.periodTotal),
        sub: `${donationStats.periodCount} Spende(n)`,
        icon: <BarChart3 className="w-4 h-4 text-slate-400" />,
      });
    }
    return cards;
  }, [dawumStats, donationStats, activeYear, isPastPeriod]);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Zurück
      </button>

      {/* Header card */}
      <div className={`rounded-xl border ${colors.border} ${colors.bg} p-5 mb-5`}>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className={`text-2xl font-bold ${colors.text}`}>{fractionName}</h1>
          {stats && <span className="text-sm text-slate-500">{stats.total} Mitglieder</span>}
          {!stats && membersFromApi && (
            <span className="text-sm text-slate-500">{apiMembers.length} Mitglieder</span>
          )}
        </div>
        {contextPoll && (
          <p className="text-sm text-slate-500 mt-1">
            In Abstimmung: <span className="font-medium text-slate-700">{contextPoll.label}</span>
          </p>
        )}
      </div>

      {/* Dynamic KPI row (dawum + donations) */}
      {kpis.length > 0 && (
        <div className={`grid gap-3 mb-5 ${kpis.length <= 2 ? 'grid-cols-2' : kpis.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {kpis.map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-1.5 mb-1.5">{kpi.icon}<span className="text-xs text-slate-500">{kpi.label}</span></div>
              <div className="text-xl font-bold text-slate-800 leading-tight">{kpi.value}</div>
              {kpi.sub && <div className="text-xs text-slate-400 mt-0.5">{kpi.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Stats row — only when from a vote */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-0.5">Mitglieder</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <div className={`text-2xl font-bold ${
              stats.majority === 'yes' ? 'text-emerald-600' :
              stats.majority === 'no' ? 'text-red-600' :
              stats.majority === 'abstain' ? 'text-amber-600' : 'text-slate-500'
            }`}>
              {stats.majority === 'yes' ? 'Ja' :
               stats.majority === 'no' ? 'Nein' :
               stats.majority === 'abstain' ? 'Enthaltung' : 'Gemischt'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Mehrheit</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="text-2xl font-bold text-slate-800">{stats.cohesion}%</div>
            <div className="text-xs text-slate-500 mt-0.5">Kohäsion</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <div className={`text-2xl font-bold ${stats.deviants.length > 0 ? 'text-orange-500' : 'text-slate-800'}`}>
              {stats.deviants.length}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Abweichler</div>
          </div>
        </div>
      )}

      {/* In-poll result bar */}
      {stats && contextPoll && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Ergebnis in dieser Abstimmung</h2>
          <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
            {stats.yes > 0 && <div className="bg-emerald-500" style={{ width: `${(stats.yes / stats.total) * 100}%` }} />}
            {stats.no > 0 && <div className="bg-red-500" style={{ width: `${(stats.no / stats.total) * 100}%` }} />}
            {stats.abstain > 0 && <div className="bg-amber-400" style={{ width: `${(stats.abstain / stats.total) * 100}%` }} />}
            {stats.no_show > 0 && <div className="bg-slate-300" style={{ width: `${(stats.no_show / stats.total) * 100}%` }} />}
          </div>
          <div className="flex gap-4 mt-2 flex-wrap text-xs text-slate-500">
            {stats.yes > 0 && <span className="text-emerald-700">Ja: {stats.yes}</span>}
            {stats.no > 0 && <span className="text-red-700">Nein: {stats.no}</span>}
            {stats.abstain > 0 && <span className="text-amber-700">Enthaltung: {stats.abstain}</span>}
            {stats.no_show > 0 && <span className="text-slate-500">Abwesend: {stats.no_show}</span>}
          </div>
          {stats.deviants.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Abweichler:</p>
              <div className="flex flex-wrap gap-2">
                {stats.deviants.map((d) => (
                  <span key={d.name} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${voteBadge(d.vote)}`}>
                    {d.name}
                    <span className="opacity-70">· {voteLabel(d.vote)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members from vote context */}
      {membersFromVotes && (
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Mitglieder in dieser Abstimmung</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-center">Stimme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...fractionVotes]
                  .sort((a, b) => extractLabel(a.mandate.label).localeCompare(extractLabel(b.mandate.label), 'de'))
                  .map((v) => {
                  const name = extractLabel(v.mandate.label);
                  return (
                    <tr
                      key={v.id}
                      onClick={() => onSelectMember(v.mandate.id, name, fractionName)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-medium text-blue-700 hover:underline">{name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${voteBadge(v.vote)}`}>
                          {voteLabel(v.vote)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Members from API (no vote context) */}
      {membersFromApi && (
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Aktuelle Mitglieder</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Wahlkreis / Liste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apiMembers.map((m) => {
                  const name = extractLabel(m.label);
                  const seat = m.electoral_data?.constituency?.label
                    ?? m.electoral_data?.electoral_list?.label
                    ?? '—';
                  return (
                    <tr
                      key={m.id}
                      onClick={() => onSelectMember(m.id, name, fractionName)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-medium text-blue-700 hover:underline">{name}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{seat}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading members from API */}
      {loadingMembers && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}
