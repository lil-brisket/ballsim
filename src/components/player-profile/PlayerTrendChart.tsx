"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTheme } from "@/components/ui/chart-theme";

export type TrendChartProps = {
  metric: string;
  metricLabel: string;
  points: { season: number; value: number | null }[];
  emptyMessage?: string;
};

/**
 * Dumb chart — receives pre-shaped series only. No simulation knowledge.
 */
export function PlayerTrendChart(props: TrendChartProps) {
  const data = props.points
    .filter((point) => point.value !== null)
    .map((point) => ({
      season: point.season,
      value: point.value as number,
    }));

  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-line px-4 py-8 text-center text-sm text-faint">
        {props.emptyMessage ??
          "Historical trend data will become available after the player's first completed season."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{props.metricLabel}</p>
      <div className="h-64 w-full rounded-xl border border-line bg-surface-raised/40 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis
              dataKey="season"
              stroke="#71717a"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
            />
            <YAxis
              stroke="#71717a"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: chartTheme.ink }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={props.metricLabel}
              stroke={chartTheme.ink}
              strokeWidth={2}
              dot={{ fill: chartTheme.ink, r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
