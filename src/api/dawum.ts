import axios from 'axios';
import type { DawumData, DawumSurvey } from '../types/api';

const DAWUM_URL = 'https://api.dawum.de/newest_surveys.json';
const CACHE_TTL = 6 * 60 * 60 * 1000;

let cache: { data: DawumData; ts: number } | null = null;

interface RawDawumResponse {
  Parliaments: Record<string, { Shortcut: string; Name: string; Election: string }>;
  Institutes: Record<string, { Name: string }>;
  Parties: Record<string, { Shortcut: string; Name: string }>;
  Methods: Record<string, { Name: string }>;
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

export async function getDawumData(): Promise<DawumData> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;

  const res = await axios.get<RawDawumResponse>(DAWUM_URL, { timeout: 10000 });
  const raw = res.data;

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

  const data: DawumData = {
    parliaments: raw.Parliaments,
    institutes: raw.Institutes,
    parties: raw.Parties,
    surveys,
  };

  cache = { data, ts: Date.now() };
  return data;
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
