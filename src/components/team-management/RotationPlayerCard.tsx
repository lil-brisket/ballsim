"use client";

import { useEffect, useId, useRef } from "react";

export type RotationPlayerCardData = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age?: number;
  overall?: number;
  teamName?: string;
  role: string;
  availabilityStatus: string;
  injuryType?: string | null;
  injurySeverity?: string | null;
  recommendedWorkloadMpg?: number | null;
  maximumWorkloadMpg?: number | null;
  gamesRemaining?: { min: number; max: number } | null;
  isLegacyUndisclosed?: boolean;
  targetMinutes: number;
  projectedMinutes?: number;
  actualMinutes: number;
  priority: number;
  minutePriorityBias: number;
  seasonStats?: {
    mpg: number;
    ppg: number;
    rpg: number;
    apg: number;
    spg: number;
    bpg: number;
    fgPct: number | null;
    threePct: number | null;
    ftPct: number | null;
  } | null;
};

function statusEmoji(status: string): string {
  switch (status) {
    case "available":
      return "🟢";
    case "minor":
      return "🟡";
    case "questionable":
      return "🟡";
    case "limited":
      return "🟠";
    case "recovery":
      return "🔵";
    case "out":
    case "suspended":
      return "🔴";
    default:
      return "⚪";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "available":
      return "Available";
    case "minor":
      return "Minor";
    case "questionable":
      return "Questionable";
    case "limited":
      return "Limited";
    case "recovery":
      return "Recovery";
    case "out":
      return "Out";
    case "suspended":
      return "Suspended";
    default:
      return status;
  }
}

function playBiasLabel(bias: number): string {
  if (bias < 0) return "Play Less";
  if (bias > 0) return "Play More";
  return "Normal";
}

function formatGamesRemaining(
  games: { min: number; max: number } | null | undefined,
): string | null {
  if (games == null) return null;
  if (games.min === games.max) {
    return `${games.min} game${games.min === 1 ? "" : "s"} remaining`;
  }
  return `${games.min}–${games.max} games remaining`;
}

