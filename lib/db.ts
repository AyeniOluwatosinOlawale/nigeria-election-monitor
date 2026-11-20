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

// ─── fetchLGAResults ─────────────────────────────────────────────────────────

interface LGAResultRow {
  election_id: string;
  state_code: string;
  lga_name: string;
  party_code: string;
  votes: number;
  accredited_voters: number;
  total_pus: number;
  reported_pus: number;
  status: ResultStatus;
  over_voted: boolean;
}

export async function fetchLGAResults(
  electionId: string,
  stateCode: string
): Promise<AggregateResult[]> {
  try {
    const { data, error } = await supabase
      .from('ng_election_lga_results')
      .select('*')
      .eq('election_id', electionId)
      .eq('state_code', stateCode)
      .order('lga_name');

    if (error) {
      console.error(`[db] fetchLGAResults error:`, error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    const grouped: Record<string, LGAResultRow[]> = {};
    for (const row of data as LGAResultRow[]) {
      if (!grouped[row.lga_name]) grouped[row.lga_name] = [];
      grouped[row.lga_name].push(row);
    }

    return Object.entries(grouped).map(([lgaName, rows]) => {
      const ref = rows[0];
      const partyResults: PartyResult[] = rows
        .map((r) => ({ partyCode: r.party_code, votes: r.votes }))
        .sort((a, b) => b.votes - a.votes);
      const totalVotes = partyResults.reduce((s, r) => s + r.votes, 0);
      const withPct = partyResults.map((r) => ({
        ...r,
        percentage: totalVotes > 0 ? (r.votes / totalVotes) * 100 : 0,
      }));
      return {
        level: 'lga' as const,
        id: lgaName,
        name: lgaName,
        stateCode: ref.state_code,
        totalPUs: ref.total_pus,
        reportedPUs: ref.reported_pus,
        accreditedVoters: ref.accredited_voters,
        results: withPct,
        status: ref.status,
        leadingParty: withPct[0]?.partyCode,
        overVoted: ref.over_voted ?? false,
      };
    });
  } catch (err) {
    console.error(`[db] fetchLGAResults unexpected error:`, err);
    return [];
  }
}

// ─── fetchAllLGAResults ───────────────────────────────────────────────────────
// Fetches ALL LGA/district rows for an election (no state filter).
// Returns results keyed by "STATE_CODE:lga_name" for quick lookup.

export async function fetchAllLGAResults(
  electionId: string
): Promise<Record<string, AggregateResult>> {
  try {
    const { data, error } = await supabase
      .from('ng_election_lga_results')
      .select('*')
      .eq('election_id', electionId);

    if (error) {
      console.error(`[db] fetchAllLGAResults(${electionId}) error:`, error.message);
      return {};
    }
    if (!data || data.length === 0) return {};

    const grouped: Record<string, LGAResultRow[]> = {};
    for (const row of data as LGAResultRow[]) {
      const key = `${row.state_code}:${row.lga_name}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }

    const result: Record<string, AggregateResult> = {};
    for (const [key, rows] of Object.entries(grouped)) {
      const ref = rows[0];
      const partyResults = rows
        .map((r) => ({ partyCode: r.party_code, votes: r.votes }))
        .sort((a, b) => b.votes - a.votes);
      const totalVotes = partyResults.reduce((s, r) => s + r.votes, 0);
      const withPct = partyResults.map((r) => ({
        ...r,
        percentage: totalVotes > 0 ? (r.votes / totalVotes) * 100 : 0,
      }));
      result[key] = {
        level: 'lga' as const,
        id: key,
        name: ref.lga_name,
        stateCode: ref.state_code,
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
  } catch (err) {
    console.error(`[db] fetchAllLGAResults unexpected error:`, err);
    return {};
  }
}

// ─── fetchPUResults ──────────────────────────────────────────────────────────

export interface PUResult {
  puCode: string;
  puName: string;
  registrationArea: string;
  accreditedVoters: number;
  status: ResultStatus;
  overVoted: boolean;
  parties: { partyCode: string; votes: number; percentage: number }[];
  totalVotes: number;
}

export async function fetchPUResults(
  electionId: string,
  stateCode: string,
  lgaName: string
): Promise<PUResult[]> {
  try {
    const { data, error } = await supabase
      .from('ng_election_pu_results')
      .select('pu_code,pu_name,registration_area,party_code,votes,accredited_voters,status,over_voted')
      .eq('election_id', electionId)
      .eq('state_code', stateCode)
      .eq('lga_name', lgaName)
      .order('pu_code');

    if (error) {
      console.error('[db] fetchPUResults error:', error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    // Group by pu_code
    const grouped: Record<string, typeof data> = {};
    for (const row of data) {
      if (!grouped[row.pu_code]) grouped[row.pu_code] = [];
      grouped[row.pu_code].push(row);
    }

    return Object.values(grouped).map((rows) => {
      const ref = rows[0];
      const parties = rows
        .map((r) => ({ partyCode: r.party_code, votes: r.votes }))
        .sort((a, b) => b.votes - a.votes);
      const totalVotes = parties.reduce((s, r) => s + r.votes, 0);
      return {
        puCode: ref.pu_code,
        puName: ref.pu_name,
        registrationArea: ref.registration_area ?? "",
        accreditedVoters: ref.accredited_voters,
        status: ref.status as ResultStatus,
        overVoted: ref.over_voted ?? false,
        totalVotes,
        parties: parties.map((r) => ({
          ...r,
          percentage: totalVotes > 0 ? (r.votes / totalVotes) * 100 : 0,
        })),
      };
    });
  } catch (err) {
    console.error('[db] fetchPUResults unexpected error:', err);
    return [];
  }
}

// ─── fetchOverVotedResults ───────────────────────────────────────────────────

export interface OverVotedRecord {
  stateCode: string;
  stateName: string;
  lgaName: string;
  accreditedVoters: number;
  totalVotesCast: number;
  overage: number;
  parties: { partyCode: string; votes: number }[];
}

export async function fetchOverVotedResults(
  electionId: string
): Promise<OverVotedRecord[]> {
  try {
    const { data, error } = await supabase
      .from('ng_election_lga_results')
      .select('*')
      .eq('election_id', electionId)
      .eq('over_voted', true)
      .order('state_code');

    if (error) {
      console.error(`[db] fetchOverVotedResults error:`, error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    // Group by state+LGA
    const grouped: Record<string, LGAResultRow[]> = {};
    for (const row of data as LGAResultRow[]) {
      const key = `${row.state_code}__${row.lga_name}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }

    return Object.values(grouped).map((rows) => {
      const ref = rows[0];
      const parties = rows.map((r) => ({ partyCode: r.party_code, votes: r.votes }));
      const totalVotesCast = parties.reduce((s, p) => s + p.votes, 0);
      return {
        stateCode: ref.state_code,
        stateName: ref.state_code,
        lgaName: ref.lga_name,
        accreditedVoters: ref.accredited_voters,
        totalVotesCast,
        overage: totalVotesCast - ref.accredited_voters,
        parties,
      };
    });
  } catch (err) {
    console.error(`[db] fetchOverVotedResults unexpected error:`, err);
    return [];
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

    const maxReportedPUs    = Math.max(...stateRows.map(r => r.reported_pus ?? 0));
    const maxTotalPUs       = Math.max(...stateRows.map(r => r.total_pus ?? 0));
    const maxAccredited     = Math.max(...stateRows.map(r => r.accredited_voters ?? 0));

    result[stateCode] = {
      level: 'state',
      id: stateCode,
      name: ref.state_name,
      stateCode,
      totalPUs: maxTotalPUs,
      reportedPUs: maxReportedPUs,
      accreditedVoters: maxAccredited,
      results: withPct,
      status: ref.status,
      leadingParty: withPct[0]?.partyCode,
      overVoted: ref.over_voted ?? false,
    };
  }

  return result;
}
