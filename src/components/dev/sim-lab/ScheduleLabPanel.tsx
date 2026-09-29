"use client";

import { useState, useTransition } from "react";
import { runScheduleLabAction } from "@/app/dev/sim-lab/actions";
import {
  LabBusyBanner,
  useLabRunElapsed,
} from "@/components/dev/sim-lab/LabBusyBanner";
import {
  formatDurationMs,
  formatFixed,
  formatPct,
  labFieldClass,
  labPrimaryButtonClass,
} from "@/components/dev/sim-lab/format";
import { ErrorState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { panelClass } from "@/components/ui/styles";
import type { ScheduleLabSuccess } from "@/application/sim-lab";
import type { SimLabPresetOption } from "@/components/dev/sim-lab/config";
import type { LabLeaguePreset } from "@/simulation/lab/lab-league-preset";

type ScheduleUntil = "regular" | "playoffs";
type CostKey =
  | "gameSimMs"
  | "standingsMs"
  | "ownerGameplayMs"
  | "ticketsMs"
  | "mediaMs"
  | "narrativeMs"
  | "weeklyMs"
  | "monthlyMs"
  | "lifecycleMs"
  | "otherDayMs";

const COST_ROWS: Array<{ key: CostKey; label: string }> = [
  { key: "gameSimMs", label: "Game simulation" },
  { key: "standingsMs", label: "Standings" },
  { key: "ownerGameplayMs", label: "Owner gameplay" },
  { key: "ticketsMs", label: "Tickets" },
  { key: "mediaMs", label: "Media" },
  { key: "narrativeMs", label: "Narrative" },
  { key: "weeklyMs", label: "Weekly pipeline" },
  { key: "monthlyMs", label: "Monthly pipeline" },
  { key: "lifecycleMs", label: "Lifecycle" },
  { key: "otherDayMs", label: "Other day work" },
];

export function ScheduleLabPanel(props: {
  presets: readonly SimLabPresetOption[];
}) {
  const [seed, setSeed] = useState(42);
  const [preset, setPreset] = useState<LabLeaguePreset>("cbl");
  const [until, setUntil] = useState<ScheduleUntil>("regular");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScheduleLabSuccess | null>(null);
  const [pending, startTransition] = useTransition();
  const elapsedMs = useLabRunElapsed(pending);

  function onRun() {
    setError(null);
    startTransition(async () => {
      const next = await runScheduleLabAction({ seed, preset, until });
      if (!next.ok) {
        setResult(null);
        setError(next.error);
        return;
      }
      setResult(next);
    });
  }

  const schedule = result?.result;
  const totalCost = schedule?.seasonCost.totalMs ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Plays the generated league schedule day-by-day. CBL (22 games) is the
        faster path. Standard (82 games) is the long schedule — expect several
        minutes. Use Regular season only unless you also want playoffs.
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
          League / schedule length
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
        <label className="text-sm text-zinc-400">
          Stop at
          <select
            className={`${labFieldClass} mt-1`}
            value={until}
            disabled={pending}
            onChange={(event) =>
              setUntil(
                event.target.value === "playoffs" ? "playoffs" : "regular",
              )
            }
          >
            <option value="regular">Regular season complete</option>
            <option value="playoffs">Regular + playoffs</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        className={labPrimaryButtonClass}
        disabled={pending}
        onClick={onRun}
      >
        {pending ? "Simulating schedule…" : "Run full schedule"}
      </button>
      <LabBusyBanner pending={pending} elapsedMs={elapsedMs} />

      {error ? <ErrorState message={error} /> : null}
      {schedule ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={
                schedule.status === "completed" ? "completed" : "hit max days"
              }
              tone={schedule.status === "completed" ? "success" : "warning"}
            />
            <StatusBadge
              label={
                schedule.regularSeasonComplete
                  ? "regular complete"
                  : "regular incomplete"
              }
              tone={schedule.regularSeasonComplete ? "success" : "warning"}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Wall time"
              value={formatDurationMs(schedule.wallMs)}
              mono
            />
            <StatCard
              label="Days advanced"
              value={schedule.daysAdvanced}
              mono
            />
            <StatCard
              label="Games simulated"
              value={schedule.gamesSimulated}
              mono
            />
            <StatCard
              label="Regular final"
              value={`${schedule.gameCounts.regularFinal} / ${schedule.gameCounts.regularScheduled}`}
              mono
            />
            <StatCard
              label="Playoff final"
              value={`${schedule.gameCounts.playoffFinal} / ${schedule.gameCounts.playoffScheduled}`}
              mono
            />
            <StatCard
              label="Mean win%"
              value={formatPct(schedule.standings.meanWinPct)}
              mono
            />
            <StatCard
              label="Win range"
              value={`${formatFixed(schedule.standings.minWins, 0)}–${formatFixed(schedule.standings.maxWins, 0)}`}
              mono
            />
            <StatCard
              label="Avg game"
              value={
                schedule.averageGameCost
                  ? `${formatFixed(schedule.averageGameCost.totalMs, 1)}ms`
                  : "—"
              }
              mono
            />
          </div>
          <p className="text-sm text-zinc-400">
            {schedule.startPhase} {schedule.startDate} → {schedule.endPhase}{" "}
            {schedule.endDate}
            {schedule.decisionsDeclined > 0
              ? ` · auto-declined ${schedule.decisionsDeclined} owner decisions`
              : null}
          </p>
          <p className="font-mono text-xs text-zinc-500">
            checksum={schedule.checksum} · {schedule.reproCommand}
          </p>
          {schedule.averageGameCost ? (
            <div className={`${panelClass} p-4`}>
              <h3 className="text-sm font-medium text-zinc-200">
                Average game cost
              </h3>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-400">Possessions</dt>
                  <dd className="font-mono">
                    {schedule.averageGameCost.possessions}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-400">Events</dt>
                  <dd className="font-mono">
                    {schedule.averageGameCost.events}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-400">ms / possession</dt>
                  <dd className="font-mono">
                    {formatFixed(schedule.averageGameCost.msPerPossession, 3)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-400">ms / event</dt>
                  <dd className="font-mono">
                    {formatFixed(schedule.averageGameCost.msPerEvent, 3)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
          <div className={`${panelClass} p-4`}>
            <h3 className="text-sm font-medium text-zinc-200">
              Season cost model
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {COST_ROWS.map((row) => {
                const ms = schedule.seasonCost[row.key];
                const pct = totalCost > 0 ? (ms / totalCost) * 100 : 0;
                return (
                  <li key={row.key}>
                    <div className="flex justify-between gap-3 text-zinc-300">
                      <span>{row.label}</span>
                      <span className="font-mono text-zinc-400">
                        {formatDurationMs(ms)} ({formatFixed(pct, 1)}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
