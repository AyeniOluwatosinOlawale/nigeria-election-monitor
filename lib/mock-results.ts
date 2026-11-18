import type { ElectionResult, AggregateResult } from "./types";

// ─── Computed helpers ────────────────────────────────────────────────────────

export function getPartyStateCounts(
  byState: Record<string, AggregateResult>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const sr of Object.values(byState)) {
    if (sr.leadingParty) {
      counts[sr.leadingParty] = (counts[sr.leadingParty] ?? 0) + 1;
    }
  }
  return counts;
}

export function getTotalNationalVotes(
  byState: Record<string, AggregateResult>
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const sr of Object.values(byState)) {
    for (const pr of sr.results) {
      totals[pr.partyCode] = (totals[pr.partyCode] ?? 0) + pr.votes;
    }
  }
  return totals;
}

export function getTotalAccredited(
  byState: Record<string, AggregateResult>
): number {
  return Object.values(byState).reduce((sum, sr) => sum + sr.accreditedVoters, 0);
}

export function getTotalPUs(
  byState: Record<string, AggregateResult>
): { total: number; reported: number } {
  let total = 0;
  let reported = 0;
  for (const sr of Object.values(byState)) {
    total += sr.totalPUs;
    reported += sr.reportedPUs;
  }
  return { total, reported };
}
