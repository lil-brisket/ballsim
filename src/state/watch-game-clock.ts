/**
 * Ticking game clock for the Watch Game page (display only). The log stores
 * one clock per possession: the seconds left in the period when it started,
 * shared by every row of the possession. While a play animates the clock
 * counts down linearly through the possession's span, from its start to the
 * start of the next possession in the same period (0:00 when the period ends),
 * split evenly between the possession's plays. Pacing never depends on it.
 */
import type { WatchGameView, WatchPlay } from "@/state/watch-game-view";

const sameSpan = (a: WatchPlay, b: WatchPlay) =>
  a.period === b.period && a.poss === b.poss;

/**
 * Seconds left on the game clock `fraction` (0..1) of the way through the
 * motion of play `revealed - 1`, or null when the clock does not run: at
 * tip-off, on substitutions and for indices outside the log.
 *
 * It never rises as `fraction` or `revealed` grows within a period, starts at
 * the possession's logged clock, never drops below the next possession's
 * clock, and the possession's last play ends on it (or on 0 at a period end).
 */
export function clockAt(
  view: WatchGameView,
  revealed: number,
  fraction: number,
): number | null {
  const index = Math.floor(revealed) - 1;
  const play = view.plays[index];
  if (!play || play.kind === "substitution") {
    return null;
  }
  const plays = view.plays;

  // The possession's plays (substitutions in between are not part of it),
  // and the first play of the next possession.
  let position = 0;
  let count = 1;
  let first: WatchPlay = play;
  for (let i = index - 1; i >= 0; i -= 1) {
    const other = plays[i]!;
    if (other.kind === "substitution") {
      continue;
    }
    if (!sameSpan(other, play)) {
      break;
    }
    position += 1;
    count += 1;
    first = other;
  }
  let next: WatchPlay | undefined;
  for (let i = index + 1; i < plays.length; i += 1) {
    const other = plays[i]!;
    if (other.kind === "substitution") {
      continue;
    }
    if (!sameSpan(other, play)) {
      next = other;
      break;
    }
    count += 1;
  }

  const start = first.clock;
  const end =
    next && next.period === play.period ? Math.min(start, next.clock) : 0;
  const progress = Math.min(1, Math.max(0, fraction));
  return start - (start - end) * ((position + progress) / count);
}
