import { ProgressBar } from "@/components/ui";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

export const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

const BUTTON_CLASS = cn(
  touchTargetClass,
  "rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-100 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40",
  focusRingClass,
);

export function PlaybackControls(props: {
  playing: boolean;
  speed: PlaybackSpeed;
  revealed: number;
  total: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onSkipToEnd: () => void;
  onRestart: () => void;
}) {
  const atEnd = props.revealed >= props.total;
  return (
    <div className="space-y-3" role="group" aria-label="Playback controls">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(
            BUTTON_CLASS,
            "min-w-20 border-team-ink bg-team/15 text-team-ink",
          )}
          onClick={props.onTogglePlay}
          disabled={atEnd && !props.playing}
        >
          {props.playing ? "Pause" : "Play"}
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
                "px-2 font-mono",
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
        <span className="shrink-0 font-mono text-xs text-zinc-400">
          {props.revealed} / {props.total} plays
        </span>
      </div>
    </div>
  );
}
