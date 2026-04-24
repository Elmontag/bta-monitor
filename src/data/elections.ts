/**
 * Curated historical election results (static fallback).
 * The cache-service writes live Bundeswahlleiterin data to
 * /data/cache/election-results.json — the frontend merges that at startup
 * via setLiveElections() so live data takes precedence over these constants.
 *
 * Sources:
 *   - Bundestag: Bundeswahlleiterin (https://www.bundeswahlleiterin.de/bundestagswahlen/)
 *   - Landtage: respective Landeswahlleitungen
 *   - EU-Parlament: Europäische Wahlbehörde
 *
 * Shortcuts follow dawum.de / fraction label conventions (CDU/CSU aggregated).
 */

export interface ElectionResult {
  parliamentLabel: string;
  date: string;           // ISO date (yyyy-mm-dd)
  source: string;
  sourceUrl: string;
  results: Record<string, number>;  // party shortcut -> percent
}

const ELECTIONS: ElectionResult[] = [
  {
    parliamentLabel: 'Bundestag',
    date: '2025-02-23',
    source: 'Bundeswahlleiterin',
    sourceUrl: 'https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse/bund-99.html',
    results: {
      'CDU/CSU': 28.5,
      AfD: 20.8,
      SPD: 16.4,
      Grüne: 11.6,
      Linke: 8.8,
      BSW: 5.0,
      FDP: 4.3,
    },
  },
  {
    parliamentLabel: 'Bundestag',
    date: '2021-09-26',
    source: 'Bundeswahlleiter',
    sourceUrl: 'https://www.bundeswahlleiterin.de/bundestagswahlen/2021/ergebnisse/bund-99.html',
    results: {
      SPD: 25.7,
      'CDU/CSU': 24.1,
      Grüne: 14.8,
      FDP: 11.5,
      AfD: 10.3,
      Linke: 4.9,
      SSW: 0.1,
    },
  },
  {
    parliamentLabel: 'Bundestag',
    date: '2017-09-24',
    source: 'Bundeswahlleiter',
    sourceUrl: 'https://www.bundeswahlleiter.de/bundestagswahlen/2017/ergebnisse/bund-99.html',
    results: {
      'CDU/CSU': 32.9,
      SPD: 20.5,
      AfD: 12.6,
      FDP: 10.7,
      Linke: 9.2,
      Grüne: 8.9,
    },
  },
  {
    parliamentLabel: 'Bundestag',
    date: '2013-09-22',
    source: 'Bundeswahlleiter',
    sourceUrl: 'https://www.bundeswahlleiter.de/bundestagswahlen/2013/ergebnisse/bund-99.html',
    results: {
      'CDU/CSU': 41.5,
      SPD: 25.7,
      Linke: 8.6,
      Grüne: 8.4,
      FDP: 4.8,
      AfD: 4.7,
    },
  },
  {
    parliamentLabel: 'Europäisches Parlament',
    date: '2024-06-09',
    source: 'Bundeswahlleiterin (DE-Ergebnis)',
    sourceUrl: 'https://www.bundeswahlleiterin.de/europawahlen/2024/ergebnisse.html',
    results: {
      'CDU/CSU': 30.0,
      AfD: 15.9,
      SPD: 13.9,
      Grüne: 11.9,
      BSW: 6.2,
      Linke: 2.7,
      FDP: 5.2,
      'Freie Wähler': 2.7,
    },
  },
];

/** Live election results fetched from the Bundeswahlleiterin cache. */
let liveElections: ElectionResult[] = [];

/**
 * Called at app startup to inject freshly-fetched election results.
 * Live data takes precedence over the hardcoded ELECTIONS table for
 * matching entries (same parliamentLabel + date).
 */
export function setLiveElections(data: ElectionResult[]): void {
  liveElections = Array.isArray(data) ? data : [];
}

/** Merged list: live data first, then static fallback (deduplicated by parliamentLabel+date). */
function allElections(): ElectionResult[] {
  const seen = new Set(liveElections.map((e) => `${e.parliamentLabel}|${e.date}`));
  return [
    ...liveElections,
    ...ELECTIONS.filter((e) => !seen.has(`${e.parliamentLabel}|${e.date}`)),
  ];
}

/**
 * Look up the election result that started the given legislative period.
 * Matches the election whose date is within 180 days before the period start
 * (or up to 14 days after — late filings).
 */
export function findPeriodElection(
  parliamentLabel: string,
  periodStart?: string | null,
): ElectionResult | null {
  const candidates = allElections().filter((e) => e.parliamentLabel === parliamentLabel);
  if (candidates.length === 0) return null;
  if (!periodStart) {
    // Most recent election for this parliament
    return [...candidates].sort((a, b) => b.date.localeCompare(a.date))[0];
  }
  const startMs = new Date(periodStart).getTime();
  const withinRange = candidates
    .filter((e) => {
      const diffDays = (startMs - new Date(e.date).getTime()) / 86_400_000;
      return diffDays >= -14 && diffDays <= 180;
    })
    .sort((a, b) => {
      const dA = Math.abs(startMs - new Date(a.date).getTime());
      const dB = Math.abs(startMs - new Date(b.date).getTime());
      return dA - dB;
    });
  return withinRange[0] ?? null;
}

/**
 * Look up a single party's result for the election that started a period.
 */
export function findPeriodElectionResultForParty(
  parliamentLabel: string,
  periodStart: string | null | undefined,
  fractionName: string,
): { election: ElectionResult; result: number } | null {
  const election = findPeriodElection(parliamentLabel, periodStart);
  if (!election) return null;

  const n = fractionName.toLowerCase();
  // Try direct shortcut match first
  for (const [shortcut, pct] of Object.entries(election.results)) {
    if (shortcut.toLowerCase() === n) return { election, result: pct };
  }
  // Then heuristic — matches "CDU/CSU" for fraction "CDU/CSU" or "Grüne" for "B90/Grüne"
  if (n.includes('cdu') && n.includes('csu') && election.results['CDU/CSU'] != null) {
    return { election, result: election.results['CDU/CSU'] };
  }
  for (const [shortcut, pct] of Object.entries(election.results)) {
    const sc = shortcut.toLowerCase();
    if (n.includes(sc)) return { election, result: pct };
  }
  if ((n.includes('grün') || n.includes('bündnis') || n.includes('b90')) && election.results.Grüne != null) {
    return { election, result: election.results.Grüne };
  }
  if (n.includes('linke') && election.results.Linke != null) {
    return { election, result: election.results.Linke };
  }
  return null;
}
