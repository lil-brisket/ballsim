"use client";

import { formatGameDate } from "@/presentation/game-date";
import { buttonClass } from "@/components/ui/Button";
import type { PlaybackFrame } from "@/components/calendar/use-calendar-playback";

/** Playback status bar with the stop control, plus watch and error notices. */
export function CalendarPlaybackStatus(props: {
  playback: PlaybackFrame | null;
  simulationPending: boolean;
  announcementText?: string;
  stopRequested: boolean;
  watching: boolean;
  watchNotice: string | null;
  simError: string | null;
  onStop: () => void;
}) {
  const { playback } = props;
  return (
    <>
      {playback ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
          <p
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {props.announcementText}
          </p>
          <div className="min-w-0 space-y-1" aria-hidden="true">
            <p className="text-sm font-medium text-warning">
              {props.stopRequested
                ? "Stopping simulation"
                : props.watching
                  ? "Heading to tip-off"
                  : "Simulating"}{" "}
              · {formatGameDate(playback.currentDate)}
            </p>
            <p className="text-sm text-muted">
              Day {playback.daysAdvanced} of {playback.daysRequested} ·{" "}
              {playback.gamesSimulated} games played
            </p>
          </div>
          <button
            type="button"
            onClick={props.onStop}
            disabled={props.stopRequested}
            className={buttonClass({ variant: "secondary" })}
          >
            {props.stopRequested ? "Stopping…" : "Stop simulation"}
          </button>
        </div>
      ) : props.simulationPending ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-team-ink/50 bg-team/15 px-3 py-2 text-sm text-ink"
        >
          Simulation in progress — calendar navigation is locked until it
          finishes.
        </p>
      ) : null}

      {props.watchNotice ? (
        <p role="status" className="text-sm text-warning">
          {props.watchNotice}
        </p>
      ) : null}

      {props.simError ? (
        <p role="alert" className="text-sm text-loss">
          {props.simError}
        </p>
      ) : null}
    </>
  );
}

/** Banner offering to continue a paused simulate-to-date run. */
export function CalendarResumeBanner(props: {
  resumeTarget: string;
  onContinue: (targetDate: string) => void;
  onDismiss: () => void;
}) {
  const { resumeTarget } = props;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-team-ink/40 bg-team/10 px-4 py-3"
    >
      <p className="text-sm text-ink">
        Continue simulation through{" "}
        <span className="font-medium">{formatGameDate(resumeTarget)}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => props.onContinue(resumeTarget)}
          className={buttonClass({ variant: "primary" })}
        >
          Continue to {formatGameDate(resumeTarget)}
        </button>
        <button
          type="button"
          onClick={props.onDismiss}
          className={buttonClass({ variant: "secondary" })}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
