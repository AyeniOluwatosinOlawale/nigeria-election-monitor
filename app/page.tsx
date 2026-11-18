"use client";

import { useState, useEffect, useMemo } from "react";
import type { ElectionType, AggregateResult, ElectionResult, PartyResult } from "@/lib/types";
import {
  getPartyStateCounts,
  getTotalNationalVotes,
  getTotalAccredited,
  getTotalPUs,
} from "@/lib/mock-results";
import { fetchStateResults, fetchLGAResults, fetchOverVotedResults, fetchPUResults } from "@/lib/db";
import type { OverVotedRecord, PUResult } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { PARTIES, PARTY_MAP, STATES, STATE_MAP, SENATORIAL_DISTRICTS, CONSTITUENCY_COUNT } from "@/lib/nigeria-data";
import NigeriaCartogram from "@/components/NigeriaCartogram";
import PartyBar, { PartyBadge } from "@/components/PartyBar";
import StatsStrip from "@/components/StatsStrip";
import QueueMonitor from "@/components/QueueMonitor";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

// Nigeria is WAT = UTC+1, permanent (no DST). Manual offset is more reliable
// than Intl timeZone in constrained Node.js SSR environments.
function toWATTime(date: Date): string {
  const h = (date.getUTCHours() + 1) % 24;
  const m = date.getUTCMinutes();
  const s = date.getUTCSeconds();
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Pure function — merges a Realtime row change into the existing ElectionResult.
 * Does not mutate any existing state.
 */
function updateStateResult(
  prev: ElectionResult | null,
  row: Record<string, unknown>
): ElectionResult {
  const stateCode = row.state_code as string;
  const partyCode = row.party_code as string;
  const votes = row.votes as number;

  const baseByState: Record<string, AggregateResult> = prev?.byState
    ? { ...prev.byState }
    : {};

  const existing = baseByState[stateCode];

  let updatedResults: PartyResult[];

  if (existing) {
    const hasParty = existing.results.some((r) => r.partyCode === partyCode);
    const rawResults = hasParty
      ? existing.results.map((r) =>
          r.partyCode === partyCode ? { ...r, votes } : { ...r }
        )
      : [...existing.results, { partyCode, votes }];

    const total = rawResults.reduce((sum, r) => sum + r.votes, 0);
    updatedResults = rawResults
      .map((r) => ({
        ...r,
        percentage: total > 0 ? (r.votes / total) * 100 : 0,
      }))
      .sort((a, b) => b.votes - a.votes);
  } else {
    updatedResults = [{ partyCode, votes, percentage: 100 }];
  }

  const updatedState: AggregateResult = {
    level: "state",
    id: stateCode,
    name: (row.state_name as string) ?? existing?.name ?? stateCode,
    stateCode,
    totalPUs: (row.total_pus as number) ?? existing?.totalPUs ?? 0,
    reportedPUs: (row.reported_pus as number) ?? existing?.reportedPUs ?? 0,
    accreditedVoters: (row.accredited_voters as number) ?? existing?.accreditedVoters ?? 0,
    results: updatedResults,
    status: (row.status as AggregateResult["status"]) ?? existing?.status ?? "pending",
    leadingParty: updatedResults[0]?.partyCode,
    overVoted: (row.over_voted as boolean) ?? existing?.overVoted ?? false,
  };

  const newByState = { ...baseByState, [stateCode]: updatedState };

  return {
    electionType: prev?.electionType ?? "presidential",
    byState: newByState,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

// INEC official figures — updated October 2026
const TOTAL_PUS_2027 = 274760;
const TOTAL_PUS_2023 = 176846;
const REGISTERED_VOTERS_2027 = 103_428_715;
const REGISTERED_VOTERS_2023 = 93_469_008;

const ELECTION_LABELS: Record<ElectionType, string> = {
  presidential: "Presidential",
  senate: "Senate (109 seats)",
  house_reps: "House of Reps (360 seats)",
  gubernatorial: "Gubernatorial (36 states)",
};

const ELECTION_ICONS: Record<ElectionType, string> = {
  presidential: "🗳️",
  senate: "🏛️",
  house_reps: "🏢",
  gubernatorial: "🏛️",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "declared") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Declared
      </span>
    );
  }
  if (status === "collating") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block animate-pulse" />
        Collating
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
      Pending
    </span>
  );
}

function NigerianFlag({ width = 40, height = 28 }: { width?: number; height?: number }) {
  const stripe = width / 3;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
      <rect x={0} y={0} width={stripe} height={height} fill="#008751" />
      <rect x={stripe} y={0} width={stripe} height={height} fill="#FFFFFF" />
      <rect x={stripe * 2} y={0} width={stripe} height={height} fill="#008751" />
    </svg>
  );
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span className="text-white/70 text-sm font-mono">Loading...</span>;

  return (
    <div className="text-right">
      <div className="text-white font-mono text-sm font-semibold">
        {now.toLocaleDateString("en-NG", { weekday: "short", year: "numeric", month: "short", day: "numeric", timeZone: "Africa/Lagos" })}
      </div>
      <div className="text-white font-mono text-lg font-bold tabular-nums">
        {now.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Africa/Lagos" })}
      </div>
    </div>
  );
}

interface ElectionCountdownItem {
  label: string;
  shortLabel: string;
  icon: string;
  isoDate: string;
  displayDate: string;
  color: string;
}

const INEC_2027_ELECTIONS: ElectionCountdownItem[] = [
  {
    label: "Presidential",
    shortLabel: "Pres.",
    icon: "🗳️",
    isoDate: "2027-01-16T08:00:00+01:00",
    displayDate: "16 Jan 2027",
    color: "from-green-700 to-green-600",
  },
  {
    label: "Senate",
    shortLabel: "Senate",
    icon: "🏛️",
    isoDate: "2027-01-16T08:00:00+01:00",
    displayDate: "16 Jan 2027",
    color: "from-green-700 to-green-600",
  },
  {
    label: "House of Reps",
    shortLabel: "H. Reps",
    icon: "🏢",
    isoDate: "2027-01-16T08:00:00+01:00",
    displayDate: "16 Jan 2027",
    color: "from-green-700 to-green-600",
  },
  {
    label: "Governorship",
    shortLabel: "Govnr.",
    icon: "🏛️",
    isoDate: "2027-03-06T08:00:00+01:00",
    displayDate: "6 Mar 2027",
    color: "from-emerald-700 to-emerald-600",
  },
];

