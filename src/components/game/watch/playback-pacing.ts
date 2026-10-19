import { fieldGoalActionMs } from "@/state/watch-court-choreo";
import { subRunEnd } from "@/state/watch-court-frame";
import { opensAtNewEnd, restartKindAt } from "@/state/watch-full-court";
import type { WatchGameView, WatchPlayKind } from "@/state/watch-game-view";

/**
 * How long each play stays on screen at 1x before the next one is revealed.
 * Field goals are paced by their passes instead (`actionMs`); the values
 * here are only their floor. Free throws and rebounds move quickly.
 * A substitution is only shown on its own when playback starts inside a run
 * of them (manual stepping); a whole run is revealed at once and paced by
 * `SUB_RUN_MS`.
 */
export const PLAY_PACING_MS: Record<WatchPlayKind, number> = {
  two_made: 1350,
  two_missed: 1350,
  three_made: 1350,
  three_missed: 1350,
  ft_made: 1000,
  ft_missed: 1000,
  offensive_rebound: 1000,
  defensive_rebound: 1000,
  turnover: 1300,
  shooting_foul: 1000,
  personal_foul: 1000,
  offensive_foul: 1000,
  substitution: 300,
};

/**
 * A run of consecutive substitutions is revealed as one step; the players
 * walk between the benches and the floor over this long, however many
 * substitutions are in the run.
 */
export const SUB_RUN_MS = 2000;

/**
 * Extra time at 1x for a play that opens a possession at the other end: the
 * ball comes up the floor before the play's own action.
 */
export const TRANSITION_MS = 2800;

/**
 * A whistle cuts the bring-up short: a foul on a possession's opening play
 * comes partway up the floor instead of after a full trip.
 */
export const WHISTLE_TRANSITION_MS = 2400;

const WHISTLE_KINDS = new Set<WatchPlayKind>([
  "shooting_foul",
  "personal_foul",
  "offensive_foul",
]);

function transitionMs(kind: WatchPlayKind): number {
  return WHISTLE_KINDS.has(kind) ? WHISTLE_TRANSITION_MS : TRANSITION_MS;
}

/**
 * Wait before the first play: the court stands in the jump-ball formation.
 * The tip itself is part of play 0's motion (`TIP_MS`).
 */
export const TIP_OFF_MS = 600;

/**
 * Extra time at 1x on the game's first play for the jump ball: the ball goes
 * up at centre court and is tipped to the team that gains possession.
 */
export const TIP_MS = 1600;

/**
 * Extra time at 1x for a play that opens a possession with a dead-ball
 * inbound from the sideline at the same end: the ball is spotted, inbounded
 * and walked into the set-up. (At a new end the bring-up covers it.)
 */
export const DEAD_BALL_MS = 1300;

/** Extra pause when the next play starts a new period. */
export const PERIOD_BREAK_MS = 1500;
/** The period break speeds up with playback only up to this factor. */
export const PERIOD_BREAK_MAX_SPEEDUP = 2;

/**
 * Revealed count the playback timer moves to from `revealed`: the next play,
 * or the end of the whole run when the next play starts (or sits inside) a
 * run of substitutions. Manual stepping, seeking and jumps stay one play at a
 * time.
 */
export function revealAfter(view: WatchGameView, revealed: number): number {
  const next = view.plays[revealed];
  if (!next) {
    return Math.min(view.plays.length, revealed + 1);
  }
  return next.kind === "substitution"
    ? subRunEnd(view, revealed)
    : revealed + 1;
}

/**
 * Milliseconds at 1x to wait before revealing play `revealed` (the next
 * one): the pacing of the play on screen, plus the opening of its
 * possession, plus a break between periods.
 */
export function playDelayMs(
  view: WatchGameView,
  revealed: number,
  speed = 1,
): number {
  if (revealed <= 0 || !view.plays[revealed - 1]) {
    return TIP_OFF_MS;
  }
  const shown = view.plays[revealed - 1]!;
  const next = view.plays[revealed];
  // The period card is read, not watched: past 2x it stops speeding up, so
  // it is still readable at 4x and 8x. (Returned in 1x milliseconds, like
  // the rest; the caller divides by the speed.)
  const periodBreak =
    next && next.period !== shown.period
      ? (PERIOD_BREAK_MS * speed) / Math.min(speed, PERIOD_BREAK_MAX_SPEEDUP)
      : 0;
  return motionMs(view, revealed) + periodBreak;
}

/**
 * Time at 1x before the action of play `index`, when it opens a possession:
 * the jump ball (game start), the ball's trip up the floor (new end, period
 * start), or a dead-ball sideline inbound at the same end. 0 otherwise.
 */
export function openingMs(view: WatchGameView, index: number): number {
  const play = view.plays[index];
  if (!play) {
    return 0;
  }
  const kind = restartKindAt(view, index);
  const newEnd = opensAtNewEnd(view, index);
  return (
    (kind === "tip" ? TIP_MS : 0) +
    (newEnd ? transitionMs(play.kind) : 0) +
    (kind === "sideline" && !newEnd ? DEAD_BALL_MS : 0)
  );
}

/**
 * Milliseconds at 1x the court spends moving through play `revealed - 1`:
 * its delay without the period break (the period card owns that time); 0 at
 * tip-off. When `revealed` ends a run of substitutions the whole run is
 * `SUB_RUN_MS`, whatever its length.
 */
export function motionMs(view: WatchGameView, revealed: number): number {
  const shown = revealed > 0 ? view.plays[revealed - 1] : undefined;
  if (!shown) {
    return 0;
  }
  if (
    shown.kind === "substitution" &&
    subRunEnd(view, revealed - 1) === revealed
  ) {
    return SUB_RUN_MS;
  }
  return actionMs(view, revealed - 1) + openingMs(view, revealed - 1);
}

/** Share of play `index`'s motion spent opening its possession (0 when it has no opening). */
export function openerShare(view: WatchGameView, index: number): number {
  const play = view.plays[index];
  if (!play) {
    return 0;
  }
  const opening = openingMs(view, index);
  return opening / (opening + actionMs(view, index));
}

/** Share of play `index`'s motion spent on the jump ball (0 unless it is the tip). */
export function tipShare(view: WatchGameView, index: number): number {
  const play = view.plays[index];
  if (!play || restartKindAt(view, index) !== "tip") {
    return 0;
  }
  return TIP_MS / (openingMs(view, index) + actionMs(view, index));
}

/**
 * Milliseconds at 1x of play `index`'s own action (after any opening): a
 * field goal's grows with its passes (`fieldGoalActionMs`), so every pass
 * gets the same time in the air; other plays take `PLAY_PACING_MS`.
 */
export function actionMs(view: WatchGameView, index: number): number {
  const play = view.plays[index];
  if (!play) {
    return 0;
  }
  const kind = play.kind;
  return kind === "two_made" ||
    kind === "two_missed" ||
    kind === "three_made" ||
    kind === "three_missed"
    ? fieldGoalActionMs(view, index)
    : PLAY_PACING_MS[kind];
}
