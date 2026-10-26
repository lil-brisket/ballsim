"use client";

import { Select } from "@/components/ui/Select";
import { useId, useMemo, useState } from "react";
import { Section } from "@/components/ui/Section";
import { PlayerTrendChart } from "@/components/player-profile/PlayerTrendChart";
import { formatAttributeLabel } from "@/presentation/player-rating-categories";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

const NON_ATTRIBUTE_METRICS = new Set([
  "ppg",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "mpg",
  "fgPct",
  "threePct",
  "ftPct",
]);

const labelClass = "text-sm text-muted";

export function PlayerAttributeTrends(props: { player: PlayerProfileView }) {
  const baseId = useId();
  const [metric, setMetric] = useState("ovr");
  const [range, setRange] = useState<"career" | "recent">("career");

  const metrics = useMemo(() => {
    const keys = Object.keys(props.player.trendSeries).filter(
      (key) => key !== "ovr" && !NON_ATTRIBUTE_METRICS.has(key),
    );
    return [
      { id: "ovr", label: "Overall Rating" },
      ...keys.map((key) => ({
        id: key,
        label: `${formatAttributeLabel(key)} Attribute`,
      })),
    ];
  }, [props.player.trendSeries]);

  const metricLabel = metrics.find((m) => m.id === metric)?.label ?? metric;

  const points = useMemo(() => {
    let series = props.player.trendSeries[metric] ?? [];
    if (range === "recent" && series.length > 5) series = series.slice(-5);
    return series;
  }, [props.player.trendSeries, metric, range]);

  return (
    <Section title="Attribute trends" density="compact">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-metric`} className={labelClass}>
              Metric
            </label>
            <Select
              id={`${baseId}-metric`}
              wrapperClassName="w-56 max-w-full"
              value={metric}
              onChange={(event) => setMetric(event.target.value)}
            >
              {metrics.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-range`} className={labelClass}>
              Range
            </label>
            <Select
              id={`${baseId}-range`}
              value={range}
              onChange={(event) =>
                setRange(event.target.value as "career" | "recent")
              }
            >
              <option value="career">Career</option>
              <option value="recent">Last 5 seasons</option>
            </Select>
          </div>
        </div>
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
      </div>
    </Section>
  );
}