function AvailabilitySection(props: { player: RotationPlayerCardData }) {
  const { player } = props;
  const status = player.availabilityStatus;
  const emoji = statusEmoji(status);
  const label = statusLabel(status);
  const gamesText = formatGamesRemaining(player.gamesRemaining);

  if (status === "available") {
    return (
      <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-3">
        <p className="text-sm font-medium text-emerald-300">
          {emoji} Available
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          No medical restrictions on minutes.
        </p>
      </div>
    );
  }

  if (status === "questionable") {
    return (
      <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3">
        <p className="text-sm font-medium text-amber-300">
          {emoji} Questionable
        </p>
        <dl className="mt-2 space-y-1 text-xs text-zinc-300">
          {player.injuryType ? (
            <div>
              <dt className="inline text-zinc-500">Injury: </dt>
              <dd className="inline">
                {player.isLegacyUndisclosed
                  ? "Undisclosed"
                  : player.injuryType}
                {player.injurySeverity
                  ? ` (${player.injurySeverity})`
                  : ""}
              </dd>
            </div>
          ) : null}
          {gamesText ? (
            <div>
              <dt className="inline text-zinc-500">Timeline: </dt>
              <dd className="inline">{gamesText}</dd>
            </div>
          ) : null}
          <div>
            <dt className="inline text-zinc-500">Workload: </dt>
            <dd className="inline">
              Monitor — may play limited minutes game-to-game.
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  if (status === "limited") {
    return (
      <div className="rounded-lg border border-orange-800/60 bg-orange-950/30 px-4 py-3">
        <p className="text-sm font-medium text-orange-300">
          {emoji} Limited
        </p>
        <dl className="mt-2 space-y-1 text-xs text-zinc-300">
          {player.injuryType ? (
            <div>
              <dt className="inline text-zinc-500">Injury: </dt>
              <dd className="inline">
                {player.isLegacyUndisclosed
                  ? "Undisclosed"
                  : player.injuryType}
                {player.injurySeverity
                  ? ` (${player.injurySeverity})`
                  : ""}
              </dd>
            </div>
          ) : null}
          {gamesText ? (
            <div>
              <dt className="inline text-zinc-500">Timeline: </dt>
              <dd className="inline">{gamesText}</dd>
            </div>
          ) : null}
          <div>
            <dt className="inline text-zinc-500">Recommended: </dt>
            <dd className="inline">
              {player.recommendedWorkloadMpg != null
                ? `${player.recommendedWorkloadMpg} MPG`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="inline text-zinc-500">Maximum: </dt>
            <dd className="inline">
              {player.maximumWorkloadMpg != null
                ? `${player.maximumWorkloadMpg} MPG`
                : "—"}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rose-800/60 bg-rose-950/30 px-4 py-3">
      <p className="text-sm font-medium text-rose-300">
        {emoji} {label}
      </p>
      <dl className="mt-2 space-y-1 text-xs text-zinc-300">
        {player.injuryType ? (
          <div>
            <dt className="inline text-zinc-500">Injury: </dt>
            <dd className="inline">
              {player.isLegacyUndisclosed ? "Undisclosed" : player.injuryType}
              {player.injurySeverity ? ` (${player.injurySeverity})` : ""}
            </dd>
          </div>
        ) : null}
        {gamesText ? (
          <div>
            <dt className="inline text-zinc-500">Timeline: </dt>
            <dd className="inline">{gamesText}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline text-zinc-500">Workload: </dt>
          <dd className="inline">0 MPG — unavailable</dd>
        </div>
      </dl>
    </div>
  );
}

export function RotationPlayerCard(props: {
  player: RotationPlayerCardData;
  onClose: () => void;
}) {
  const { player, onClose } = props;
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats = player.seasonStats;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-zinc-700 bg-zinc-900 shadow-xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div>
            <h3 id={titleId} className="text-lg font-semibold text-zinc-50">
              {player.firstName} {player.lastName}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {player.position}
              {player.age != null ? ` · Age ${player.age}` : ""}
              {player.overall != null ? ` · OVR ${player.overall}` : ""}
            </p>
            <p className="mt-0.5 text-xs capitalize text-zinc-500">
              {player.role.replaceAll("_", " ")}
              {player.teamName ? ` · ${player.teamName}` : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
            aria-label="Close player card"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Availability
            </h4>
            <AvailabilitySection player={player} />
          </section>

          {stats ? (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Performance
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-4">
                {(
                  [
                    ["MPG", stats.mpg.toFixed(1)],
                    ["PPG", stats.ppg.toFixed(1)],
                    ["RPG", stats.rpg.toFixed(1)],
                    ["APG", stats.apg.toFixed(1)],
                    ["SPG", stats.spg.toFixed(1)],
                    ["BPG", stats.bpg.toFixed(1)],
                    ["FG%", stats.fgPct != null ? `${stats.fgPct}%` : "—"],
                    ["3P%", stats.threePct != null ? `${stats.threePct}%` : "—"],
                    ["FT%", stats.ftPct != null ? `${stats.ftPct}%` : "—"],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded border border-zinc-800 bg-zinc-950/50 px-2 py-2"
                  >
                    <p className="text-[10px] uppercase text-zinc-500">
                      {label}
                    </p>
                    <p className="font-mono text-sm text-zinc-100">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Rotation
            </h4>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border border-zinc-800 px-3 py-2">
                <dt className="text-[10px] uppercase text-zinc-500">
                  Target MPG
                </dt>
                <dd className="font-mono text-amber-400">
                  {player.targetMinutes}
                </dd>
              </div>
              <div className="rounded border border-zinc-800 px-3 py-2">
                <dt className="text-[10px] uppercase text-zinc-500">
                  Projected
                </dt>
                <dd className="font-mono text-zinc-100">
                  {player.projectedMinutes ?? player.targetMinutes}
                </dd>
              </div>
              <div className="rounded border border-zinc-800 px-3 py-2">
                <dt className="text-[10px] uppercase text-zinc-500">
                  Season MIN
                </dt>
                <dd className="font-mono text-zinc-100">
                  {player.actualMinutes}
                </dd>
              </div>
              <div className="rounded border border-zinc-800 px-3 py-2">
                <dt className="text-[10px] uppercase text-zinc-500">
                  Priority
                </dt>
                <dd className="font-mono text-zinc-100">{player.priority}</dd>
              </div>
              <div className="rounded border border-zinc-800 px-3 py-2">
                <dt className="text-[10px] uppercase text-zinc-500">Role</dt>
                <dd className="capitalize text-zinc-100">
                  {player.role.replaceAll("_", " ")}
                </dd>
              </div>
              <div className="rounded border border-zinc-800 px-3 py-2">
                <dt className="text-[10px] uppercase text-zinc-500">
                  Play / Usage
                </dt>
                <dd className="text-zinc-100">
                  {playBiasLabel(player.minutePriorityBias)}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
