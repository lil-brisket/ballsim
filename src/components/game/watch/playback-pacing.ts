import { opensAtNewEnd } from "@/state/watch-full-court";
import type { WatchGameView, WatchPlayKind } from "@/state/watch-game-view";

/**
 * How long each play stays on screen at 1x before the next one is revealed.
 * Shots get time for the ball flight; free throws, rebounds and
 * substitutions move quickly.
 */
export const PLAY_PACING_MS: Record<WatchPlayKind, number> = {
  two_made: 1400,
  two_missed: 1400,
  three_made: 1400,
  three_missed: 1400,
  ft_made: 600,
  ft_missed: 600,
  offensive_rebound: 500,
  defensive_rebound: 500,
  turnover: 900,
  shooting_foul: 700,
  personal_foul: 700,
  offensive_foul: 700,
  substitution: 300,
};

/**
 * Extra time at 1x for a play that opens a possession at the other end: the
 * ball comes up the floor before the play's own action.
 */
export const TRANSITION_MS = 800;

/** Wait before the first play. */
export const TIP_OFF_MS = 600;

/** Extra pause when the next play starts a new period. */
export const PERIOD_BREAK_MS = 1500;

/**
 * Milliseconds at 1x to wait before revealing play `revealed` (the next
 * one): the pacing of the play on screen, plus the ball's trip up the floor
 * when that play opened a possession at the other end, plus a break between
 * periods.
 */
export function playDelayMs(view: WatchGameView, revealed: number): number {
  if (revealed <= 0 || !view.plays[revealed - 1]) {
    return TIP_OFF_MS;
  }
  const shown = view.plays[revealed - 1]!;
  const next = view.plays[revealed];
  const periodBreak =
    next && next.period !== shown.period ? PERIOD_BREAK_MS : 0;
  return motionMs(view, revealed) + periodBreak;
}

/**
 * Milliseconds at 1x the court spends moving through play `revealed - 1`:
 * its delay without the period break (the period card owns that time); 0 at
 * tip-off.
 */
export function motionMs(view: WatchGameView, revealed: number): number {
  const shown = revealed > 0 ? view.plays[revealed - 1] : undefined;
  if (!shown) {
    return 0;
  }
  const trip = opensAtNewEnd(view, revealed - 1) ? TRANSITION_MS : 0;
  return PLAY_PACING_MS[shown.kind] + trip;
}

/** Share of play `index`'s motion spent bringing the ball up the floor. */
export function openerShare(view: WatchGameView, index: number): number {
  const play = view.plays[index];
  if (!play) {
    return 0;
  }
  return TRANSITION_MS / (TRANSITION_MS + PLAY_PACING_MS[play.kind]);
}
