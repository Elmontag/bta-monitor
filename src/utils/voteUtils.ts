import type { VoteResult, FractionStats, PollCounts, VoteChoice } from '../types/api';
import { extractLabel } from '../api/client';

export function computePollCounts(results: VoteResult[]): PollCounts {
  const counts: PollCounts = { yes: 0, no: 0, abstain: 0, no_show: 0, total: results.length };
  for (const r of results) {
    counts[r.vote]++;
  }
  return counts;
}

export function computeFractionStats(results: VoteResult[]): FractionStats[] {
  const groups = new Map<number, { name: string; results: VoteResult[] }>();

  for (const r of results) {
    const id = r.fraction.id;
    if (!groups.has(id)) {
      groups.set(id, { name: extractLabel(r.fraction.label), results: [] });
    }
    groups.get(id)!.results.push(r);
  }

  return Array.from(groups.entries())
    .map(([fractionId, { name: fractionName, results: fResults }]) => {
      const counts = { yes: 0, no: 0, abstain: 0, no_show: 0 };
      for (const r of fResults) counts[r.vote]++;

      const votingCounts = [counts.yes, counts.no, counts.abstain];
      const maxVotes = Math.max(...votingCounts);
      const total = fResults.length;

      let majority: VoteChoice | 'mixed' = 'mixed';
      if (counts.yes === maxVotes && counts.yes > counts.no && counts.yes > counts.abstain) majority = 'yes';
      else if (counts.no === maxVotes && counts.no > counts.yes && counts.no > counts.abstain) majority = 'no';
      else if (counts.abstain === maxVotes && counts.abstain > counts.yes && counts.abstain > counts.no) majority = 'abstain';

      const cohesion = total > 0 ? Math.round((maxVotes / total) * 100) : 0;

      const deviants = fResults
        .filter((r) => majority !== 'mixed' && r.vote !== majority && r.vote !== 'no_show')
        .map((r) => ({
          name: extractLabel(r.mandate.label),
          vote: r.vote,
        }));

      return { fractionId, fractionName, ...counts, total, majority, cohesion, deviants };
    })
    .sort((a, b) => b.total - a.total);
}

const FRACTION_COLOR_MAP: Array<{ keys: string[]; colors: { bg: string; text: string; border: string } }> = [
  { keys: ['SPD'],           colors: { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-300' } },
  { keys: ['CDU', 'CSU'],    colors: { bg: 'bg-stone-50',   text: 'text-stone-700',  border: 'border-stone-300' } },
  { keys: ['GRÜNEN', 'Grüne', 'BÜNDNIS'], colors: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' } },
  { keys: ['FDP'],           colors: { bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-300' } },
  { keys: ['AfD'],           colors: { bg: 'bg-sky-50',     text: 'text-sky-700',    border: 'border-sky-300' } },
  { keys: ['Linke'],         colors: { bg: 'bg-pink-50',    text: 'text-pink-700',   border: 'border-pink-300' } },
  { keys: ['BSW'],           colors: { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-300' } },
  { keys: ['SSW'],           colors: { bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-300' } },
];

const DEFAULT_COLORS = { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };

export function fractionColors(name: string): { bg: string; text: string; border: string } {
  for (const { keys, colors } of FRACTION_COLOR_MAP) {
    if (keys.some((k) => name.includes(k))) return colors;
  }
  return DEFAULT_COLORS;
}

export function voteLabel(choice: VoteChoice): string {
  return { yes: 'Ja', no: 'Nein', abstain: 'Enthaltung', no_show: 'Abwesend' }[choice];
}

export function voteColor(choice: VoteChoice): string {
  return {
    yes: 'text-emerald-600',
    no: 'text-red-600',
    abstain: 'text-amber-600',
    no_show: 'text-slate-400',
  }[choice];
}

export function voteBadge(choice: VoteChoice): string {
  return {
    yes: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    no: 'bg-red-100 text-red-800 border border-red-200',
    abstain: 'bg-amber-100 text-amber-800 border border-amber-200',
    no_show: 'bg-slate-100 text-slate-600 border border-slate-200',
  }[choice];
}
