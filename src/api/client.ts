import axios from 'axios';
import type { Parliament, ParliamentPeriod, Poll, VoteResult, APIResponse, APISingleResponse, CandidacyMandate, MandateVote } from '../types/api';

const API_BASE = 'https://www.abgeordnetenwatch.de/api/v2';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const client = axios.create({ baseURL: API_BASE, timeout: 15000 });

const memCache = new Map<string, CacheEntry<unknown>>();

function cacheKey(path: string, params?: Record<string, unknown>): string {
  return `${path}?${params ? new URLSearchParams(params as Record<string, string>).toString() : ''}`;
}

function fromCache<T>(key: string): T | null {
  const entry = memCache.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() - entry.ts > CACHE_TTL) {
    memCache.delete(key);
    return null;
  }
  return entry.data;
}

function toCache<T>(key: string, data: T) {
  memCache.set(key, { data, ts: Date.now() });
}

async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const key = cacheKey(path, params);
  const cached = fromCache<T>(key);
  if (cached) return cached;
  const res = await client.get<T>(path, { params });
  toCache(key, res.data);
  return res.data;
}

// Extract "Name" from "Name (Parliament Period)"
export function extractLabel(label: string): string {
  return label.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

export const api = {
  async getParliaments(): Promise<Parliament[]> {
    const res = await get<APIResponse<Parliament>>('/parliaments');
    return res.data;
  },

  async getParliamentPeriods(parliamentId: number): Promise<ParliamentPeriod[]> {
    const res = await get<APIResponse<ParliamentPeriod>>('/parliament-periods', {
      parliament: parliamentId,
      type: 'legislature',
      range_end: 50,
      sort_by: 'start_date_period',
      sort_direction: 'desc',
    });
    return res.data;
  },

  async getPolls(periodId: number, rangeStart = 0, rangeEnd = 50): Promise<{ polls: Poll[]; total: number }> {
    const res = await get<APIResponse<Poll>>('/polls', {
      field_legislature: periodId,
      range_start: rangeStart,
      range_end: rangeEnd,
    });
    return { polls: res.data, total: res.meta.result.total };
  },

  async getVoteResults(pollId: number): Promise<VoteResult[]> {
    // Use related_data=votes to get all votes embedded in the poll response (max 1000)
    const res = await get<{ data: Poll & { related_data: { votes: VoteResult[] } } }>(`/polls/${pollId}`, {
      related_data: 'votes',
    });
    return res.data?.related_data?.votes ?? [];
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
};

