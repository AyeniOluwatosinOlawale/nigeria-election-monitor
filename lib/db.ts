import { supabase } from './supabase';
import type { AggregateResult, ElectionType, PartyResult, ResultStatus } from './types';

// ─── Public types ────────────────────────────────────────────────────────────

export type { ElectionType };

export interface NgElection {
  id: string;
  type: ElectionType;
  year: number;
  election_date: string;
  status: 'upcoming' | 'live' | 'completed';
  description: string;
}

// ─── Row type from Supabase ──────────────────────────────────────────────────

interface StateResultRow {
  election_id: string;
  state_code: string;
  state_name: string;
  zone: string;
  party_code: string;
  votes: number;
  accredited_voters: number;
  total_pus: number;
  reported_pus: number;
  status: ResultStatus;
  over_voted: boolean;
  updated_at: string;
}

// ─── fetchElections ──────────────────────────────────────────────────────────

export async function fetchElections(): Promise<NgElection[]> {
  try {
    const { data, error } = await supabase
      .from('ng_elections')
      .select('*')
      .order('year', { ascending: false });

    if (error) {
      console.error('[db] fetchElections error:', error.message);
      return [];
    }

    return (data ?? []) as NgElection[];
  } catch (err) {
    console.error('[db] fetchElections unexpected error:', err);
    return [];
  }
}

// ─── fetchStateResults ───────────────────────────────────────────────────────

export async function fetchStateResults(
  electionId: string
): Promise<Record<string, AggregateResult>> {
  try {
    const { data, error } = await supabase
      .from('ng_election_state_results')
      .select('*')
      .eq('election_id', electionId);

    if (error) {
      console.error(`[db] fetchStateResults(${electionId}) error:`, error.message);
      return {};
    }

    if (!data || data.length === 0) return {};

    return groupRowsByState(data as StateResultRow[]);
  } catch (err) {
    console.error(`[db] fetchStateResults(${electionId}) unexpected error:`, err);
    return {};
  }
}

// ─── groupRowsByState ────────────────────────────────────────────────────────
// Groups flat party rows into AggregateResult objects keyed by state_code.

function groupRowsByState(
  rows: StateResultRow[]
): Record<string, AggregateResult> {
  const grouped: Record<string, StateResultRow[]> = {};

  for (const row of rows) {
    if (!grouped[row.state_code]) grouped[row.state_code] = [];
    grouped[row.state_code].push(row);
  }

  const result: Record<string, AggregateResult> = {};

  for (const [stateCode, stateRows] of Object.entries(grouped)) {
    // Use the first row for per-state scalar fields (they're the same for all parties)
    const ref = stateRows[0];

    const partyResults: PartyResult[] = stateRows
      .map((r) => ({ partyCode: r.party_code, votes: r.votes }))
      .sort((a, b) => b.votes - a.votes);

    const totalVotes = partyResults.reduce((sum, r) => sum + r.votes, 0);
    const withPct: PartyResult[] = partyResults.map((r) => ({
      ...r,
      percentage: totalVotes > 0 ? (r.votes / totalVotes) * 100 : 0,
    }));

    result[stateCode] = {
      level: 'state',
      id: stateCode,
      name: ref.state_name,
      stateCode,
      totalPUs: ref.total_pus,
      reportedPUs: ref.reported_pus,
      accreditedVoters: ref.accredited_voters,
      results: withPct,
      status: ref.status,
      leadingParty: withPct[0]?.partyCode,
      overVoted: ref.over_voted ?? false,
    };
  }

  return result;
}
