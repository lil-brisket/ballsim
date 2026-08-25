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
      <p className="rounded-xl border border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
        {props.emptyMessage ??
          "Historical trend data will become available after the player's first completed season."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-400">{props.metricLabel}</p>
      <div className="h-64 w-full rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
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
              itemStyle={{ color: "#fbbf24" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={props.metricLabel}
              stroke="#d97706"
              strokeWidth={2}
              dot={{ fill: "#d97706", r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