function useCountdown(isoDate: string) {
  const [parts, setParts] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [status, setStatus] = useState<"counting" | "live" | "done">("counting");

  useEffect(() => {
    const target = new Date(isoDate).getTime();
    // Voting window is 8 hours (08:00–16:00 WAT)
    const votingEnd = target + 8 * 3600_000;

    const tick = () => {
      const now = Date.now();
      if (now >= votingEnd) {
        setStatus("done");
        setParts(null);
        return;
      }
      if (now >= target) {
        setStatus("live");
        setParts(null);
        return;
      }
      const diff = target - now;
      setParts({
        d: Math.floor(diff / 86_400_000),
        h: Math.floor((diff % 86_400_000) / 3_600_000),
        m: Math.floor((diff % 3_600_000) / 60_000),
        s: Math.floor((diff % 60_000) / 1_000),
      });
      setStatus("counting");
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isoDate]);

  return { parts, status };
}

function CountdownCard({ election }: { election: ElectionCountdownItem }) {
  const { parts, status } = useCountdown(election.isoDate);

  return (
    <div className={`bg-gradient-to-br ${election.color} rounded-xl p-3 flex flex-col gap-1.5 min-w-[140px] flex-1`}>
      <div className="flex items-center gap-1.5">
        <span className="text-base">{election.icon}</span>
        <span className="text-white font-bold text-xs uppercase tracking-wide leading-none">
          {election.label}
        </span>
      </div>
      <div className="text-white/80 text-[10px] font-medium">{election.displayDate}</div>

      {status === "counting" && parts ? (
        <div className="mt-0.5 flex gap-1 flex-wrap">
          {[
            { val: parts.d, unit: "d" },
            { val: parts.h, unit: "h" },
            { val: parts.m, unit: "m" },
            { val: parts.s, unit: "s" },
          ].map(({ val, unit }) => (
            <div key={unit} className="bg-white/20 rounded px-1.5 py-0.5 text-center min-w-[30px]">
              <div className="text-white font-black text-sm font-mono tabular-nums leading-none">
                {String(val).padStart(2, "0")}
              </div>
              <div className="text-white/70 text-[9px] font-semibold uppercase">{unit}</div>
            </div>
          ))}
        </div>
      ) : status === "live" ? (
        <div className="mt-0.5 flex items-center gap-1.5 bg-red-500/80 rounded-lg px-2 py-1">
          <span className="w-2 h-2 rounded-full bg-white animate-ping inline-block shrink-0" />
          <span className="text-white font-black text-xs tracking-wide">VOTING LIVE</span>
        </div>
      ) : (
        <div className="mt-0.5 bg-white/10 rounded-lg px-2 py-1">
          <span className="text-white/70 font-bold text-xs">CONCLUDED</span>
        </div>
      )}
    </div>
  );
}

function ElectionCountdownStrip() {
  return (
    <div className="bg-nigeria-dark border-b border-white/10 py-3">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white/60 text-xs font-bold uppercase tracking-widest">
            2027 INEC Election Countdown
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {INEC_2027_ELECTIONS.map((e) => (
            <CountdownCard key={e.label} election={e} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TickerBar({ byState }: { byState: Record<string, AggregateResult> }) {
  const items = useMemo(() => {
    return Object.values(byState)
      .filter((s) => s.leadingParty)
      .map((s) => {
        const party = PARTY_MAP[s.leadingParty!];
        const topResult = s.results.sort((a, b) => b.votes - a.votes)[0];
        const pct = topResult?.percentage?.toFixed(1) ?? "—";
        const reported = Math.round((s.reportedPUs / s.totalPUs) * 100);
        return `${s.name}: ${party?.code ?? s.leadingParty} leads — ${formatVotes(topResult?.votes ?? 0)} votes (${pct}%) | ${reported}% PUs reported`;
      })
      .join("   ·   ");
  }, [byState]);

  return (
    <div className="bg-nigeria-dark border-t border-nigeria-dark/50 py-1.5 ticker-wrap">
      <div className="ticker-content text-white/90 text-xs font-medium px-4">
        {items}
        &nbsp;&nbsp;&nbsp;&nbsp;
        {items}
      </div>
    </div>
  );
}

// Loading skeleton overlay
function LoadingSkeleton() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-nigeria-light/80 backdrop-blur-sm rounded-2xl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-nigeria-green/30 border-t-nigeria-green animate-spin" />
        <span className="text-nigeria-dark font-semibold text-sm">Loading election data…</span>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function ElectionDashboard() {
  const [activeTab, setActiveTab] = useState<ElectionType>("presidential");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeYear, setActiveYear] = useState<2023 | 2027>(2023);
  const [loading, setLoading] = useState(true);
  const [usingDemoData, setUsingDemoData] = useState(false);

  const [lgaResultsCache, setLgaResultsCache] = useState<Record<string, AggregateResult[]>>({});
  const [selectedLGA, setSelectedLGA] = useState<string | null>(null);
  const [stateDetailTab, setStateDetailTab] = useState<"lga" | "senate">("lga");
  const [overVotedResults, setOverVotedResults] = useState<OverVotedRecord[]>([]);
  const [puResultsCache, setPuResultsCache] = useState<Record<string, PUResult[]>>({});
  const [puSearchQuery, setPuSearchQuery] = useState("");

  // Result state — null until loaded
  const [presidentialResults, setPresidentialResults] = useState<ElectionResult | null>(null);
  const [guberResults, setGuberResults] = useState<ElectionResult | null>(null);
  const [senateResults, setSenateResults] = useState<ElectionResult | null>(null);
  const [houseResults, setHouseResults] = useState<ElectionResult | null>(null);

  // ── Load data from Supabase on year change ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setUsingDemoData(false);

      const year = activeYear;

      const [pres, gub, sen, house] = await Promise.all([
        fetchStateResults(`presidential_${year}`),
        fetchStateResults(`gubernatorial_${year}`),
        fetchStateResults(`senate_${year}`),
        fetchStateResults(`house_reps_${year}`),
      ]);

      if (cancelled) return;

      const now = new Date().toISOString();

      // If Supabase returned rows, use them; otherwise fall back to mock data
      const presHasData = Object.keys(pres).length > 0;
      const gubHasData = Object.keys(gub).length > 0;
      const senHasData = Object.keys(sen).length > 0;
      const houseHasData = Object.keys(house).length > 0;

      const anyRealData = presHasData || gubHasData || senHasData || houseHasData;
      if (!anyRealData) setUsingDemoData(true);

      setPresidentialResults(
        presHasData ? { electionType: "presidential", byState: pres, lastUpdated: now } : null
      );
      setGuberResults(
        gubHasData ? { electionType: "gubernatorial", byState: gub, lastUpdated: now } : null
      );
      setSenateResults(
        senHasData ? { electionType: "senate", byState: sen, lastUpdated: now } : null
      );
      setHouseResults(
        houseHasData ? { electionType: "house_reps", byState: house, lastUpdated: now } : null
      );

      setLastUpdated(new Date());
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [activeYear]);

  // ── Realtime subscription (2027 only) ─────────────────────────────────────
  useEffect(() => {
    if (activeYear !== 2027) return;

    const channel = supabase
      .channel("election_results_2027")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ng_election_state_results",
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!row || !row.election_id) return;

          const electionId = row.election_id as string;

          if (electionId === "presidential_2027") {
            setPresidentialResults((prev) => updateStateResult(prev, row));
          } else if (electionId === "gubernatorial_2027") {
            setGuberResults((prev) => updateStateResult(prev, row));
          } else if (electionId === "senate_2027") {
            setSenateResults((prev) => updateStateResult(prev, row));
          } else if (electionId === "house_reps_2027") {
            setHouseResults((prev) => updateStateResult(prev, row));
          }

          setLastUpdated(new Date());
          setUsingDemoData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeYear]);

  // ── Load over-voted results for the active election ───────────────────────
  useEffect(() => {
    fetchOverVotedResults(`${activeTab}_${activeYear}`).then(setOverVotedResults);
  }, [activeTab, activeYear]);

  // ── Load LGA results when a state is selected ────────────────────────────
  useEffect(() => {
    setSelectedLGA(null);
    if (!selectedState) return;
    const cacheKey = `${activeTab}_${activeYear}_${selectedState}`;
    if (lgaResultsCache[cacheKey]) return;
    fetchLGAResults(`${activeTab}_${activeYear}`, selectedState).then((results) => {
      setLgaResultsCache((prev) => ({ ...prev, [cacheKey]: results }));
    });
  }, [selectedState, activeTab, activeYear]);

  // ── Load PU results when an LGA is selected ───────────────────────────────
  useEffect(() => {
    if (!selectedLGA || !selectedState) return;
    const cacheKey = `${activeTab}_${activeYear}_${selectedState}_${selectedLGA}`;
    if (puResultsCache[cacheKey]) return;
    fetchPUResults(`${activeTab}_${activeYear}`, selectedState, selectedLGA).then((results) => {
      setPuResultsCache((prev) => ({ ...prev, [cacheKey]: results }));
    });
  }, [selectedLGA, selectedState, activeTab, activeYear]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const activeResults = useMemo<ElectionResult>(() => {
    const empty = (type: ElectionType): ElectionResult => ({
      electionType: type,
      byState: {},
      lastUpdated: new Date().toISOString(),
    });
    switch (activeTab) {
      case "presidential": return presidentialResults ?? empty("presidential");
      case "gubernatorial": return guberResults ?? empty("gubernatorial");
      case "senate": return senateResults ?? empty("senate");
      case "house_reps": return houseResults ?? empty("house_reps");
    }
  }, [activeTab, presidentialResults, guberResults, senateResults, houseResults]);

  const nationalVoteTotals = useMemo(
    () => getTotalNationalVotes(activeResults.byState),
    [activeResults]
  );
  const totalAccredited = useMemo(
    () => getTotalAccredited(activeResults.byState),
    [activeResults]
  );
  const { total: statesTotalPUs, reported: statesReportedPUs } = useMemo(
    () => getTotalPUs(activeResults.byState),
    [activeResults]
  );
  const partyStateCounts = useMemo(
    () => getPartyStateCounts(activeResults.byState),
    [activeResults]
  );

  const sortedParties = useMemo(() => {
    return PARTIES.filter((p) => nationalVoteTotals[p.code] > 0)
      .map((p) => ({
        party: p,
        votes: nationalVoteTotals[p.code] ?? 0,
        pct: totalAccredited > 0 ? (nationalVoteTotals[p.code] / totalAccredited) * 100 : 0,
        statesLed: partyStateCounts[p.code] ?? 0,
      }))
      .sort((a, b) => b.votes - a.votes);
  }, [nationalVoteTotals, totalAccredited, partyStateCounts]);

  const selectedStateData = useMemo(() => {
    if (!selectedState) return null;
    const stateResult = activeResults.byState[selectedState];
    const stateInfo = STATE_MAP[selectedState];
    if (!stateResult || !stateInfo) return null;
    const lgaCacheKey = `${activeTab}_${activeYear}_${selectedState}`;
    const lgaResults = lgaResultsCache[lgaCacheKey] ?? [];
    const puCacheKey = selectedLGA ? `${activeTab}_${activeYear}_${selectedState}_${selectedLGA}` : null;
    const puResults = puCacheKey ? (puResultsCache[puCacheKey] ?? []) : [];
    return { stateResult, stateInfo, lgaResults, puResults };
  }, [selectedState, selectedLGA, activeResults, lgaResultsCache, puResultsCache, activeTab, activeYear]);

  const cartogramResults = useMemo(
    () => Object.values(activeResults.byState),
    [activeResults]
  );

  const totalRegistered = activeYear === 2027 ? REGISTERED_VOTERS_2027 : REGISTERED_VOTERS_2023;

  // The ticker always uses presidential results for context
  const tickerByState = useMemo(
    () => presidentialResults?.byState ?? activeResults.byState,
    [presidentialResults, activeResults]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F0FAF4] flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header className="bg-nigeria-green shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          {/* Mobile: title + live badge row */}
          <div className="flex sm:hidden items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded overflow-hidden border border-white/20">
                <NigerianFlag width={30} height={20} />
              </div>
              <div>
                <h1 className="text-white font-black text-sm leading-tight">
                  Nigerians Monitor Your Elections
                </h1>
                <p className="text-white/70 text-[10px] font-light">Your vote must count</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-white live-dot" />
              LIVE
            </div>
          </div>
          <div className="hidden sm:block text-center">
            <h1 className="text-white font-black text-xl sm:text-2xl md:text-3xl leading-tight tracking-tight">
              Nigerians Monitor Your Elections
            </h1>
            <p className="text-white/80 text-xs sm:text-sm italic font-light mt-0.5">Your vote must count</p>
          </div>

          {/* Desktop: three-column layout */}
          <div className="hidden sm:flex items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-3 shrink-0">
              <div className="rounded overflow-hidden shadow-md border border-white/20">
                <NigerianFlag width={48} height={32} />
              </div>
              <div>
                <div className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full tracking-widest uppercase">NMYE 2027</div>
                <div className="text-white/70 text-xs mt-0.5">Official Collation Monitor</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <LiveClock />
              <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
                <span className="w-2 h-2 rounded-full bg-white live-dot" />
                LIVE
              </div>
            </div>
          </div>
        </div>

        {/* Ticker */}
        <TickerBar byState={tickerByState} />
      </header>

      {/* ── STATS STRIP ─────────────────────────────────────────────── */}
      <StatsStrip
        totalPUs={activeYear === 2027 ? TOTAL_PUS_2027 : TOTAL_PUS_2023}
        reportedPUs={statesReportedPUs}
        registeredVoters={totalRegistered}
        accreditedVoters={totalAccredited}
      />

      {/* ── YEAR TOGGLE BAR ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 py-2">
        <div className="max-w-screen-2xl mx-auto px-4 flex items-center justify-between gap-4">
          {/* Left: year buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">View:</span>
            {([2023, 2027] as const).map((year) => (
              <button
                key={year}
                onClick={() => {
                  setActiveYear(year);
                  setSelectedState(null);
                  setSelectedLGA(null);
                }}
                className={
                  activeYear === year
                    ? "px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-nigeria-green text-white"
                    : "px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200"
                }
              >
                {year === 2023 ? "2023 Results" : "2027 Live"}
              </button>
            ))}
          </div>

          {/* Right: banner */}
          {activeYear === 2023 ? (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-medium">
              <span>⚠</span> Testing Mode — 2023 INEC Official Results
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-green-50 border border-nigeria-green/30 text-nigeria-green px-3 py-1.5 rounded-lg text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-nigeria-green animate-pulse inline-block" />
              2027 Live Monitoring Mode
            </div>
          )}
        </div>
      </div>

      {/* 2027 election countdowns */}
      {activeYear === 2027 && <ElectionCountdownStrip />}

      {/* No data notice */}
      {usingDemoData && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-screen-2xl mx-auto px-4 py-2 text-xs text-amber-700 font-medium">
            No results in the database yet for {activeYear}. Data will appear automatically when INEC begins collation.
          </div>
        </div>
      )}

      {/* ── ELECTION TABS ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-0 -mb-px">
            {(Object.keys(ELECTION_LABELS) as ElectionType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedState(null);
                  setSelectedLGA(null);
                }}
                className={[
                  "flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors",
                  activeTab === tab
                    ? "border-nigeria-green text-nigeria-green bg-nigeria-light/40"
                    : "border-transparent text-gray-500 hover:text-nigeria-green hover:bg-nigeria-light/20",
                ].join(" ")}
              >
                <span>{ELECTION_ICONS[tab]}</span>
                {ELECTION_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-6 flex-1">
        <div className="relative flex flex-col lg:flex-row gap-6">

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-nigeria-light/70 backdrop-blur-sm rounded-2xl min-h-[400px]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-4 border-nigeria-green/30 border-t-nigeria-green animate-spin" />
                <span className="text-nigeria-dark font-semibold text-sm">
                  Loading {activeYear} election data…
                </span>
              </div>
            </div>
          )}

          {/* ── LEFT: Party Results ───────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Panel header */}
              <div className="bg-nigeria-green/5 border-b border-nigeria-green/10 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-nigeria-dark font-bold text-lg">
                    Results Summary
                  </h2>
                  <p className="text-gray-500 text-sm">
                    {ELECTION_LABELS[activeTab]}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Data as of</div>
                  <div className="text-xs font-semibold text-nigeria-dark tabular-nums" suppressHydrationWarning>
                    {toWATTime(lastUpdated)}
                  </div>
                </div>
              </div>

              {/* Collation progress */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                  <span className="font-medium">Polling Units Reporting</span>
                  <span className="font-bold text-nigeria-dark">
                    {statesReportedPUs.toLocaleString()} / {statesTotalPUs.toLocaleString()}
                    &nbsp;
                    <span className="text-nigeria-green">
                      ({statesTotalPUs > 0 ? Math.round((statesReportedPUs / statesTotalPUs) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-nigeria-green rounded-full transition-all duration-500"
                    style={{
                      width: `${statesTotalPUs > 0 ? Math.round((statesReportedPUs / statesTotalPUs) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Party rows */}
              <div className="divide-y divide-gray-50 px-5 py-2">
                {sortedParties.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <div className="text-4xl mb-3">🗳️</div>
                    <p className="text-sm font-semibold text-gray-500">No results yet.</p>
                    <p className="text-xs mt-1">Data loads as INEC begins collation.</p>
                  </div>
                ) : (
                  sortedParties.map(({ party, votes, pct, statesLed }, idx) => (
                    <PartyBar
                      key={party.code}
                      party={party}
                      votes={votes}
                      totalVotes={totalAccredited}
                      rank={idx + 1}
                      statesLed={statesLed}
                    />
                  ))
                )}
              </div>

              {/* National leading note */}
              {sortedParties.length > 0 && (
                <div className="mx-5 mb-5 mt-2 rounded-xl bg-nigeria-light border border-nigeria-green/20 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: sortedParties[0].party.color }}
                    >
                      {sortedParties[0].party.code}
                    </div>
                    <div>
                      <div className="text-nigeria-dark font-bold text-sm">
                        {sortedParties[0].party.name} leading nationally
                      </div>
                      <div className="text-gray-600 text-xs mt-0.5">
                        {formatVotes(sortedParties[0].votes)} votes &nbsp;·&nbsp;
                        {sortedParties[0].pct.toFixed(1)}% share &nbsp;·&nbsp;
                        Leading in {sortedParties[0].statesLed} state{sortedParties[0].statesLed !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Cartogram ─────────────────────────────────────── */}
          <div className="lg:w-[520px] shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-nigeria-green/5 border-b border-nigeria-green/10 px-5 py-4">
                <h2 className="text-nigeria-dark font-bold text-lg">Results by State</h2>
                <p className="text-gray-500 text-sm">
                  Click a state to see its result detail
                </p>
              </div>

              <div className="px-4 pt-4 pb-3">
                <NigeriaCartogram
                  results={cartogramResults}
                  onStateClick={(code) =>
                    setSelectedState((prev) => (prev === code ? null : code))
                  }
                  selectedState={selectedState}
                />
              </div>

              {/* Legend */}
              <div className="px-4 pb-4">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">
                  Leading Party
                </div>
                <div className="flex flex-wrap gap-2">
                  {PARTIES.filter(
                    (p) => partyStateCounts[p.code] && partyStateCounts[p.code] > 0
                  ).map((p) => (
                    <div key={p.code} className="flex items-center gap-1.5">
                      <PartyBadge party={p} size="sm" />
                      <span className="text-xs text-gray-700 font-medium">
                        {p.code} ({partyStateCounts[p.code]})
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-sm bg-gray-300 inline-block" />
                    <span className="text-xs text-gray-500">Pending</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── STATE DETAIL PANEL ───────────────────────────────────────── */}
        {selectedStateData && (() => {
          const stateParties = selectedStateData.stateResult.results
            .filter((r) => r.votes > 0)
            .slice(0, 4);

          const stateSenateDistricts = SENATORIAL_DISTRICTS.filter(
            (d) => d.stateCode === selectedState
          );

          const lgaResults = selectedStateData.lgaResults;
          const senateLGAGroups: AggregateResult[][] = [[], [], []];
          lgaResults.forEach((lga, i) => {
            senateLGAGroups[Math.floor(i / Math.ceil(lgaResults.length / 3))]?.push(lga) ?? senateLGAGroups[2].push(lga);
          });

          return (
            <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              {/* ── Header ── */}
              <div className="bg-nigeria-green text-white px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-white/60 text-xs mb-1">
                    <button onClick={() => { setSelectedState(null); setSelectedLGA(null); }} className="hover:text-white font-medium">All States</button>
                    <span>/</span>
                    <span className="text-white font-bold">{selectedStateData.stateInfo.name}</span>
                  </div>
                  <h3 className="font-bold text-lg">{selectedStateData.stateInfo.name} State</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-white/70 flex-wrap">
                    <span>Capital: {selectedStateData.stateInfo.capital}</span>
                    <span>·</span>
                    <span>Zone: {selectedStateData.stateInfo.zone}</span>
                    <span>·</span>
                    <span>{selectedStateData.stateInfo.lgas} LGAs</span>
                    <span>·</span>
                    <StatusBadge status={selectedStateData.stateResult.status} />
                    {selectedStateData.stateResult.overVoted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">⚠ OVER-VOTED</span>
                    )}
                  </div>
                </div>
                <button onClick={() => { setSelectedState(null); setSelectedLGA(null); }} className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-2 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* ── State party summary strip ── */}
              <div className="grid divide-x divide-gray-100 border-b border-gray-100"
                style={{ gridTemplateColumns: `repeat(${Math.min(stateParties.length, 4)}, 1fr)` }}>
                {stateParties.map((pr) => {
                  const party = PARTY_MAP[pr.partyCode];
                  const total = stateParties.reduce((s, r) => s + r.votes, 0);
                  return (
                    <div key={pr.partyCode} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-1">
                        {party && <PartyBadge party={party} size="sm" />}
                        <span className="text-xs font-bold text-gray-700">{pr.partyCode}</span>
                      </div>
                      <div className="text-lg font-black text-nigeria-dark tabular-nums">{formatVotes(pr.votes)}</div>
                      <div className="text-xs text-gray-500">{total > 0 ? ((pr.votes / total) * 100).toFixed(1) : "0.0"}%</div>
                    </div>
                  );
                })}
              </div>

              {/* ── Tabs ── */}
              <div className="border-b border-gray-100 px-5">
                <div className="flex gap-0 -mb-px">
                  {(["lga", "senate"] as const).map((tab) => (
                    <button key={tab} onClick={() => { setStateDetailTab(tab); setSelectedLGA(null); }}
                      className={["px-4 py-2.5 text-xs font-bold border-b-2 transition-colors",
                        stateDetailTab === tab ? "border-nigeria-green text-nigeria-green" : "border-transparent text-gray-400 hover:text-gray-600"].join(" ")}>
                      {tab === "lga" ? `LGAs (${selectedStateData.stateInfo.lgas})` : "Senatorial Districts"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── LGA tab: each row expands inline to show PUs ── */}
              {stateDetailTab === "lga" && (
                lgaResults.length === 0 ? (
                  <div className="px-5 py-10 text-center text-gray-400">
                    <p className="text-sm font-medium">No LGA data loaded yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                          <th className="text-left px-4 py-3 w-8"></th>
                          <th className="text-left px-2 py-3">LGA</th>
                          {stateParties.map((pr) => (
                            <th key={pr.partyCode} className="text-right px-3 py-3">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: PARTY_MAP[pr.partyCode]?.color ?? "#9CA3AF" }} />
                                {pr.partyCode}
                              </span>
                            </th>
                          ))}
                          <th className="text-right px-3 py-3">Total</th>
                          <th className="text-center px-3 py-3">Winner</th>
                          <th className="text-center px-3 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lgaResults.map((lga) => {
                          const totalVotes = lga.results.reduce((s, r) => s + r.votes, 0);
                          const winner = lga.results[0];
                          const winnerParty = winner ? PARTY_MAP[winner.partyCode] : null;
                          const isExpanded = selectedLGA === lga.name;
                          const puCacheKey = `${activeTab}_${activeYear}_${selectedState}_${lga.name}`;
                          const puRows = puResultsCache[puCacheKey] ?? [];

                          return (
                            <>
                              {/* LGA row */}
                              <tr
                                key={lga.id}
                                className={`border-b border-gray-50 cursor-pointer transition-colors ${isExpanded ? "bg-nigeria-light/50" : "hover:bg-nigeria-light/30"}`}
                                onClick={() => { setSelectedLGA(isExpanded ? null : lga.name); setPuSearchQuery(""); }}
                              >
                                <td className="px-4 py-2.5 text-gray-400 text-xs">
                                  <span className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                                </td>
                                <td className="px-2 py-2.5">
                                  <div className="font-semibold text-gray-800 text-sm">{lga.name}</div>
                                  <div className="text-xs text-gray-400 mt-0.5">{lga.totalPUs} PUs · {lga.accreditedVoters.toLocaleString()} accredited</div>
                                </td>
                                {stateParties.map((sp) => {
                                  const pr = lga.results.find((r) => r.partyCode === sp.partyCode);
                                  const isWinner = pr?.partyCode === winner?.partyCode;
                                  return (
                                    <td key={sp.partyCode} className={`px-3 py-2.5 text-right font-mono text-xs ${isWinner ? "font-bold text-gray-900" : "text-gray-500"}`}>
                                      {pr ? pr.votes.toLocaleString() : "—"}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-gray-700">{totalVotes.toLocaleString()}</td>
                                <td className="px-3 py-2.5 text-center">
                                  {winnerParty ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-bold" style={{ backgroundColor: winnerParty.color }}>
                                      {winnerParty.code}
                                    </span>
                                  ) : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-center"><StatusBadge status={lga.status} /></td>
                              </tr>

                              {/* Inline PU rows when expanded */}
                              {isExpanded && (
                                <tr key={`${lga.id}-pu`}>
                                  <td colSpan={stateParties.length + 5} className="p-0 bg-gray-50 border-b border-gray-200">
                                    {puRows.length === 0 ? (
                                      <div className="px-10 py-4 text-xs text-gray-400 italic">Loading polling units…</div>
                                    ) : (() => {
                                      const q = puSearchQuery.toLowerCase().trim();
                                      const filteredPUs = q
                                        ? puRows.filter((pu) =>
                                            pu.puName.toLowerCase().includes(q) ||
                                            pu.puCode.toLowerCase().includes(q)
                                          )
                                        : puRows;
                                      return (
                                      <>
                                      <div className="px-10 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                                        <div className="relative flex-1 max-w-xs">
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                                          </svg>
                                          <input
                                            type="text"
                                            placeholder="Search polling units…"
                                            value={puSearchQuery}
                                            onChange={(e) => setPuSearchQuery(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-nigeria-green focus:border-nigeria-green"
                                          />
                                        </div>
                                        <span className="text-[10px] text-gray-400 shrink-0">
                                          {filteredPUs.length} of {puRows.length} PUs
                                        </span>
                                        <button
                                          onClick={() => {
                                            const stateName = selectedStateData?.stateInfo.name ?? selectedState ?? "";
                                            const partyHeaders = stateParties.map((sp) => sp.partyCode).join(",");
                                            const header = `State,LGA,Registration Area,Ward,PU Code,PU Name,Accredited,${partyHeaders},Total Votes,Winner`;
                                            const rows = puRows.map((pu) => {
                                              const wardCode = pu.puCode.split("/")[2] ?? "";
                                              const partyVotes = stateParties.map((sp) => {
                                                const pr = pu.parties.find((p) => p.partyCode === sp.partyCode);
                                                return pr?.votes ?? 0;
                                              }).join(",");
                                              const winner = pu.parties[0]?.partyCode ?? "";
                                              const ra = pu.registrationArea || `Ward ${wardCode}`;
                                              return [
                                                `"${stateName}"`,
                                                `"${lga.name}"`,
                                                `"${ra}"`,
                                                `"Ward ${wardCode}"`,
                                                `"${pu.puCode}"`,
                                                `"${pu.puName}"`,
                                                pu.accreditedVoters,
                                                partyVotes,
                                                pu.totalVotes,
                                                winner,
                                              ].join(",");
                                            });
                                            const csv = [header, ...rows].join("\n");
                                            const blob = new Blob([csv], { type: "text/csv" });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = `${stateName}_${lga.name}_PU_Results_${activeYear}.csv`.replace(/\s+/g, "_");
                                            a.click();
                                            URL.revokeObjectURL(url);
                                          }}
                                          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-nigeria-green border border-nigeria-green/30 rounded-lg hover:bg-nigeria-green hover:text-white transition-colors shrink-0"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                                            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                                          </svg>
                                          Download CSV
                                        </button>
                                      </div>
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-gray-100 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                                            <th className="text-left px-10 py-2">Polling Unit Name / Code</th>
                                            <th className="text-right px-3 py-2">Accredited</th>
                                            {stateParties.map((sp) => (
                                              <th key={sp.partyCode} className="text-right px-3 py-2 font-bold" style={{ color: PARTY_MAP[sp.partyCode]?.color ?? "#9CA3AF" }}>
                                                {sp.partyCode}
                                              </th>
                                            ))}
                                            <th className="text-right px-3 py-2">Total</th>
                                            <th className="text-center px-3 py-2">Winner</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {filteredPUs.length === 0 && (
                                            <tr><td colSpan={stateParties.length + 4} className="px-10 py-4 text-xs text-gray-400 italic text-center">No polling units match "{puSearchQuery}"</td></tr>
                                          )}
                                          {(() => {
                                            // Group PUs by registration area
                                            const raGroups: { raName: string; wardCode: string; pus: PUResult[] }[] = [];
                                            let lastRA = "";
                                            for (const pu of filteredPUs) {
                                              const wardCode = pu.puCode.split("/")[2] ?? "00";
                                              const raName = pu.registrationArea || `Ward ${wardCode}`;
                                              if (raName !== lastRA) {
                                                raGroups.push({ raName, wardCode, pus: [] });
                                                lastRA = raName;
                                              }
                                              raGroups[raGroups.length - 1].pus.push(pu);
                                            }
                                            return raGroups.map(({ raName, wardCode, pus: wardPUs }) => (
                                              <>
                                                <tr key={raName} className="bg-nigeria-light/60 border-b border-nigeria-green/10">
                                                  <td colSpan={stateParties.length + 4} className="px-10 py-1.5">
                                                    <div className="flex items-center gap-3">
                                                      <span className="text-[11px] font-black text-nigeria-green uppercase tracking-widest">{raName}</span>
                                                      <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">Ward {wardCode}</span>
                                                      <span className="text-[10px] text-gray-400">{wardPUs.length} PU{wardPUs.length !== 1 ? "s" : ""}</span>
                                                    </div>
                                                  </td>
                                                </tr>
                                                {wardPUs.map((pu) => {
                                                  const puWinner = pu.parties[0];
                                                  const puWinnerParty = puWinner ? PARTY_MAP[puWinner.partyCode] : null;
                                                  return (
                                                    <tr key={pu.puCode} className={pu.overVoted ? "bg-red-50" : "hover:bg-white"}>
                                                      <td className="px-10 py-1.5">
                                                        <div className="font-medium text-gray-700 leading-tight">{pu.puName}</div>
                                                        <div className="text-gray-400 font-mono text-[10px]">{pu.puCode}</div>
                                                        {pu.overVoted && <span className="text-red-600 text-[10px] font-bold">⚠ over-voted</span>}
                                                      </td>
                                                      <td className="px-3 py-1.5 text-right font-mono text-gray-500">{pu.accreditedVoters.toLocaleString()}</td>
                                                      {stateParties.map((sp) => {
                                                        const pr = pu.parties.find((p) => p.partyCode === sp.partyCode);
                                                        const isW = pr?.partyCode === puWinner?.partyCode;
                                                        return (
                                                          <td key={sp.partyCode} className={`px-3 py-1.5 text-right font-mono ${isW ? "font-bold text-gray-900" : "text-gray-500"}`}>
                                                            {pr ? pr.votes.toLocaleString() : "—"}
                                                          </td>
                                                        );
                                                      })}
                                                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-gray-700">{pu.totalVotes.toLocaleString()}</td>
                                                      <td className="px-3 py-1.5 text-center">
                                                        {puWinnerParty ? (
                                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: puWinnerParty.color }}>
                                                            {puWinnerParty.code}
                                                          </span>
                                                        ) : "—"}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </>
                                            ));
                                          })()}
                                        </tbody>
                                      </table>
                                      </>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* ── Senatorial District tab content ── */}
              {!selectedLGA && stateDetailTab === "senate" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-3">Senatorial District</th>
                        {stateParties.map((pr) => {
                          const p = PARTY_MAP[pr.partyCode];
                          return (
                            <th key={pr.partyCode} className="text-right px-3 py-3">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: p?.color ?? "#9CA3AF" }} />
                                {pr.partyCode}
                              </span>
                            </th>
                          );
                        })}
                        <th className="text-right px-3 py-3">Total</th>
                        <th className="text-center px-3 py-3">Winner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stateSenateDistricts.map((district, di) => {
                        // Sum LGA votes for this district's geographic third
                        const districtLGAs = lgaResults.length > 0
                          ? senateLGAGroups[di] ?? []
                          : [];

                        // If no LGA data, fall back to state total / num_districts
                        const partyTotals: Record<string, number> = {};
                        if (districtLGAs.length > 0) {
                          for (const lga of districtLGAs) {
                            for (const pr of lga.results) {
                              partyTotals[pr.partyCode] = (partyTotals[pr.partyCode] ?? 0) + pr.votes;
                            }
                          }
                        } else {
                          const divBy = stateSenateDistricts.length || 1;
                          for (const pr of stateParties) {
                            partyTotals[pr.partyCode] = Math.round(pr.votes / divBy);
                          }
                        }

                        const totalVotes = Object.values(partyTotals).reduce((s, v) => s + v, 0);
                        const winnerId = Object.entries(partyTotals).sort((a, b) => b[1] - a[1])[0]?.[0];
                        const winnerParty = winnerId ? PARTY_MAP[winnerId] : null;
                        const isEstimated = districtLGAs.length === 0;

                        return (
                          <tr key={district.id} className="hover:bg-nigeria-light/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-800">{district.name}</div>
                              {isEstimated && (
                                <div className="text-xs text-amber-500 mt-0.5">Estimated from state total</div>
                              )}
                            </td>
                            {stateParties.map((sp) => {
                              const votes = partyTotals[sp.partyCode] ?? 0;
                              const isWinner = sp.partyCode === winnerId;
                              return (
                                <td key={sp.partyCode} className={`px-3 py-3 text-right font-mono text-xs ${isWinner ? "font-bold text-gray-900" : "text-gray-500"}`}>
                                  {votes.toLocaleString()}
                                </td>
                              );
                            })}
                            <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-gray-700">
                              {totalVotes.toLocaleString()}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {winnerParty ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-bold" style={{ backgroundColor: winnerParty.color }}>
                                  {winnerParty.code}
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {lgaResults.length === 0 && (
                    <div className="px-5 py-3 text-xs text-amber-600 bg-amber-50 border-t border-amber-100">
                      District totals estimated from state data.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── SENATE / HOUSE sub-view ──────────────────────────────────── */}
        {(activeTab === "senate" || activeTab === "house_reps") && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-nigeria-green/5 border-b border-nigeria-green/10 px-5 py-4">
              <h3 className="text-nigeria-dark font-bold text-lg">
                {activeTab === "senate"
                  ? "Senatorial Districts Breakdown"
                  : "Federal Constituency Breakdown"}
              </h3>
              <p className="text-gray-500 text-sm">
                {activeTab === "senate"
                  ? "109 senatorial districts across 36 states + FCT"
                  : "360 federal constituencies across all 36 states + FCT"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      {activeTab === "senate" ? "District" : "Constituency"}
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      State
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Accredited
                    </th>
                    <th className="text-left px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Leader
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Lead Votes
                    </th>
                    <th className="text-right px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      PUs Rep.
                    </th>
                    <th className="text-center px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeTab === "senate"
                    ? SENATORIAL_DISTRICTS.slice(0, 50).map((d) => {
                        const r = activeResults.bySenatorialDistrict?.[d.id];
                        if (!r) return null;
                        const top = [...r.results].sort((a, b) => b.votes - a.votes)[0];
                        const party = PARTY_MAP[top?.partyCode ?? ""];
                        return (
                          <tr key={d.id} className="hover:bg-nigeria-light/30 transition-colors">
                            <td className="px-4 py-2.5 font-semibold text-gray-800">{d.name}</td>
                            <td className="px-3 py-2.5 text-gray-600">{STATE_MAP[d.stateCode]?.name ?? d.stateCode}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-600">{r.accreditedVoters.toLocaleString()}</td>
                            <td className="px-3 py-2.5">
                              {party ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-xs font-bold"
                                  style={{ backgroundColor: party.color }}
                                >
                                  {party.code}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-gray-800">{top?.votes.toLocaleString() ?? "—"}</td>
                            <td className="px-3 py-2.5 text-right text-xs text-gray-600">{r.reportedPUs}/{r.totalPUs}</td>
                            <td className="px-3 py-2.5 text-center"><StatusBadge status={r.status} /></td>
                          </tr>
                        );
                      })
                    : Object.entries(activeResults.byConstituency ?? {})
                        .slice(0, 60)
                        .map(([id, r]) => {
                          const top = [...r.results].sort((a, b) => b.votes - a.votes)[0];
                          const party = PARTY_MAP[top?.partyCode ?? ""];
                          return (
                            <tr key={id} className="hover:bg-nigeria-light/30 transition-colors">
                              <td className="px-4 py-2.5 font-semibold text-gray-800 text-xs">{r.name}</td>
                              <td className="px-3 py-2.5 text-gray-600 text-xs">{STATE_MAP[r.stateCode ?? ""]?.name ?? r.stateCode}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-600">{r.accreditedVoters.toLocaleString()}</td>
                              <td className="px-3 py-2.5">
                                {party ? (
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-xs font-bold"
                                    style={{ backgroundColor: party.color }}
                                  >
                                    {party.code}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-gray-800">{top?.votes.toLocaleString() ?? "—"}</td>
                              <td className="px-3 py-2.5 text-right text-xs text-gray-600">{r.reportedPUs}/{r.totalPUs}</td>
                              <td className="px-3 py-2.5 text-center"><StatusBadge status={r.status} /></td>
                            </tr>
                          );
                        })}
                </tbody>
              </table>
              {((activeTab === "senate" && SENATORIAL_DISTRICTS.length > 50) ||
                (activeTab === "house_reps" && Object.keys(activeResults.byConstituency ?? {}).length > 60)) && (
                <div className="px-4 py-3 text-center text-xs text-gray-400 border-t border-gray-100">
                  Showing first {activeTab === "senate" ? 50 : 60} of{" "}
                  {activeTab === "senate"
                    ? SENATORIAL_DISTRICTS.length
                    : Object.keys(activeResults.byConstituency ?? {}).length}{" "}
                  records
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── FLAGGED OVER-VOTED RESULTS ───────────────────────────────── */}
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-red-600 text-xl font-black">⚠</span>
              <div>
                <h3 className="text-red-700 font-bold text-base">
                  Flagged: Over-Voted Results
                </h3>
                <p className="text-red-500 text-xs mt-0.5">
                  Results where total votes cast exceeds accredited voters — an INEC collation anomaly
                </p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${overVotedResults.length > 0 ? "bg-red-600 text-white animate-pulse" : "bg-gray-100 text-gray-500"}`}>
              {overVotedResults.length === 0 ? "None flagged" : `${overVotedResults.length} flagged`}
            </div>
          </div>

          {overVotedResults.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm font-semibold text-gray-500">No over-voting detected</p>
              <p className="text-xs mt-1 text-gray-400">
                All reported results are within accredited voter counts.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-50/60 border-b border-red-100 text-xs font-bold text-red-600 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">State</th>
                    <th className="text-left px-4 py-3">LGA</th>
                    <th className="text-right px-3 py-3">Accredited</th>
                    <th className="text-right px-3 py-3">Votes Cast</th>
                    <th className="text-right px-3 py-3 text-red-700">Excess</th>
                    {["APC", "PDP", "LP", "NNPP"].map((pc) => (
                      <th key={pc} className="text-right px-3 py-3 text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: PARTY_MAP[pc]?.color ?? "#9CA3AF" }} />
                          {pc}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {overVotedResults.map((r, i) => {
                    const stateName = STATE_MAP[r.stateCode]?.name ?? r.stateName;
                    return (
                      <tr key={i} className="hover:bg-red-50/40 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-gray-800">{stateName}</span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-700">{r.lgaName}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-gray-600">
                          {r.accreditedVoters.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-gray-800">
                          {r.totalVotesCast.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs font-black text-red-600">
                          +{r.overage.toLocaleString()}
                        </td>
                        {["APC", "PDP", "LP", "NNPP"].map((pc) => {
                          const party = r.parties.find((p) => p.partyCode === pc);
                          return (
                            <td key={pc} className="px-3 py-2.5 text-right font-mono text-xs text-gray-500">
                              {party ? party.votes.toLocaleString() : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-red-50/40 border-t border-red-100 text-xs text-red-500">
                Flag these to INEC collation officers. Data: INEC result sheets via OCR.
              </div>
            </div>
          )}
        </div>

        {/* ── QUEUE MONITOR ───────────────────────────────────────────── */}
        <div className="mt-6">
          <QueueMonitor />
        </div>

      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="bg-nigeria-dark text-white mt-auto">
        <div className="max-w-screen-2xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                <NigerianFlag width={24} height={16} />
                <span className="font-bold text-sm">Nigerians Monitor Your Elections</span>
              </div>
              <p className="text-white/60 text-xs">
                Data: INEC Nigeria · inecelectionresults.ng
              </p>
              <p className="text-white/60 text-xs">
                Powered by OCR collation engine &nbsp;·&nbsp; © 2027 NMYE — Your vote must count
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/60">
              <button className="hover:text-white transition-colors">Privacy</button>
              <span>·</span>
              <button className="hover:text-white transition-colors">About</button>
              <span>·</span>
              <button className="hover:text-white transition-colors">API</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
