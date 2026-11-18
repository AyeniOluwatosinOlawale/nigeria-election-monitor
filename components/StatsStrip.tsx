interface StatsStripProps {
  totalPUs: number;
  reportedPUs: number;
  registeredVoters: number;
  accreditedVoters: number;
}

function formatLarge(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function StatsStrip({
  totalPUs,
  reportedPUs,
  registeredVoters,
  accreditedVoters,
}: StatsStripProps) {
  const pctReported = totalPUs > 0 ? Math.round((reportedPUs / totalPUs) * 100) : 0;
  const turnoutPct = registeredVoters > 0
    ? ((accreditedVoters / registeredVoters) * 100).toFixed(1)
    : "—";

  const stats = [
    {
      label: "Total Polling Units",
      value: formatLarge(totalPUs),
      sub: "nationwide",
      accent: "#008751",
    },
    {
      label: "Units Reporting",
      value: formatLarge(reportedPUs),
      sub: `${pctReported}% of total`,
      accent: "#1E40AF",
    },
    {
      label: "Accredited Voters",
      value: formatLarge(accreditedVoters),
      sub: `${turnoutPct}% turnout`,
      accent: "#D97706",
    },
    {
      label: "Registered Voters",
      value: formatLarge(registeredVoters),
      sub: "total electorate",
      accent: "#006B3C",
    },
  ];

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
          {stats.map((stat, i) => (
            <div key={i} className="px-5 py-4">
              <div
                className="text-2xl font-black tabular-nums"
                style={{ color: stat.accent }}
              >
                {stat.value}
              </div>
              <div className="text-xs font-semibold text-gray-700 mt-0.5">
                {stat.label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
