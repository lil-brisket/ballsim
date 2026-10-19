"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/styles";

export type CourtStatus = "playing" | "paused" | "complete";

// "Replay complete", not "Final": the scoreboard already says Final.
const STATUS_LABEL: Record<CourtStatus, string> = {
  playing: "Live",
  paused: "Paused",
  complete: "Replay complete",
};

/** Status pill and shot chart toggle above the court. */
export function CourtHeader(props: {
  status?: CourtStatus;
  showShotChart: boolean;
  onToggleShotChart: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
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
