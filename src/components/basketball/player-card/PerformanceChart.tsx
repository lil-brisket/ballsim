"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatGameDate } from "@/presentation/game-date";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchPlayerGameSeriesAction } from "@/application/actions/custom-content-drawers";
import type {
  PlayerGameSeriesPoint,
  PlayerStatsBundle,
} from "@/state/player-profile-selectors";
import {
  METRICS,
  gameSeriesPoints,
  lineMetricValue,
  metricDef,
  seasonSeriesPoints,
  SPLIT_LABELS,
  type MetricKey,
  type StatScope,
  type StatSplit,
} from "./stat-view";
import { chartTheme } from "@/components/ui/chart-theme";

type Row = {
  x: number;
  date?: string;
  opponent?: string;
  value: number | null;
  toDate?: number | null;
};

export function PerformanceChart(props: {
  baseId: string;
  saveId: string;
  playerId: string;
  stats: PlayerStatsBundle;
  scope: StatScope;
  seasonId: string | null;
  split: StatSplit;
}) {
  const { stats, scope, seasonId, split } = props;
  const [metric, setMetric] = useState<MetricKey>("ppg");
  const [cache, setCache] = useState<Record<string, PlayerGameSeriesPoint[]>>(
    {},
  );
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const def = metricDef(metric);
  const isCurrent = seasonId === stats.currentSeasonId;
  const needsFetch =
    scope === "season" &&
    split !== "development" &&
    seasonId != null &&
    !isCurrent &&
    cache[seasonId] === undefined;

  useEffect(() => {
    if (!needsFetch || seasonId == null || failed[seasonId]) return;
    let cancelled = false;
    fetchPlayerGameSeriesAction(props.saveId, props.playerId, seasonId)
      .then((points) => {
        if (cancelled) return;
        if (points) setCache((prev) => ({ ...prev, [seasonId]: points }));
        else setFailed((prev) => ({ ...prev, [seasonId]: true }));
      })
      .catch(() => {
        if (!cancelled) setFailed((prev) => ({ ...prev, [seasonId]: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [needsFetch, seasonId, failed, props.saveId, props.playerId]);

  const hasFailed = needsFetch && seasonId != null && failed[seasonId];
  const loading = needsFetch && !hasFailed;

  const careerLine = stats.career[split];
  const careerAvg = lineMetricValue(careerLine, metric);

  let rows: Row[] = [];
  let xLabel = "Game";
  if (scope === "season") {
    const games = isCurrent
      ? stats.currentSeasonGames
      : seasonId
        ? (cache[seasonId] ?? [])
        : [];
    rows = gameSeriesPoints(games, split, metric).map((p) => ({
      x: p.game,
      date: p.date,
      opponent: p.opponent,
      value: p.value,
      toDate: p.toDate,
    }));
  } else {
    xLabel = "Season";
    rows = seasonSeriesPoints(stats.seasons, split, metric).map((p) => ({
      x: p.seasonYear,
      value: p.value,
    }));
  }

  const scopeLabel =
    scope === "season"
      ? `season ${stats.seasons.find((s) => s.seasonId === seasonId)?.seasonYear ?? ""}`
      : "career by season";
  const chartLabel = `${def.label} chart, ${scopeLabel}, ${SPLIT_LABELS[split]}`;
  const selectId = `${props.baseId}-metric`;
  const isPct = def.kind === "pct";
  const seasonScope = scope === "season";

  let body: React.ReactNode;
  if (scope === "season" && split === "development") {
    body = (
      <EmptyNote text="Game-by-game data is not available for the Development League." />
    );
  } else if (loading) {
    body = <EmptyNote text="Loading games…" />;
  } else if (hasFailed && seasonId) {
    body = (
      <div role="alert" className="space-y-2 py-6 text-center">
        <p className="text-sm text-rose-200">Unable to load games.</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setFailed((prev) => {
              const next = { ...prev };
              delete next[seasonId];
              return next;
            })
          }
        >
          Retry
        </Button>
      </div>
    );
  } else if (rows.length === 0) {
    body = <EmptyNote text="No games to chart yet." />;
  } else {
    const yLabel = def.label;
    body = (
      <>
        <div
          role="img"
          aria-label={chartLabel}
          className="h-56 w-full rounded-lg border border-zinc-800 bg-zinc-900/40 p-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              margin={{ top: 8, right: 12, bottom: 16, left: 0 }}
            >
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                stroke="#71717a"
                tick={{ fill: "#a1a1aa", fontSize: 12 }}
                allowDecimals={false}
                label={{
                  value: xLabel,
                  position: "insideBottom",
                  offset: -10,
                  fill: "#a1a1aa",
                  fontSize: 12,
                }}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: "#a1a1aa", fontSize: 12 }}
                width={40}
                domain={isPct ? [0, 100] : [0, "auto"]}
                label={{
                  value: yLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#a1a1aa",
                  fontSize: 12,
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#a1a1aa" }}
                itemStyle={{ color: chartTheme.ink }}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload as Row | undefined;
                  if (!item) return "";
                  return seasonScope
                    ? `Game ${item.x}: ${item.date ? formatGameDate(item.date) : ""} vs ${item.opponent ?? ""}`
                    : `Season ${item.x}`;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" />
              {careerAvg != null ? (
                <ReferenceLine
                  y={careerAvg}
                  stroke="#a1a1aa"
                  strokeDasharray="6 4"
                  label={{
                    value: "Career avg",
                    fill: "#a1a1aa",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
              ) : null}
              {seasonScope && !isPct ? (
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Game"
                  stroke={chartTheme.ink}
                  strokeWidth={0}
                  dot={{ fill: chartTheme.ink, r: 3 }}
                  isAnimationActive={false}
                />
              ) : null}
              {seasonScope ? (
                <Line
                  type="monotone"
                  dataKey="toDate"
                  name={isPct ? "Season-to-date %" : "Season avg to date"}
                  stroke={isPct ? chartTheme.ink : chartTheme.neutral}
                  strokeWidth={2}
                  strokeDasharray={isPct ? undefined : "5 3"}
                  dot={isPct ? { fill: chartTheme.ink, r: 3 } : false}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  type="monotone"
                  dataKey="value"
                  name={def.label}
                  stroke={chartTheme.ink}
                  strokeWidth={2}
                  dot={{ fill: chartTheme.ink, r: 3 }}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>{chartLabel}</caption>
          <thead>
            <tr>
              <th scope="col">{xLabel}</th>
              {seasonScope ? (
                <>
                  <th scope="col">Opponent</th>
                  {!isPct ? <th scope="col">Game</th> : null}
                  <th scope="col">
                    {isPct ? "Season-to-date %" : "Season avg to date"}
                  </th>
                </>
              ) : (
                <th scope="col">{def.label}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.x}>
                <th scope="row">{row.x}</th>
                {seasonScope ? (
                  <>
                    <td>{row.opponent}</td>
                    {!isPct ? <td>{row.value}</td> : null}
                    <td>{row.toDate}</td>
                  </>
                ) : (
                  <td>{row.value}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="text-sm text-zinc-400">
          Chart metric
        </label>
        <Select
          id={selectId}
          value={metric}
          onChange={(event) => setMetric(event.target.value as MetricKey)}
          wrapperClassName="w-40"
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>
      {body}
    </div>
  );
}

function EmptyNote(props: { text: string }) {
  return (
    <p
      role="status"
      className="rounded-lg border border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500"
    >
      {props.text}
    </p>
  );
}
