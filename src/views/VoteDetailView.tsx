import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { api, extractLabel } from '../api/client';
import type { Poll, VoteResult, FractionStats } from '../types/api';
import { computePollCounts, computeFractionStats, fractionColors, voteLabel, voteBadge } from '../utils/voteUtils';

interface VoteDetailViewProps {
  poll: Poll;
  onBack: () => void;
  onSelectFraction: (fractionId: number, fractionName: string, votes: VoteResult[]) => void;
  onSelectMember: (mandateId: number, mandateName: string, fractionName: string) => void;
}

type Tab = 'overview' | 'fractions' | 'members';

const CHART_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#94a3b8'];

export function VoteDetailView({ poll, onBack, onSelectFraction, onSelectMember }: VoteDetailViewProps) {
  const [results, setResults] = useState<VoteResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [memberSearch, setMemberSearch] = useState('');
  const [expandedFraction, setExpandedFraction] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api.getVoteResults(poll.id)
      .then((data) => {
        if (!cancelled) {
          setResults(data);
          setError(null);
          setTab('overview');
          setExpandedFraction(null);
          setMemberSearch('');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Stimmdaten konnten nicht geladen werden.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [poll.id]);

  const hasVotes = results.length > 0;
  const counts = computePollCounts(results);
  const fractions = computeFractionStats(results);
  const totalDeviants = fractions.reduce((sum, f) => sum + f.deviants.length, 0);

  const pieData = [
    { name: 'Ja', value: counts.yes },
    { name: 'Nein', value: counts.no },
    { name: 'Enthaltung', value: counts.abstain },
    { name: 'Abwesend', value: counts.no_show },
  ].filter((d) => d.value > 0);

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Ergebnis' },
    ...(!loading && hasVotes ? [
      { id: 'fractions' as Tab, label: `Fraktionen${totalDeviants > 0 ? ` (${totalDeviants})` : ''}` },
      { id: 'members' as Tab, label: `Mitglieder (${results.length})` },
    ] : []),
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück
        </button>

        <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">{poll.label}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold ${
            poll.field_accepted ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
          }`}>
            {poll.field_accepted
              ? <><CircleCheck className="w-4 h-4" /> Angenommen</>
              : <><CircleX className="w-4 h-4" /> Abgelehnt</>
            }
          </span>
          {poll.field_poll_date && (
            <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-600">
              {new Date(poll.field_poll_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          )}
          {poll.field_committees?.[0] && (
            <span className="px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-600">
              {poll.field_committees[0].label}
            </span>
          )}
          {poll.field_topics?.map((t) => (
            <span key={t.id} className="px-2.5 py-1 rounded-full text-xs bg-indigo-50 text-indigo-600">
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {TABS.length > 1 && (
        <div className="flex gap-1 mb-5 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${
                tab === t.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="h-32 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-48 bg-slate-200 rounded-xl animate-pulse" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {tab === 'overview' && (
            <OverviewTab poll={poll} counts={counts} pieData={pieData} hasVotes={hasVotes} />
          )}
          {tab === 'fractions' && (
            <FractionsTab
              fractions={fractions}
              expandedFraction={expandedFraction}
              setExpandedFraction={setExpandedFraction}
              onSelectFraction={(id, name) => onSelectFraction(id, name, results)}
            />
          )}
          {tab === 'members' && (
            <MembersTab
              results={results}
              search={memberSearch}
              onSearchChange={setMemberSearch}
              onSelectMember={onSelectMember}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

interface OverviewTabProps {
  poll: Poll;
  counts: ReturnType<typeof computePollCounts>;
  pieData: { name: string; value: number }[];
  hasVotes: boolean;
}

function OverviewTab({ poll, counts, pieData, hasVotes }: OverviewTabProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ja', count: counts.yes, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Nein', count: counts.no, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
          { label: 'Enthaltung', count: counts.abstain, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Abwesend', count: counts.no_show, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-100' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`rounded-xl border p-4 ${bg}`}>
            <div className={`text-2xl md:text-3xl font-bold ${color}`}>{count}</div>
            <div className="text-sm text-slate-600 mt-0.5">{label}</div>
            {counts.total > 0 && (
              <div className="text-xs text-slate-400 mt-0.5">
                {((count / counts.total) * 100).toFixed(1)}%
              </div>
            )}
          </div>
        ))}
      </div>

      {counts.total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex h-5 rounded-full overflow-hidden">
            {counts.yes > 0 && <div className="bg-emerald-500" style={{ width: `${(counts.yes / counts.total) * 100}%` }} />}
            {counts.no > 0 && <div className="bg-red-500" style={{ width: `${(counts.no / counts.total) * 100}%` }} />}
            {counts.abstain > 0 && <div className="bg-amber-400" style={{ width: `${(counts.abstain / counts.total) * 100}%` }} />}
            {counts.no_show > 0 && <div className="bg-slate-200" style={{ width: `${(counts.no_show / counts.total) * 100}%` }} />}
          </div>
          <div className="flex gap-4 mt-2 flex-wrap text-xs text-slate-500">
            {[
              { label: 'Ja', color: 'bg-emerald-500', count: counts.yes },
              { label: 'Nein', color: 'bg-red-500', count: counts.no },
              { label: 'Enthaltung', color: 'bg-amber-400', count: counts.abstain },
              { label: 'Abwesend', color: 'bg-slate-300', count: counts.no_show },
            ].filter(i => i.count > 0).map(({ label, color, count }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
                {label}: <strong>{count}</strong>
              </span>
            ))}
            <span className="ml-auto text-slate-400">Gesamt: {counts.total}</span>
          </div>
        </div>
      )}

      {counts.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Prozentual</h3>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={78} dataKey="value"
                  label={({ name, percent }) => `${name} ${(((percent ?? 0)) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v} Stimmen`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Absolute Zahlen</h3>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={pieData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v} Stimmen`} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {poll.field_intro && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Beschreibung</h3>
          <div
            className="text-sm text-slate-600 leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_p]:mb-2"
            dangerouslySetInnerHTML={{ __html: poll.field_intro }}
          />
        </div>
      )}

      {poll.field_related_links && poll.field_related_links.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Weiterführende Links</h3>
          <ul className="space-y-1.5">
            {poll.field_related_links.map((link) => (
              <li key={link.uri}>
                <a href={link.uri} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 underline">
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasVotes && (
        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
          Keine Einzelstimmen verfügbar für diese Abstimmung.
        </p>
      )}
    </div>
  );
}

// ─── Fractions ───────────────────────────────────────────────────────────────

interface FractionsTabProps {
  fractions: FractionStats[];
  expandedFraction: number | null;
  setExpandedFraction: (id: number | null) => void;
  onSelectFraction: (id: number, name: string) => void;
}

function FractionsTab({ fractions, expandedFraction, setExpandedFraction, onSelectFraction }: FractionsTabProps) {
  return (
    <div className="space-y-3">
      {fractions.map((f) => {
        const colors = fractionColors(f.fractionName);
        const isExpanded = expandedFraction === f.fractionId;
        const total = f.yes + f.no + f.abstain + f.no_show;

        return (
          <div key={f.fractionId} className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <button
                      onClick={() => onSelectFraction(f.fractionId, f.fractionName)}
                      className={`font-semibold text-sm ${colors.text} hover:underline cursor-pointer flex items-center gap-1`}
                    >
                      {f.fractionName}
                      <span className="text-xs opacity-60">→</span>
                    </button>
                    <span className="text-xs text-slate-500">{total} Mitglieder</span>
                    {f.deviants.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full border border-orange-200">
                        <TriangleAlert className="w-3 h-3" /> {f.deviants.length} Abweichler
                      </span>
                    )}
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-white/60">
                    {f.yes > 0 && <div className="bg-emerald-500" style={{ width: `${(f.yes / total) * 100}%` }} />}
                    {f.no > 0 && <div className="bg-red-500" style={{ width: `${(f.no / total) * 100}%` }} />}
                    {f.abstain > 0 && <div className="bg-amber-400" style={{ width: `${(f.abstain / total) * 100}%` }} />}
                    {f.no_show > 0 && <div className="bg-slate-300" style={{ width: `${(f.no_show / total) * 100}%` }} />}
                  </div>
                  <div className="flex gap-3 mt-1.5 flex-wrap text-xs">
                    {f.yes > 0 && <span className="text-emerald-700">Ja: {f.yes}</span>}
                    {f.no > 0 && <span className="text-red-700">Nein: {f.no}</span>}
                    {f.abstain > 0 && <span className="text-amber-700">Enth.: {f.abstain}</span>}
                    {f.no_show > 0 && <span className="text-slate-500">Abw.: {f.no_show}</span>}
                  </div>
                </div>

                <CohesionRing value={f.cohesion} />

                {f.deviants.length > 0 && (
                  <button
                    onClick={() => setExpandedFraction(isExpanded ? null : f.fractionId)}
                    className="p-1 rounded hover:bg-black/5 transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {isExpanded && f.deviants.length > 0 && (
              <div className="border-t border-black/5 px-4 py-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Abweichler:</p>
                <div className="flex flex-wrap gap-2">
                  {f.deviants.map((d) => (
                    <span key={d.name} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${voteBadge(d.vote)}`}>
                      {d.name}
                      <span className="opacity-70">· {voteLabel(d.vote)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CohesionRing({ value }: { value: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  const color = value >= 90 ? '#10b981' : value >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
      <svg width="40" height="40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round" />
      </svg>
      <span className="relative text-xs font-bold text-slate-700">{value}%</span>
    </div>
  );
}

// ─── Members ─────────────────────────────────────────────────────────────────

interface MembersTabProps {
  results: VoteResult[];
  search: string;
  onSearchChange: (s: string) => void;
  onSelectMember: (mandateId: number, mandateName: string, fractionName: string) => void;
}

function MembersTab({ results, search, onSearchChange, onSelectMember }: MembersTabProps) {
  const [sortKey, setSortKey] = useState<'name' | 'fraction' | 'vote'>('fraction');
  const [filterVote, setFilterVote] = useState('all');

  const processed = results
    .map((r) => ({
      ...r,
      cleanName: extractLabel(r.mandate.label),
      cleanFraction: extractLabel(r.fraction.label),
    }))
    .filter((r) => {
      const matchSearch = !search || r.cleanName.toLowerCase().includes(search.toLowerCase()) || r.cleanFraction.toLowerCase().includes(search.toLowerCase());
      const matchVote = filterVote === 'all' || r.vote === filterVote;
      return matchSearch && matchVote;
    })
    .sort((a, b) => {
      if (sortKey === 'name') return a.cleanName.localeCompare(b.cleanName, 'de');
      if (sortKey === 'fraction') {
        const fc = a.cleanFraction.localeCompare(b.cleanFraction, 'de');
        return fc !== 0 ? fc : a.cleanName.localeCompare(b.cleanName, 'de');
      }
      return a.vote.localeCompare(b.vote);
    });

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="search"
          placeholder="Name oder Fraktion suchen…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterVote}
          onChange={(e) => setFilterVote(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Alle ({results.length})</option>
          <option value="yes">Ja</option>
          <option value="no">Nein</option>
          <option value="abstain">Enthaltung</option>
          <option value="no_show">Abwesend</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="fraction">Sortierung: Fraktion</option>
          <option value="name">Sortierung: Name</option>
          <option value="vote">Sortierung: Stimme</option>
        </select>
      </div>

      {processed.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-10">Keine Einträge gefunden.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Fraktion</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Stimme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processed.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onSelectMember(r.mandate.id, r.cleanName, r.cleanFraction)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-medium text-blue-700 hover:underline">{r.cleanName}</td>
                  <td className="px-4 py-2.5 text-slate-500">{r.cleanFraction}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${voteBadge(r.vote)}`}>
                      {voteLabel(r.vote)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {processed.length !== results.length && (
        <p className="text-xs text-slate-400 mt-2 text-right">{processed.length} von {results.length} Einträgen</p>
      )}
    </div>
  );
}
