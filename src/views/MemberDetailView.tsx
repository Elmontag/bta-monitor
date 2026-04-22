import { useState, useEffect } from 'react';
import { api, extractLabel } from '../api/client';
import type { Parliament, ParliamentPeriod, Poll, CandidacyMandate, MandateVote } from '../types/api';
import { fractionColors, voteBadge, voteLabel } from '../utils/voteUtils';

interface MemberDetailViewProps {
  mandateId: number;
  mandateName: string;
  fractionName: string;
  period: ParliamentPeriod;
  parliament: Parliament;
  onBack: () => void;
  onSelectPoll: (poll: Poll) => void;
}

export function MemberDetailView({
  mandateId,
  mandateName,
  fractionName,
  onBack,
}: MemberDetailViewProps) {
  const [mandate, setMandate] = useState<CandidacyMandate | null>(null);
  const [votes, setVotes] = useState<MandateVote[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = fractionColors(fractionName);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMandate(null);
    setVotes([]);

    Promise.all([
      api.getCandidacyMandate(mandateId),
      api.getMandateVotes(mandateId),
    ])
      .then(([mandateData, votesData]) => {
        if (!cancelled) {
          setMandate(mandateData);
          setVotes(votesData.votes);
          setTotalVotes(votesData.total);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Mitgliedsdaten konnten nicht geladen werden.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [mandateId]);

  const noShowCount = votes.filter((v) => v.vote === 'no_show').length;
  const participationRate = votes.length > 0
    ? Math.round(((votes.length - noShowCount) / votes.length) * 100)
    : null;

  // Fraction from mandate data (most recent membership)
  const currentFraction = mandate?.fraction_membership?.[0]?.fraction?.label
    ? extractLabel(mandate.fraction_membership[0].fraction.label)
    : fractionName;

  const electoralInfo = mandate?.electoral_data;

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
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">{mandateName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text} ${colors.border} border`}>
                {currentFraction}
              </span>
              {mandate?.parliament_period?.label && (
                <span className="text-xs text-slate-500">{extractLabel(mandate.parliament_period.label)}</span>
              )}
            </div>
            {electoralInfo && (
              <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-3">
                {electoralInfo.constituency?.label && (
                  <span>📍 {electoralInfo.constituency.label}</span>
                )}
                {electoralInfo.electoral_list?.label && (
                  <span>📋 {extractLabel(electoralInfo.electoral_list.label)}</span>
                )}
                {electoralInfo.list_position != null && (
                  <span>Listenplatz {electoralInfo.list_position}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="text-2xl font-bold text-slate-800">
                {participationRate != null ? `${participationRate}%` : '—'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Teilnahmequote</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="text-2xl font-bold text-slate-800">{votes.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Abstimmungen{totalVotes > votes.length ? ` (${totalVotes} ges.)` : ''}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="text-2xl font-bold text-slate-800">{noShowCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Abwesend</div>
            </div>
          </div>

          {/* Mandate info */}
          {mandate?.info && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Info</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{mandate.info}</p>
            </div>
          )}

          {/* Vote history */}
          {votes.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-slate-800 mb-3">
                Abstimmungsverlauf
                {totalVotes > votes.length && (
                  <span className="ml-2 text-sm font-normal text-slate-400">({votes.length} von {totalVotes})</span>
                )}
              </h2>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {votes.map((v) => {
                    const pollLabel = extractLabel(v.poll.label);
                    const hasUrl = !!v.poll.abgeordnetenwatch_url;

                    return (
                      <div key={v.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${voteBadge(v.vote)}`}>
                          {voteLabel(v.vote)}
                        </span>
                        <span className="flex-1 text-sm text-slate-700 min-w-0 truncate" title={pollLabel}>
                          {pollLabel}
                        </span>
                        {hasUrl && (
                          <a
                            href={v.poll.abgeordnetenwatch_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                            title="Auf abgeordnetenwatch.de öffnen"
                          >
                            ↗
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {votes.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              Keine Abstimmungen gefunden.
            </div>
          )}
        </>
      )}
    </div>
  );
}
