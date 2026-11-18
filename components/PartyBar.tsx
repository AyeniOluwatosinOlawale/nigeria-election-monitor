"use client";

import { useEffect, useRef, useState } from "react";
import type { Party } from "@/lib/types";

function PartyBadge({ party, size = "md" }: { party: Party; size?: "sm" | "md" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const dim = size === "sm" ? "w-6 h-6" : "w-10 h-7";
  const textSize = size === "sm" ? "text-[9px]" : "text-xs";

  if (party.logo && !imgFailed) {
    return (
      <div className={`${dim} rounded-md overflow-hidden shrink-0 bg-white border border-gray-200 flex items-center justify-center`}>
        <img
          src={party.logo}
          alt={party.code}
          className="w-full h-full object-contain"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }
  return (
    <div
      className={`${dim} rounded-md flex items-center justify-center text-white ${textSize} font-black shrink-0 shadow-sm`}
      style={{ backgroundColor: party.color }}
    >
      {party.shortName ?? party.code}
    </div>
  );
}

export { PartyBadge };

interface PartyBarProps {
  party: Party;
  votes: number;
  totalVotes: number;
  rank: number;
  statesLed: number;
}

function formatVotesFull(n: number): string {
  return n.toLocaleString("en-NG");
}

export default function PartyBar({
  party,
  votes,
  totalVotes,
  rank,
  statesLed,
}: PartyBarProps) {
  const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const isLeading = rank === 1;

  return (
    <div
      ref={ref}
      className={[
        "py-3 transition-colors",
        isLeading ? "bg-nigeria-light/30" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        {/* Rank */}
        <div
          className={[
            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0",
            isLeading
              ? "bg-nigeria-green text-white"
              : "bg-gray-100 text-gray-500",
          ].join(" ")}
        >
          {rank}
        </div>

        {/* Party badge */}
        <PartyBadge party={party} size="md" />

        {/* Name + bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-800 truncate">
                {party.name}
              </span>
              {isLeading && (
                <span className="text-[10px] font-bold text-nigeria-green bg-nigeria-light border border-nigeria-green/30 px-1.5 py-0.5 rounded-full shrink-0">
                  LEADING
                </span>
              )}
            </div>
            <div className="text-right shrink-0 ml-2">
              <span className="text-sm font-black text-gray-900">
                {percentage.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: animated ? `${Math.max(percentage, 0.3)}%` : "0%",
                backgroundColor: party.color,
              }}
            />
          </div>

          {/* Sub-info */}
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500 font-mono">
              {formatVotesFull(votes)} votes
            </span>
            <span className="text-xs text-gray-400">
              {statesLed > 0 ? `Leads in ${statesLed} state${statesLed !== 1 ? "s" : ""}` : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
