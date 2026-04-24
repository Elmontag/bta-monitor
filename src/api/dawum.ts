import axios from 'axios';
import type { DawumData, DawumSurvey } from '../types/api';

const DAWUM_URL      = 'https://api.dawum.de/newest_surveys.json';
const DAWUM_FULL_URL = 'https://api.dawum.de/';
const MEM_TTL        = 6  * 60 * 60 * 1000; // 6 h
const FULL_MEM_TTL   = 24 * 60 * 60 * 1000; // 24 h — historical data changes rarely

interface PersistentFile<T> { data: T; lastUpdated: string; }

let cache:     { data: DawumData; ts: number } | null = null;
let fullCache: { data: DawumData; ts: number } | null = null;

interface RawDawumResponse {
  Parliaments: Record<string, { Shortcut: string; Name: string; Election: string }>;
  Institutes:  Record<string, { Name: string }>;
  Parties:     Record<string, { Shortcut: string; Name: string }>;
  Methods:     Record<string, { Name: string }>;
  Surveys: Record<string, {
    Date: string;
    Parliament_ID: string;
    Institute_ID: string;
    Method_ID: string;
    Surveyed_Persons: string;
    Results: Record<string, number>;
    Survey_Period: { Date_Start: string; Date_End: string };
  }>;
}

function isRawDawumResponse(data: DawumData | RawDawumResponse): data is RawDawumResponse {
  return 'Parliaments' in data;
}

export function parseDawumResponse(raw: RawDawumResponse): DawumData {
  const surveys: DawumSurvey[] = Object.entries(raw.Surveys).map(([id, s]) => ({
    id,
    date: s.Date,
    parliament_id: s.Parliament_ID,
    institute_id: s.Institute_ID,
    method_id: s.Method_ID,
    surveyed_persons: s.Surveyed_Persons,
    results: s.Results,
    survey_period: { start: s.Survey_Period.Date_Start, end: s.Survey_Period.Date_End },
  }));

  return {
    parliaments: raw.Parliaments,
    institutes:  raw.Institutes,
    parties:     raw.Parties,
    surveys,
  };
}

/** Newest surveys only — fast, used for the current-forecast widget */
export async function getDawumData(): Promise<DawumData> {
  if (cache && Date.now() - cache.ts < MEM_TTL) return cache.data;

  // Try persistent cache first
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/cache/dawum.json`);
    if (res.ok) {
      const file: PersistentFile<DawumData | RawDawumResponse> = await res.json();
      if (file.data) {
        const normalized = isRawDawumResponse(file.data) ? parseDawumResponse(file.data) : file.data;
        cache = { data: normalized, ts: Date.now() };
        return normalized;
      }
    }
  } catch { /* ignore */ }

  const res = await axios.get<RawDawumResponse>(DAWUM_URL, { timeout: 10000 });
  const data = parseDawumResponse(res.data);
  cache = { data, ts: Date.now() };
  return data;
}

/**
 * Full dawum dataset with all historical surveys.
 * Used to find actual election results (Wahlergebnisse).
 * Falls back to getDawumData() if the full endpoint is unavailable.
 */
export async function getDawumFullData(): Promise<DawumData> {
  if (fullCache && Date.now() - fullCache.ts < FULL_MEM_TTL) return fullCache.data;

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/cache/dawum-full.json`);
    if (res.ok) {
      const file: PersistentFile<DawumData | RawDawumResponse> = await res.json();
      if (file.data) {
        const normalized = isRawDawumResponse(file.data) ? parseDawumResponse(file.data) : file.data;
        fullCache = { data: normalized, ts: Date.now() };
        if (!cache) cache = { data: normalized, ts: Date.now() };
        return normalized;
      }
    }
  } catch { /* ignore */ }

  try {
    const res = await axios.get<RawDawumResponse>(DAWUM_FULL_URL, { timeout: 20000 });
    const data = parseDawumResponse(res.data);
    fullCache = { data, ts: Date.now() };
    // warm the regular cache too if it's cold
    if (!cache) cache = { data, ts: Date.now() };
    return data;
  } catch {
    return getDawumData();
  }
}

export const AW_TO_DAWUM: Record<string, string> = {
  'Bundestag': '0',
  'Baden-Württemberg': '1',
  'Bayern': '2',
  'Berlin': '3',
  'Brandenburg': '4',
  'Bremen': '5',
  'Hamburg': '6',
  'Hessen': '7',
  'Mecklenburg-Vorpommern': '8',
  'Niedersachsen': '9',
  'Nordrhein-Westfalen': '10',
  'Rheinland-Pfalz': '11',
  'Saarland': '12',
  'Sachsen': '13',
  'Sachsen-Anhalt': '14',
  'Schleswig-Holstein': '15',
  'Thüringen': '16',
  'EU-Parlament': '17',
  'Europäisches Parlament': '17',
};

export const PARTY_COLORS: Record<string, string> = {
  'CDU/CSU': '#1a1a1a',
  'CDU': '#1a1a1a',
  'CSU': '#008dd2',
  'SPD': '#e3000f',
  'FDP': '#ffed00',
  'Grüne': '#46962b',
  'AfD': '#009ee0',
  'Linke': '#be3075',
  'BSW': '#702082',
  'SSW': '#003c8f',
  'Freie Wähler': '#f57c00',
  'Volt': '#502379',
  'Sonstige': '#94a3b8',
};
