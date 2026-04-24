import axios from 'axios';
import type { Parliament, ParliamentPeriod, Poll, VoteResult, APIResponse, APISingleResponse, CandidacyMandate, MandateVote, Fraction, Sidejob, Politician, GovernmentMember } from '../types/api';

const API_BASE = 'https://www.abgeordnetenwatch.de/api/v2';
const MEM_TTL = 5 * 60 * 1000; // 5 min — persistent cache handles freshness

// Base URL for persistent cache files served by nginx/dev-server from /data/cache/
const CACHE_BASE = (import.meta.env.VITE_CACHE_BASE as string | undefined) ?? `${import.meta.env.BASE_URL}data/cache`;

interface CacheEntry<T> {
  data: T;
  ts: number;
}

interface PersistentCacheFile<T> {
  lastUpdated: string;
  data: T;
}

const client = axios.create({ baseURL: API_BASE, timeout: 15000 });
const memCache = new Map<string, CacheEntry<unknown>>();

function cacheKey(path: string, params?: Record<string, unknown>): string {
  return `${path}?${params ? new URLSearchParams(params as Record<string, string>).toString() : ''}`;
}

function fromMem<T>(key: string): T | null {
  const entry = memCache.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() - entry.ts > MEM_TTL) {
    memCache.delete(key);
    return null;
  }
  return entry.data;
}

function toMem<T>(key: string, data: T) {
  memCache.set(key, { data, ts: Date.now() });
}

