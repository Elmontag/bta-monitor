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
