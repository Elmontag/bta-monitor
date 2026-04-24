// Types matching real abgeordnetenwatch API v2 responses

export interface Parliament {
  id: number;
  label: string;
  label_external_long: string;
  current_project?: { id: number; label: string };
}

export interface ParliamentPeriod {
  id: number;
  label: string;
  start_date_period: string;
  end_date_period: string;
  type: 'legislature' | 'election';
  parliament: { id: number; label: string };
}

export interface Poll {
  id: number;
  label: string;
  field_accepted: boolean;
  field_intro: string | null;
  field_poll_date: string;
  field_committees: Array<{ id: number; label: string }> | null;
  field_topics?: Array<{ id: number; label: string }> | null;
  field_related_links?: Array<{ uri: string; title: string }> | null;
}

export type VoteChoice = 'yes' | 'no' | 'abstain' | 'no_show';

// A single member's vote on a poll
export interface VoteResult {
  id: number;
  label: string; // "Politician Name - Poll Name"
  vote: VoteChoice;
  mandate: { id: number; label: string }; // "Name (Parliament Period)"
  fraction: { id: number; label: string }; // "FractionName (Parliament Period)"
  reason_no_show: string | null;
}

export interface APIMeta {
  result: {
    count: number;
    total: number;
    range_start: number;
    range_end: number;
  };
  status: string;
}

export interface APIResponse<T> {
  meta: APIMeta;
  data: T[];
}

export interface APISingleResponse<T> {
  meta: APIMeta;
  data: T;
}

// Derived types for UI

export interface FractionStats {
  fractionId: number;
  fractionName: string;
  yes: number;
  no: number;
  abstain: number;
  no_show: number;
  total: number;
  majority: VoteChoice | 'mixed';
  cohesion: number; // 0-100%
  deviants: Deviant[];
}

export interface Deviant {
  name: string;
  vote: VoteChoice;
}

export interface PollCounts {
  yes: number;
  no: number;
  abstain: number;
  no_show: number;
  total: number;
}

export interface Politician {
  id: number;
  label: string;
  abgeordnetenwatch_url?: string;
  first_name?: string | null;
  last_name?: string | null;
  occupation?: string | null;
  party?: { id: number; label: string } | null;
}

export interface FractionMembership {
  id: number;
  label: string;
  fraction: { id: number; label: string };
  valid_from: string;
  valid_until: string | null;
}

export interface CandidacyMandate {
  id: number;
  label: string;
  type: 'mandate' | 'candidacy';
  parliament_period: { id: number; label: string };
  politician: Politician;
  start_date: string | null;
  end_date: string | null;
  info: string | null;
  electoral_data: {
    electoral_list?: { label: string } | null;
    list_position?: number | null;
    constituency?: { label: string } | null;
    mandate_won?: string | null;
  } | null;
  fraction_membership: FractionMembership[];
}

export interface MandateVote {
  id: number;
  label: string;
  mandate: { id: number; label: string };
  poll: { id: number; label: string; abgeordnetenwatch_url?: string };
  vote: VoteChoice;
  reason_no_show: string | null;
  fraction: { id: number; label: string };
}

// Fraction from fractions endpoint
export interface Fraction {
  id: number;
  label: string;
  full_name: string;
  short_name: string;
  legislature: { id: number; label: string };
}

// Sidejob / Zuwendung from /sidejobs endpoint (Bundestag only)
export interface Sidejob {
  id: number;
  label: string;
  job_title_extra: string | null;
  category: { id: number; label: string } | null;
  income_level: string | null; // "1"–"7" per Bundestag disclosure brackets
  income: number | null;
  interval: string | null;
  data_change_date: string;
  sidejob_organization: { id: number; label: string } | null;
  additional_information: string | null;
  created: number;
  field_city: { id: number; label: string } | null;
  field_country: { id: number; label: string } | null;
}

// dawum.de types
export interface DawumSurvey {
  id: string;
  date: string;
  parliament_id: string;
  institute_id: string;
  method_id: string;
  surveyed_persons: string;
  results: Record<string, number>;
  survey_period: { start: string; end: string };
}

export interface DawumData {
  parliaments: Record<string, { Shortcut: string; Name: string; Election: string }>;
  institutes: Record<string, { Name: string }>;
  parties: Record<string, { Shortcut: string; Name: string }>;
  surveys: DawumSurvey[];
}

export interface GovernmentMember {
  politician: Politician;
  mandate: CandidacyMandate | null;
  role: string;
}
