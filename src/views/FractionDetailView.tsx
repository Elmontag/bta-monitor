import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { Parliament, ParliamentPeriod, Poll, VoteResult, CandidacyMandate } from '../types/api';
import { computeFractionStats, fractionColors, voteLabel, voteBadge } from '../utils/voteUtils';
import { api, extractLabel } from '../api/client';

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
  onBack,
  onSelectMember,
  contextVotes,
  contextPoll,
}: FractionDetailViewProps) {
  const colors = fractionColors(fractionName);

  // Members loaded from API when no vote context
  const [apiMembers, setApiMembers] = useState<CandidacyMandate[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (contextVotes && contextVotes.length > 0) return;
    setLoadingMembers(true);
    setApiMembers([]);

    const loadAll = async (): Promise<CandidacyMandate[]> => {
      const acc: CandidacyMandate[] = [];
      let start = 0;
      let total = Infinity;
      while (acc.length < total && start < 600) {
        const { mandates, total: t } = await api.getMandatesForPeriod(period.id, start, start + 100);
        total = t;
        acc.push(...mandates);
        start += 100;
        if (mandates.length < 100) break;
      }
      return acc;
    };

    loadAll()
      .then((all) => {
        const members = all.filter((m) =>
          m.fraction_membership?.some((fm) => fm.fraction.id === fractionId)
        );
        setApiMembers(members);
      })
      .finally(() => setLoadingMembers(false));
  }, [period.id, fractionId, contextVotes]);

  // From vote context: per-member vote list for this fraction
  const fractionVotes = (contextVotes ?? []).filter((v) => v.fraction.id === fractionId);

  // Compute stats for this fraction from context votes
  const allStats = contextVotes ? computeFractionStats(contextVotes) : [];
  const stats = allStats.find((s) => s.fractionId === fractionId);

  // Members to display in table
  const membersFromVotes = fractionVotes.length > 0;
  const membersFromApi = !membersFromVotes && apiMembers.length > 0;

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
                {fractionVotes.map((v) => {
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
