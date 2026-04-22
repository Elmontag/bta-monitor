import type { Parliament, ParliamentPeriod, Poll, VoteResult } from '../types/api';
import { computeFractionStats, fractionColors, voteLabel, voteBadge } from '../utils/voteUtils';
import { extractLabel } from '../api/client';

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
  onBack,
  onSelectMember,
  contextVotes,
  contextPoll,
}: FractionDetailViewProps) {
  const colors = fractionColors(fractionName);

  // Filter votes for this fraction
  const fractionVotes = (contextVotes ?? []).filter((v) => v.fraction.id === fractionId);

  // Compute stats for this fraction from context votes
  const allStats = contextVotes ? computeFractionStats(contextVotes) : [];
  const stats = allStats.find((s) => s.fractionId === fractionId);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Zurück
      </button>

      {/* Header card */}
      <div className={`rounded-xl border ${colors.border} ${colors.bg} p-5 mb-5`}>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className={`text-2xl font-bold ${colors.text}`}>{fractionName}</h1>
          {stats && (
            <span className="text-sm text-slate-500">{stats.total} Mitglieder</span>
          )}
        </div>
        {contextPoll && (
          <p className="text-sm text-slate-500 mt-1">
            In Abstimmung: <span className="font-medium text-slate-700">{contextPoll.label}</span>
          </p>
        )}
      </div>

      {/* Stats row */}
      {stats ? (
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
      ) : (
        !contextVotes && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-sm text-slate-500">
            Wähle eine Abstimmung, um das Verhalten dieser Fraktion zu sehen.
          </div>
        )
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

      {/* Members table */}
      {fractionVotes.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3">
            Mitglieder dieser Fraktion
          </h2>
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
    </div>
  );
}