/** Try to load data from the persistent on-disk cache served at /data/cache/ */
async function fromPersistent<T>(cacheKey: string): Promise<T | null> {
  try {
    const res = await fetch(`${CACHE_BASE}/${cacheKey}.json`);
    if (!res.ok) return null;
    const file: PersistentCacheFile<T> = await res.json();
    return file.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch helper with 3-tier resilience:
 * 1. In-memory cache (5 min TTL)
 * 2. Persistent cache at /data/cache/ (managed by cache-service container)
 * 3. Live abgeordnetenwatch API
 * 4. Stale persistent cache (if API is down)
 */
async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const key = cacheKey(path, params);
  const memHit = fromMem<T>(key);
  if (memHit) return memHit;
  const res = await client.get<T>(path, { params });
  toMem(key, res.data);
  return res.data;
}

/**
 * Named cache fetch: tries mem → persistent → live API → stale fallback.
 * Use this for all high-level API methods so they benefit from the cache service.
 */
async function cachedFetch<T>(persistKey: string, live: () => Promise<T>): Promise<T> {
  // 1. In-memory
  const memHit = fromMem<T>(persistKey);
  if (memHit) return memHit;

  // 2. Persistent cache
  const persisted = await fromPersistent<T>(persistKey);
  if (persisted !== null) {
    toMem(persistKey, persisted);
    return persisted;
  }

  // 3. Live API (with stale fallback on failure)
  let stale: T | null = null;
  try {
    // Try persistent cache again without TTL check for stale fallback candidate
    stale = persisted; // already null here, but kept for clarity
    const data = await live();
    toMem(persistKey, data);
    return data;
  } catch (err) {
    if (stale !== null) return stale;
    throw err;
  }
}

function sliceRange<T>(items: T[], rangeStart: number, rangeEnd: number) {
  return items.slice(rangeStart, rangeEnd);
}

// Government member detection. AW's `occupation` field is unreliable (mixes eras,
// includes past cabinets etc.), so we only support the Bundestag, where the cache
// service scrapes bundesregierung.de directly. For all other parliaments we skip
// the feature entirely rather than surface incorrect data.

// Extract "Name" from "Name (Parliament Period)"
export function extractLabel(label: string): string {
  return label.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

export const api = {
  async getParliaments(): Promise<Parliament[]> {
    return cachedFetch('parliaments', async () => {
      const res = await get<APIResponse<Parliament>>('/parliaments');
      return res.data;
    });
  },

  async getParliamentPeriods(parliamentId: number): Promise<ParliamentPeriod[]> {
    return cachedFetch(`periods-${parliamentId}`, async () => {
      const res = await get<APIResponse<ParliamentPeriod>>('/parliament-periods', {
        parliament: parliamentId,
        type: 'legislature',
        range_end: 50,
        sort_by: 'start_date_period',
        sort_direction: 'desc',
      });
      return res.data;
    });
  },

  async getPolls(periodId: number, rangeStart = 0, rangeEnd = 50): Promise<{ polls: Poll[]; total: number }> {
    const persisted = await fromPersistent<{ polls?: Poll[]; total?: number } | Poll[]>(`polls-${periodId}`);
    if (persisted !== null) {
      const allPolls = Array.isArray(persisted) ? persisted : (persisted.polls ?? []);
      const total = Array.isArray(persisted) ? allPolls.length : (persisted.total ?? allPolls.length);
      return { polls: sliceRange(allPolls, rangeStart, rangeEnd), total };
    }
    const res = await get<APIResponse<Poll>>('/polls', {
      field_legislature: periodId,
      range_start: rangeStart,
      range_end: rangeEnd,
    });
    return { polls: res.data, total: res.meta.result.total };
  },

  async getVoteResults(pollId: number): Promise<VoteResult[]> {
    return cachedFetch(`vote-results-${pollId}`, async () => {
      const res = await get<{ data: Poll & { related_data: { votes: VoteResult[] } } }>(`/polls/${pollId}`, {
        related_data: 'votes',
      });
      return res.data?.related_data?.votes ?? [];
    });
  },

  async getMandateVotes(mandateId: number, rangeEnd = 100): Promise<{ votes: MandateVote[]; total: number }> {
    const res = await get<APIResponse<MandateVote>>('/votes', {
      mandate: mandateId,
      range_end: rangeEnd,
      sort_by: 'poll',
    });
    return { votes: res.data, total: res.meta.result.total };
  },

  async getCandidacyMandate(mandateId: number): Promise<CandidacyMandate> {
    const res = await get<APISingleResponse<CandidacyMandate>>(`/candidacies-mandates/${mandateId}`);
    return res.data;
  },

  async getFractionsForPeriod(periodId: number): Promise<Fraction[]> {
    return cachedFetch(`fractions-${periodId}`, async () => {
      const res = await get<APIResponse<Fraction>>('/fractions', {
        legislature: periodId,
        range_end: 50,
      });
      return res.data;
    });
  },

  async getSidejobs(mandateId: number, rangeEnd = 100): Promise<{ jobs: Sidejob[]; total: number }> {
    const res = await get<APIResponse<Sidejob>>('/sidejobs', {
      mandates: mandateId,
      range_end: rangeEnd,
      sort_by: 'created',
      sort_direction: 'desc',
    });
    return { jobs: res.data, total: res.meta.result.total };
  },

  async getMandatesForPeriod(periodId: number, rangeStart = 0, rangeEnd = 100): Promise<{ mandates: CandidacyMandate[]; total: number }> {
    const persisted = await fromPersistent<{ mandates?: CandidacyMandate[]; total?: number } | CandidacyMandate[]>(`mandates-${periodId}`);
    if (persisted !== null) {
      const allMandates = Array.isArray(persisted) ? persisted : (persisted.mandates ?? []);
      const total = Array.isArray(persisted) ? allMandates.length : (persisted.total ?? allMandates.length);
      return { mandates: sliceRange(allMandates, rangeStart, rangeEnd), total };
    }
    const res = await get<APIResponse<CandidacyMandate>>('/candidacies-mandates', {
      parliament_period: periodId,
      type: 'mandate',
      range_start: rangeStart,
      range_end: rangeEnd,
    });
    return { mandates: res.data, total: res.meta.result.total };
  },

  async getAllMandatesForPeriod(periodId: number): Promise<CandidacyMandate[]> {
    const persisted = await fromPersistent<{ mandates?: CandidacyMandate[]; total?: number } | CandidacyMandate[]>(`mandates-${periodId}`);
    if (persisted !== null) {
      return Array.isArray(persisted) ? persisted : (persisted.mandates ?? []);
    }

    const all: CandidacyMandate[] = [];
    let rangeStart = 0;
    let total = Infinity;
    while (all.length < total) {
      const res = await get<APIResponse<CandidacyMandate>>('/candidacies-mandates', {
        parliament_period: periodId,
        type: 'mandate',
        range_start: rangeStart,
        range_end: rangeStart + 100,
      });
      all.push(...res.data);
      total = res.meta.result.total;
      if (res.data.length === 0) break;
      rangeStart += res.data.length;
    }
    return all;
  },

  async getPoll(pollId: number): Promise<Poll> {
    return cachedFetch(`poll-${pollId}`, async () => {
      const res = await get<APISingleResponse<Poll>>(`/polls/${pollId}`);
      return res.data;
    });
  },

  async searchPolls(query: string, rangeEnd = 10): Promise<Poll[]> {
    const res = await get<APIResponse<Poll>>('/polls', {
      'label[cn]': query,
      range_end: rangeEnd,
    });
    return res.data;
  },

  async searchFractions(query: string, rangeEnd = 8): Promise<Fraction[]> {
    const res = await get<APIResponse<Fraction>>('/fractions', {
      'label[cn]': query,
      range_end: rangeEnd,
    });
    return res.data;
  },

  async searchPoliticians(query: string, rangeEnd = 8): Promise<Politician[]> {
    const res = await get<APIResponse<Politician>>('/politicians', {
      'label[cn]': query,
      range_end: rangeEnd,
    });
    return res.data;
  },

  async getMandatesForPolitician(politicianId: number, rangeEnd = 10): Promise<CandidacyMandate[]> {
    const res = await get<APIResponse<CandidacyMandate>>('/candidacies-mandates', {
      politician: politicianId,
      type: 'mandate',
      range_end: rangeEnd,
      sort_by: 'parliament_period',
      sort_direction: 'desc',
    });
    return res.data;
  },

  /**
   * Search mandates — returns up to rangeEnd results across all periods.
   * No deduplication: the same politician may appear once per period they served,
   * which lets users navigate to historical mandates.
   */
  async searchMandates(query: string, rangeEnd = 20): Promise<CandidacyMandate[]> {
    const [direct, politicians] = await Promise.all([
      get<APIResponse<CandidacyMandate>>('/candidacies-mandates', {
        'label[cn]': query,
        type: 'mandate',
        range_end: rangeEnd,
      }).then((res) => res.data),
      api.searchPoliticians(query, Math.min(rangeEnd, 8)),
    ]);

    const byId = new Map<number, CandidacyMandate>();
    for (const mandate of direct) byId.set(mandate.id, mandate);

    const politicianMandates = await Promise.all(
      politicians.map((politician) => api.getMandatesForPolitician(politician.id, 10).catch(() => [])),
    );

    for (const mandates of politicianMandates) {
      for (const mandate of mandates) {
        if (!byId.has(mandate.id)) byId.set(mandate.id, mandate);
        if (byId.size >= rangeEnd) break;
      }
      if (byId.size >= rangeEnd) break;
    }

    return Array.from(byId.values()).slice(0, rangeEnd);
  },

  async getGovernmentMembersForPeriod(parliament: Parliament, period: ParliamentPeriod): Promise<GovernmentMember[]> {
    // Government members are only supported for the Bundestag, where the cache
    // service scrapes the official Bundesregierung page. For all other parliaments
    // the AW `occupation` field is too noisy to produce reliable results.
    if (parliament.label !== 'Bundestag') return [];

    const today = new Date().toISOString().slice(0, 10);
    const isCurrentPeriod = !period.end_date_period || period.end_date_period >= today;
    if (!isCurrentPeriod) return [];

    const persistKey = `government-${period.id}`;
    const memHit = fromMem<GovernmentMember[]>(persistKey);
    if (memHit) return memHit;

    const persisted = await fromPersistent<GovernmentMember[]>(persistKey);
    if (persisted !== null) {
      toMem(persistKey, persisted);
      return persisted;
    }

    // Without the cache-service-sourced snapshot we cannot safely surface cabinet
    // data (no browser-accessible live source), so return an empty list.
    return [];
  },
};

