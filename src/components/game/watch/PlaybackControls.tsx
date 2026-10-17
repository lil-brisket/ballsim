import { ProgressBar } from "@/components/ui";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/styles";

export const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

const BUTTON_CLASS = buttonClass({ variant: "secondary" });

export function PlaybackControls(props: {
  playing: boolean;
  speed: PlaybackSpeed;
  revealed: number;
  total: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onSkipToEnd: () => void;
  onRestart: () => void;
  onPreviousPossession: () => void;
  onNextPossession: () => void;
}) {
  const atEnd = props.revealed >= props.total;
  return (
    <div className="space-y-3" role="group" aria-label="Playback controls">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(buttonClass({ variant: "primary" }), "min-w-20")}
          onClick={props.onTogglePlay}
          disabled={atEnd && !props.playing}
        >
          {props.playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          className={BUTTON_CLASS}
          onClick={props.onPreviousPossession}
          disabled={props.revealed <= 0}
        >
          Previous possession
        </button>
        <button
          type="button"
          className={BUTTON_CLASS}
          onClick={props.onNextPossession}
          disabled={atEnd}
        >
          Next possession
        </button>
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Speed"
        >
          {PLAYBACK_SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={props.speed === speed}
              className={cn(
                BUTTON_CLASS,
                "px-2 tabular-nums",
                props.speed === speed &&
                  "border-team-ink bg-team/15 text-team-ink",
              )}
              onClick={() => props.onSpeedChange(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>
        <button
          type="button"
          className={BUTTON_CLASS}
          onClick={props.onSkipToEnd}
          disabled={atEnd}
        >
          Skip to end
        </button>
        <button
          type="button"
          className={BUTTON_CLASS}
          onClick={props.onRestart}
        >
          Restart
        </button>
      </div>
      <div className="flex items-center gap-3">
        <ProgressBar
          value={props.revealed}
          max={props.total}
          aria-label="Playback progress"
          className="flex-1"
        />
        <span className="shrink-0 text-sm tabular-nums text-zinc-400">
          {props.revealed} / {props.total} plays
        </span>
      </div>
    </div>
  );
}
