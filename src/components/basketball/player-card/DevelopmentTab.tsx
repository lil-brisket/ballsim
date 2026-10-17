"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Section } from "@/components/ui/Section";
import type { PlayerDevelopmentBundle } from "@/state/player-profile-selectors";
import { StatTile } from "./StatTile";
import { EMPTY_VALUE } from "./format";
import {
  formatChange,
  ratingAxisDomain,
  ratingHistoryRows,
  type RatingHistoryRow,
} from "./development-view";

function RatingHistoryChart(props: {
  rows: RatingHistoryRow[];
  potential: number;
}) {
  const domain = ratingAxisDomain(
    props.rows.map((row) => row.overall),
    props.potential,
  );
  return (
    <div
      role="img"
      aria-label={`Overall rating by season, ${props.rows
        .map((row) => `${row.label} ${row.overall}`)
        .join(", ")}. Potential estimate ${props.potential}.`}
      className="h-56 w-full rounded-lg border border-zinc-800 bg-zinc-900/40 p-2"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={props.rows}
          margin={{ top: 16, right: 16, bottom: 16, left: 0 }}
        >
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            label={{
              value: "Season",
              position: "insideBottom",
              offset: -10,
              fill: "#a1a1aa",
              fontSize: 11,
            }}
          />
          <YAxis
            domain={domain}
            allowDecimals={false}
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            width={36}
            label={{
              value: "OVR",
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
              const row = payload?.[0]?.payload as RatingHistoryRow | undefined;
              if (!row) return "";
              const when = row.current
                ? "Current rating"
                : `End of ${row.seasonYear} season`;
              return row.age == null ? when : `${when} · age ${row.age}`;
            }}
          />
          <ReferenceLine
            y={props.potential}
            stroke="#a1a1aa"
            strokeDasharray="6 4"
            label={{
              value: `Potential ${props.potential} (estimate)`,
              position: "insideTopRight",
              fill: "#a1a1aa",
              fontSize: 11,
            }}
          />
          <Line
            type="linear"
            dataKey="overall"
            name="OVR"
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

export function DevelopmentTab(props: {
  identity: { overall: number; potential: number; age: number };
  development: PlayerDevelopmentBundle;
}) {
  const { identity, development } = props;
  const rows = ratingHistoryRows(development.ratingHistory);
  const hasHistory = rows.some((row) => !row.current);

  return (
    <>
      <Section title="Development" density="compact">
        <div className="space-y-4">
          <div
            role="group"
            aria-label="Current ratings"
            className="grid grid-cols-3 gap-2"
          >
            <StatTile label="OVR" value={identity.overall} />
            <StatTile label="POT (est.)" value={identity.potential} />
            <StatTile label="Age" value={identity.age} />
          </div>

          {hasHistory ? (
            <RatingHistoryChart rows={rows} potential={identity.potential} />
          ) : (
            <p
              role="status"
              className="rounded-lg border border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500"
            >
              Rating history begins after the first completed season.
            </p>
          )}

          <p className="text-sm text-zinc-500">
            Ratings are actual values at the end of each season, plus today’s
            rating. Potential is a scouting estimate of the player’s ceiling,
            not a projection or a guarantee.
            {development.trackingStartedSeasonYear != null
              ? ` Tracked since ${development.trackingStartedSeasonYear}.`
              : null}
          </p>
        </div>
      </Section>

      {hasHistory ? (
        <Section title="Rating history" density="compact">
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-sm text-zinc-400">
                  <th scope="col" className="px-3 py-2 font-normal">
                    Season
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-normal">
                    Age
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-normal">
                    OVR
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-normal">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-zinc-800/60 last:border-0"
                  >
                    <th
                      scope="row"
                      className="px-3 py-2 text-left font-medium text-zinc-200"
                    >
                      {row.label}
                    </th>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-100">
                      {row.age ?? EMPTY_VALUE}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-zinc-100">
                      {row.overall}
                    </td>
                    <td
                      className={
                        row.change != null && row.change > 0
                          ? "px-3 py-2 text-right font-mono tabular-nums text-emerald-400"
                          : row.change != null && row.change < 0
                            ? "px-3 py-2 text-right font-mono tabular-nums text-rose-400"
                            : "px-3 py-2 text-right font-mono tabular-nums text-zinc-400"
                      }
                    >
                      {formatChange(row.change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </>
  );
}
