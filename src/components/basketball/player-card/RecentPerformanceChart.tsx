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
import type { PlayerGameSeriesPoint } from "@/state/player-profile-selectors";

const RECENT_GAMES = 10;

export function RecentPerformanceChart(props: {
  games: PlayerGameSeriesPoint[];
}) {
  const recent = props.games.slice(-RECENT_GAMES);
  if (recent.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
        No games played this season.
      </p>
    );
  }
  const data = recent.map((game, index) => ({
    label: `${index + 1}`,
    opponent: game.opponentAbbreviation,
    points: game.points,
  }));

  return (
    <div className="h-48 w-full rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 16, left: 0 }}
        >
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis
            dataKey="opponent"
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            label={{
              value: "Opponent",
              position: "insideBottom",
              offset: -10,
              fill: "#a1a1aa",
              fontSize: 11,
            }}
          />
          <YAxis
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            allowDecimals={false}
            width={36}
            label={{
              value: "PTS",
              angle: -90,
              position: "insideLeft",
              fill: "#a1a1aa",
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
            }}
            labelStyle={{ color: "#a1a1aa" }}
            itemStyle={{ color: "#fbbf24" }}
            labelFormatter={(_, payload) => {
              const item = payload?.[0]?.payload as
                { label: string; opponent: string } | undefined;
              return item ? `Game ${item.label} vs ${item.opponent}` : "";
            }}
          />
          <Line
            type="monotone"
            dataKey="points"
            name="Points"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: "#f59e0b", r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
