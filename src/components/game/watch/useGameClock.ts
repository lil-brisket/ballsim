"use client";

import { useEffect, useRef, useState } from "react";
import { clockAt } from "@/state/watch-game-clock";
import type { WatchGameView } from "@/state/watch-game-view";

/** How often the displayed clock updates while a play animates. */
export const CLOCK_TICK_MS = 250;

/**
 * Seconds on the ticking game clock for the play being animated (the play
 * `revealed - 1`), or null when the static clock of the settled play should
 * show: at tip-off, after a jump (`animated` false) and on substitutions.
 *
 * Progress through the play's motion is tracked in play time: while playing
 * it advances with the wall clock times `speed` over `motionMs` (the same
 * clock the court animations run on), is published every `CLOCK_TICK_MS`, and
 * is kept when playback pauses or the speed changes, so the clock freezes
 * with the court and resumes from the same spot. A new reveal starts at 0.
 */
export function useGameClock(props: {
  view: WatchGameView;
  revealed: number;
  /** The latest reveal came from the playback timer (its motion runs). */
  animated: boolean;
  playing: boolean;
  /** Milliseconds at 1x the play's motion takes. */
  motionMs: number;
  speed: number;
}): number | null {
  const { view, revealed, animated, playing, motionMs, speed } = props;
  const [progress, setProgress] = useState({ revealed: -1, fraction: 0 });
  const latest = useRef({ revealed: -1, fraction: 0 });

  useEffect(() => {
    if (!animated || !playing || motionMs <= 0 || revealed <= 0) {
      return;
    }
    const base =
      latest.current.revealed === revealed ? latest.current.fraction : 0;
    const startedAt = performance.now();
    const publish = () => {
      const fraction = Math.min(
        1,
        base + ((performance.now() - startedAt) * speed) / motionMs,
      );
      latest.current = { revealed, fraction };
      setProgress(latest.current);
    };
    const id = setInterval(publish, CLOCK_TICK_MS);
    return () => {
      clearInterval(id);
      publish();
    };
  }, [animated, playing, motionMs, speed, revealed]);

  if (!animated || revealed <= 0) {
    return null;
  }
  return clockAt(
    view,
    revealed,
    progress.revealed === revealed ? progress.fraction : 0,
  );
}
