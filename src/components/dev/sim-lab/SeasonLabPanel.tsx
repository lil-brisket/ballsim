"use client";

import { useState, useTransition } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { runSeasonLabAction } from "@/app/dev/sim-lab/actions";
import { LabBusyBanner, useLabRunElapsed } from "@/components/dev/sim-lab/LabBusyBanner";
import {
  formatDurationMs,
  formatFixed,
  formatPct,
  labFieldClass,
  labPrimaryButtonClass,
} from "@/components/dev/sim-lab/format";
import { ErrorState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { panelClass } from "@/components/ui/styles";
import type { SeasonLabSuccess } from "@/application/sim-lab";
import type { SimLabPresetOption } from "@/components/dev/sim-lab/config";
import type { LabLeaguePreset } from "@/simulation/lab/lab-league-preset";

function SeasonChart(props: {
  label: string;
  dataKey: "meanWinPct" | "meanRosterAge" | "meanPayroll" | "meanRosterStrength";
  points: SeasonLabSuccess["series"];
}) {
  if (props.points.length === 0) {
    return null;
  }
  return (
    <div className={`${panelClass} p-4`}>
      <p className="text-sm text-zinc-400">{props.label}</p>
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={props.points}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis
              dataKey="seasonIndex"
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
              dataKey={props.dataKey}
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

export function SeasonLabPanel(props: {
  presets: readonly SimLabPresetOption[];
  maxSeasonsCbl: number;
  maxSeasonsStandard: number;
}) {
  const [seed, setSeed] = useState(42);
  const [seasons, setSeasons] = useState(3);
  const [preset, setPreset] = useState<LabLeaguePreset>("cbl");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeasonLabSuccess | null>(null);
  const [pending, startTransition] = useTransition();
  const elapsedMs = useLabRunElapsed(pending);
  const cap =
    preset === "standard" ? props.maxSeasonsStandard : props.maxSeasonsCbl;

  function onRun() {
    setError(null);
    startTransition(async () => {
      const next = await runSeasonLabAction({ seed, seasons, preset });
      if (!next.ok) {
        setResult(null);
        setError(next.error);
        return;
      }
      setResult(next);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Runs a full owner-career through production{" "}
        <code>advanceSimulation</code>. CBL is the practical default. Standard
        82-game seasons are much slower — capped at {props.maxSeasonsStandard}{" "}
        seasons here.
      </p>
      <div className={`${panelClass} grid gap-3 p-4 sm:grid-cols-3`}>
        <label className="text-sm text-zinc-400">
          Seed
          <input
            className={`${labFieldClass} mt-1`}
            type="number"
            value={seed}
            disabled={pending}
            onChange={(event) => setSeed(Number(event.target.value))}
          />
        </label>
        <label className="text-sm text-zinc-400">
          Seasons (max {cap})
          <input
            className={`${labFieldClass} mt-1`}
            type="number"
            min={1}
            max={cap}
            value={seasons}
            disabled={pending}
            onChange={(event) => setSeasons(Number(event.target.value))}
          />
        </label>
        <label className="text-sm text-zinc-400">
          League
          <select
            className={`${labFieldClass} mt-1`}
            value={preset}
            disabled={pending}
            onChange={(event) =>
              setPreset(event.target.value as LabLeaguePreset)
            }
          >
            {props.presets.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        className={labPrimaryButtonClass}
        disabled={pending}
        onClick={onRun}
      >
        {pending ? "Simulating seasons…" : "Run multi-season career"}
      </button>
      <LabBusyBanner pending={pending} elapsedMs={elapsedMs} />

      {error ? <ErrorState message={error} /> : null}
      {result ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Seasons"
              value={result.report.seasonsSimulated ?? result.series.length}
              mono
            />
            <StatCard label="Wall time" value={formatDurationMs(result.wallMs)} mono />
            <StatCard label="Teams / season" value={result.series[0]?.teamCount ?? "—"} mono />
            <StatCard
              label="Last mean win%"
              value={
                result.series.length === 0
                  ? "—"
                  : formatPct(result.series[result.series.length - 1]!.meanWinPct)
              }
              mono
            />
          </div>
          <p className="font-mono text-xs text-zinc-500">
            checksum={result.report.checksum} · {result.report.reproCommand}
          </p>
          <SeasonChart
            label="Mean win percentage"
            dataKey="meanWinPct"
            points={result.series}
          />
          <SeasonChart
            label="Mean roster strength"
            dataKey="meanRosterStrength"
            points={result.series}
          />
          <SeasonChart
            label="Mean payroll"
            dataKey="meanPayroll"
            points={result.series}
          />
          <SeasonChart
            label="Mean roster age"
            dataKey="meanRosterAge"
            points={result.series}
          />
          {result.series.length > 0 ? (
            <div className={`${panelClass} overflow-x-auto p-4`}>
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="pb-2">Season</th>
                    <th className="pb-2">Win%</th>
                    <th className="pb-2">Age</th>
                    <th className="pb-2">Payroll</th>
                    <th className="pb-2">Strength</th>
                  </tr>
                </thead>
                <tbody>
                  {result.series.map((row) => (
                    <tr key={row.seasonIndex} className="border-t border-zinc-800">
                      <td className="py-2 font-mono">{row.seasonIndex}</td>
                      <td className="py-2 font-mono">{formatPct(row.meanWinPct)}</td>
                      <td className="py-2 font-mono">{formatFixed(row.meanRosterAge)}</td>
                      <td className="py-2 font-mono">{formatFixed(row.meanPayroll, 0)}</td>
                      <td className="py-2 font-mono">{formatFixed(row.meanRosterStrength)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
