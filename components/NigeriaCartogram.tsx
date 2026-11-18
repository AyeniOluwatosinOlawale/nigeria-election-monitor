"use client";

import { useState } from "react";
import type { AggregateResult } from "@/lib/types";
import { STATE_GRID, STATE_MAP, PARTY_MAP } from "@/lib/nigeria-data";

interface NigeriaCartogramProps {
  results: AggregateResult[];
  onStateClick: (code: string) => void;
  selectedState?: string | null;
}

interface TooltipData {
  stateCode: string;
  x: number;
  y: number;
}

const CELL_WIDTH = 60;
const CELL_HEIGHT = 46;
const GAP = 3;
const COLS = 9;
const ROWS = 6;

export default function NigeriaCartogram({
  results,
  onStateClick,
  selectedState,
}: NigeriaCartogramProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Build lookup from stateCode → result
  const resultMap = Object.fromEntries(
    results.map((r) => [r.id, r])
  );

  const totalWidth = COLS * CELL_WIDTH + (COLS - 1) * GAP;
  const totalHeight = ROWS * CELL_HEIGHT + (ROWS - 1) * GAP;

  const tooltipResult = tooltip ? resultMap[tooltip.stateCode] : null;
  const tooltipState = tooltip ? STATE_MAP[tooltip.stateCode] : null;
  const tooltipParty = tooltipResult?.leadingParty
    ? PARTY_MAP[tooltipResult.leadingParty]
    : null;
  const tooltipTopResult = tooltipResult
    ? [...tooltipResult.results].sort((a, b) => b.votes - a.votes)[0]
    : null;

  return (
    <div className="relative select-none">
      {/* Grid container */}
      <div
        className="relative"
        style={{ width: totalWidth, height: totalHeight, margin: "0 auto" }}
      >
        {STATE_GRID.map(({ code, col, row }) => {
          const result = resultMap[code];
          const party = result?.leadingParty ? PARTY_MAP[result.leadingParty] : null;
          const isSelected = selectedState === code;
          const isPending = !result || result.status === "pending";
          const isCollating = result?.status === "collating";

          const left = col * (CELL_WIDTH + GAP);
          const top = row * (CELL_HEIGHT + GAP);
          const bgColor = party?.color ?? "#D1D5DB";

          const reportedPct = result
            ? Math.round((result.reportedPUs / result.totalPUs) * 100)
            : 0;

          return (
            <button
              key={code}
              className={[
                "absolute rounded-md flex flex-col items-center justify-center cursor-pointer",
                "transition-all duration-150 hover:scale-110 hover:z-10 hover:shadow-lg",
                "text-white font-black text-xs",
                isSelected ? "ring-4 ring-yellow-400 ring-offset-1 scale-105 z-20 shadow-xl" : "",
              ].join(" ")}
              style={{
                left,
                top,
                width: CELL_WIDTH,
                height: CELL_HEIGHT,
                backgroundColor: bgColor,
                opacity: isPending ? 0.5 : 1,
              }}
              onClick={() => onStateClick(code)}
              onMouseEnter={(e) => {
                const rect = (e.target as HTMLElement)
                  .closest(".relative")
                  ?.getBoundingClientRect();
                setTooltip({ stateCode: code, x: left, y: top });
              }}
              onMouseLeave={() => setTooltip(null)}
              title={STATE_MAP[code]?.name ?? code}
            >
              <span className="font-black text-xs tracking-tight drop-shadow-sm leading-none">
                {code}
              </span>
              {isCollating && (
                <span className="text-[8px] text-white/80 font-normal mt-0.5 leading-none">
                  {reportedPct}%
                </span>
              )}
              {isPending && (
                <span className="text-[8px] text-white/60 font-normal mt-0.5 leading-none">
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && tooltipState && tooltipResult && (
        <div
          className="pointer-events-none absolute z-50 bg-gray-900/95 text-white rounded-xl shadow-2xl px-3 py-2.5 text-xs min-w-[180px]"
          style={{
            left: Math.min(
              tooltip.x + CELL_WIDTH / 2,
              totalWidth - 190
            ),
            top: tooltip.y - 90,
          }}
        >
          <div className="font-bold text-sm mb-1 text-white">
            {tooltipState.name}
          </div>
          {tooltipParty && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: tooltipParty.color }}
              />
              <span className="text-white/90 font-semibold">
                {tooltipParty.code} leading
              </span>
            </div>
          )}
          {tooltipTopResult && (
            <div className="text-white/70 text-xs">
              {tooltipTopResult.votes.toLocaleString()} votes
              {" "}({tooltipTopResult.percentage?.toFixed(1)}%)
            </div>
          )}
          <div className="text-white/50 text-xs mt-1">
            {tooltipResult.reportedPUs.toLocaleString()} /{" "}
            {tooltipResult.totalPUs.toLocaleString()} PUs
            &nbsp;·&nbsp;
            {Math.round(
              (tooltipResult.reportedPUs / tooltipResult.totalPUs) * 100
            )}%
          </div>
          <div className="mt-1.5">
            {tooltipResult.status === "declared" && (
              <span className="text-green-400 font-semibold text-[10px]">
                DECLARED
              </span>
            )}
            {tooltipResult.status === "collating" && (
              <span className="text-yellow-400 font-semibold text-[10px]">
                COLLATING
              </span>
            )}
            {tooltipResult.status === "pending" && (
              <span className="text-gray-400 font-semibold text-[10px]">
                PENDING
              </span>
            )}
          </div>
        </div>
      )}

      {/* Zone labels */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center text-xs">
        {[
          { label: "NW — North West", row: 0, col: 2 },
          { label: "NE — North East", row: 0, col: 7 },
          { label: "NC — North Central", row: 2, col: 3 },
          { label: "SW — South West", row: 3, col: 1 },
          { label: "SS — South South", row: 3, col: 5 },
          { label: "SE — South East", row: 3, col: 6 },
        ].map((z) => (
          <span key={z.label} className="text-gray-500 font-medium">
            {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}
