import { useState, useEffect } from 'react';
import { api, extractLabel } from '../api/client';
import { ExternalLink, ChevronLeft, Briefcase } from 'lucide-react';
import type { Parliament, ParliamentPeriod, Poll, CandidacyMandate, MandateVote, Sidejob } from '../types/api';
import { fractionColors, voteBadge, voteLabel } from '../utils/voteUtils';

// Bundestag income level brackets (§ 44a AbgG)
const INCOME_LEVELS: Record<string, string> = {
  '1': '1.000 – 3.500 €',
  '2': '3.500 – 7.000 €',
  '3': '7.000 – 15.000 €',
  '4': '15.000 – 30.000 €',
  '5': '30.000 – 50.000 €',
  '6': '50.000 – 75.000 €',
  '7': '> 75.000 €',
};

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
  parliament,
  onBack,
  onSelectPoll,
}: MemberDetailViewProps) {
  const [mandate, setMandate] = useState<CandidacyMandate | null>(null);
  const [votes, setVotes] = useState<MandateVote[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [sidejobs, setSidejobs] = useState<Sidejob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingPollId, setLoadingPollId] = useState<number | null>(null);

  const colors = fractionColors(fractionName);
  const isBundestag = parliament.id === 5;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMandate(null);
    setVotes([]);

    Promise.all([
      api.getCandidacyMandate(mandateId),
      api.getMandateVotes(mandateId),
      isBundestag ? api.getSidejobs(mandateId) : Promise.resolve({ jobs: [], total: 0 }),
    ])
      .then(([mandateData, votesData, sidejobsData]) => {
        if (!cancelled) {
          setMandate(mandateData);
          setVotes(votesData.votes);
          setTotalVotes(votesData.total);
          setSidejobs(sidejobsData.jobs);
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
  }, [mandateId, isBundestag]);

  const noShowCount = votes.filter((v) => v.vote === 'no_show').length;
  const participationRate = votes.length > 0
    ? Math.round(((votes.length - noShowCount) / votes.length) * 100)
    : null;

  async function handleVoteClick(pollId: number) {
    if (loadingPollId != null) return;
    setLoadingPollId(pollId);
    try {
      const poll = await api.getPoll(pollId);
      onSelectPoll(poll);
    } catch {
      // silently ignore — external link is still available
    } finally {
      setLoadingPollId(null);
    }
  }

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
        <ChevronLeft className="w-4 h-4" />
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
                  <span>Wahlkreis: {electoralInfo.constituency.label}</span>
                )}
                {electoralInfo.electoral_list?.label && (
                  <span>Liste: {extractLabel(electoralInfo.electoral_list.label)}</span>
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
                    const isLoadingThis = loadingPollId === v.poll.id;

                    return (
                      <div
                        key={v.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => handleVoteClick(v.poll.id)}
                        title="Abstimmung öffnen"
                      >
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${voteBadge(v.vote)}`}>
                          {voteLabel(v.vote)}
                        </span>
                        <span className={`flex-1 text-sm min-w-0 truncate transition-colors ${isLoadingThis ? 'text-blue-500' : 'text-slate-700'}`} title={pollLabel}>
                          {pollLabel}
                        </span>
                        {hasUrl && (
                          <a
                            href={v.poll.abgeordnetenwatch_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 text-blue-500 hover:text-blue-700 transition-colors"
                            title="Auf abgeordnetenwatch.de öffnen"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
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

          {/* Zuwendungen & Nebentätigkeiten (Bundestag only) */}
          {isBundestag && sidejobs.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="w-4 h-4 text-slate-400" />
                <h2 className="text-base font-semibold text-slate-800">
                  Zuwendungen & Nebentätigkeiten
                </h2>
                <span className="text-sm font-normal text-slate-400 ml-1">({sidejobs.length})</span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {sidejobs.map((job) => {
                    const org = job.sidejob_organization?.label ?? job.label;
                    const yearExtra = job.job_title_extra;
                    const level = job.income_level ? INCOME_LEVELS[job.income_level] : null;
                    const exactIncome = job.income != null
                      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(job.income)
                      : null;
                    return (
                      <div key={job.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800 truncate">{org}</div>
                            {yearExtra && (
                              <div className="text-xs text-slate-500 mt-0.5">{yearExtra}</div>
                            )}
                            {job.category?.label && (
                              <div className="text-xs text-slate-400 mt-0.5">{job.category.label}</div>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {exactIncome ? (
                              <span className="text-sm font-semibold text-slate-700">{exactIncome}</span>
                            ) : level ? (
                              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Stufe {job.income_level}: {level}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Quelle: abgeordnetenwatch.de · Angaben nach §44a AbgG (Bundestag)
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
