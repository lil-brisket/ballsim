"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/styles";
import type { WatchTeam } from "@/state/watch-game-view";

export type CourtStatus = "playing" | "paused" | "complete";

// "Replay complete", not "Final": the scoreboard already says Final.
const STATUS_LABEL: Record<CourtStatus, string> = {
  playing: "Live",
  paused: "Paused",
  complete: "Replay complete",
};

/** Status pill, possession line and shot chart toggle above the court. */
export function CourtHeader(props: {
  status?: CourtStatus;
  ballTeam: WatchTeam | null;
  showShotChart: boolean;
  onToggleShotChart: () => void;
}) {
  const { ballTeam } = props;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        {props.status ? (
          <p
            className="inline-flex items-center gap-2 text-sm text-zinc-300"
            data-testid="court-status"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-2 w-2 rounded-full",
                props.status === "playing"
                  ? "team-pulse bg-team-ink"
                  : props.status === "paused"
                    ? "bg-zinc-500"
                    : "bg-zinc-300",
              )}
            />
            {STATUS_LABEL[props.status]}
          </p>
        ) : null}
        {ballTeam ? (
          <p
            className="inline-flex items-center gap-1.5 text-sm text-zinc-300"
            data-testid="court-possession"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 8 10"
              className="h-2.5 w-2 fill-current"
            >
              <path d="M0 0 L8 5 L0 10 Z" />
            </svg>
            <span aria-hidden="true">{ballTeam.abbreviation} ball</span>
            <span className="sr-only">
              Possession: {ballTeam.city} {ballTeam.name}
            </span>
          </p>
        ) : null}
      </div>
      <Button
        variant="secondary"
        aria-pressed={props.showShotChart}
        onClick={props.onToggleShotChart}
      >
        Shot chart
      </Button>
    </div>
  );
}
