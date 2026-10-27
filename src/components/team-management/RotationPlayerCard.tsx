"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { useId, useRef } from "react";
import { useDialogFocus } from "@/components/management/use-dialog-focus";
import { OvrBadge } from "@/components/ui/OvrBadge";

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
        <p className="mt-1 text-sm text-muted">
          No medical restrictions on minutes.
        </p>
      </div>
    );
  }

  if (status === "questionable") {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
        <p className="text-sm font-medium text-warning">{emoji} Questionable</p>
        <dl className="mt-2 space-y-1 text-sm text-soft">
          {player.injuryType ? (
            <div>
              <dt className="inline text-faint">Injury: </dt>
              <dd className="inline">
                {player.isLegacyUndisclosed ? "Undisclosed" : player.injuryType}
                {player.injurySeverity ? ` (${player.injurySeverity})` : ""}
              </dd>
            </div>
          ) : null}
          {gamesText ? (
            <div>
              <dt className="inline text-faint">Timeline: </dt>
              <dd className="inline">{gamesText}</dd>
            </div>
          ) : null}
          <div>
            <dt className="inline text-faint">Workload: </dt>
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
        <p className="text-sm font-medium text-orange-300">{emoji} Limited</p>
        <dl className="mt-2 space-y-1 text-sm text-soft">
          {player.injuryType ? (
            <div>
              <dt className="inline text-faint">Injury: </dt>
              <dd className="inline">
                {player.isLegacyUndisclosed ? "Undisclosed" : player.injuryType}
                {player.injurySeverity ? ` (${player.injurySeverity})` : ""}
              </dd>
            </div>
          ) : null}
          {gamesText ? (
            <div>
              <dt className="inline text-faint">Timeline: </dt>
              <dd className="inline">{gamesText}</dd>
            </div>
          ) : null}
          <div>
            <dt className="inline text-faint">Recommended: </dt>
            <dd className="inline">
              {player.recommendedWorkloadMpg != null
                ? `${player.recommendedWorkloadMpg} MPG`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="inline text-faint">Maximum: </dt>
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
      <dl className="mt-2 space-y-1 text-sm text-soft">
        {player.injuryType ? (
          <div>
            <dt className="inline text-faint">Injury: </dt>
            <dd className="inline">
              {player.isLegacyUndisclosed ? "Undisclosed" : player.injuryType}
              {player.injurySeverity ? ` (${player.injurySeverity})` : ""}
            </dd>
          </div>
        ) : null}
        {gamesText ? (
          <div>
            <dt className="inline text-faint">Timeline: </dt>
            <dd className="inline">{gamesText}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline text-faint">Workload: </dt>
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, dialogRef, onClose);

  const stats = player.seasonStats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line-strong bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <SectionHeading
              as="h3"
              size="sm"
              id={titleId}
              titleClassName="text-lg!"
              title={
                <>
                  {player.firstName} {player.lastName}
                </>
              }
            />
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <span>
                {player.position}
                {player.age != null ? ` · Age ${player.age}` : ""}
              </span>
              {player.overall != null ? (
                <OvrBadge overall={player.overall} size="sm" />
              ) : null}
            </p>
            <p className="mt-0.5 text-sm capitalize text-faint">
              {player.role.replaceAll("_", " ")}
              {player.teamName ? ` · ${player.teamName}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            aria-label="Close player card"
          >
            Close
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <section>
            <h4 className="mb-2 text-sm font-medium text-soft">Availability</h4>
            <AvailabilitySection player={player} />
          </section>

          {stats ? (
            <section>
              <h4 className="mb-2 text-sm font-medium text-soft">
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
                    [
                      "3P%",
                      stats.threePct != null ? `${stats.threePct}%` : "—",
                    ],
                    ["FT%", stats.ftPct != null ? `${stats.ftPct}%` : "—"],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded border border-line bg-surface-base/50 px-2 py-2"
                  >
                    <p className="text-sm text-muted">{label}</p>
                    <p className="text-sm tabular-nums text-ink">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h4 className="mb-2 text-sm font-medium text-soft">Rotation</h4>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border border-line px-3 py-2">
                <dt className="text-sm text-muted">Target MPG</dt>
                <dd className="tabular-nums text-team-ink">
                  {player.targetMinutes}
                </dd>
              </div>
              <div className="rounded border border-line px-3 py-2">
                <dt className="text-sm text-muted">Projected</dt>
                <dd className="tabular-nums text-ink">
                  {player.projectedMinutes ?? player.targetMinutes}
                </dd>
              </div>
              <div className="rounded border border-line px-3 py-2">
                <dt className="text-sm text-muted">Season MIN</dt>
                <dd className="tabular-nums text-ink">
                  {player.actualMinutes}
                </dd>
              </div>
              <div className="rounded border border-line px-3 py-2">
                <dt className="text-sm text-muted">Role</dt>
                <dd className="capitalize text-ink">
                  {player.role.replaceAll("_", " ")}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
