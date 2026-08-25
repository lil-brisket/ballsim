"use client";

import { useMemo, useState } from "react";
import { Section } from "@/components/owner/Section";
import { PlayerTrendChart } from "@/components/player-profile/PlayerTrendChart";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

const METRICS: Array<{ id: string; label: string }> = [
  { id: "ppg", label: "Points per Game" },
  { id: "rpg", label: "Rebounds per Game" },
  { id: "apg", label: "Assists per Game" },
  { id: "mpg", label: "Minutes per Game" },
  { id: "fgPct", label: "Field Goal %" },
  { id: "threePct", label: "Three Point %" },
  { id: "ftPct", label: "Free Throw %" },
  { id: "ovr", label: "Overall Rating" },
  { id: "threePoint", label: "Three Point Attribute" },
  { id: "finishing", label: "Finishing Attribute" },
  { id: "passing", label: "Passing Attribute" },
  { id: "rebounding", label: "Rebounding Attribute" },
  { id: "speed", label: "Speed Attribute" },
  { id: "strength", label: "Strength Attribute" },
];

export function PlayerTrends(props: { player: PlayerProfileView }) {
  const [metric, setMetric] = useState("ppg");
  const [range, setRange] = useState<"career" | "recent">("career");

  const metricLabel =
    METRICS.find((entry) => entry.id === metric)?.label ?? metric;

  const points = useMemo(() => {
    let series = props.player.trendSeries[metric] ?? [];
    if (range === "recent" && series.length > 5) {
      series = series.slice(-5);
    }
    return series;
  }, [props.player.trendSeries, metric, range]);

  return (
    <Section
      title="Trends"
      action={
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
          >
            {METRICS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
            value={range}
            onChange={(event) =>
              setRange(event.target.value as "career" | "recent")
            }
          >
            <option value="career">Career</option>
            <option value="recent">Last 5 seasons</option>
          </select>
        </div>
      }
    >
      <PlayerTrendChart
        metric={metric}
        metricLabel={metricLabel}
        points={points}
        emptyMessage={
          props.player.trackingStartedSeasonYear
            ? `Historical tracking began in ${props.player.trackingStartedSeasonYear}. Trend data will accumulate as future seasons are completed.`
            : "Historical trend data will become available after the player's first completed season."
        }
      />
    </Section>
  );
}
