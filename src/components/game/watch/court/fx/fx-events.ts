/**
 * Effect cues for the broadcast effects layer: what to draw for a play, where
 * and when. Pure and deterministic, with no Pixi. Times are normalized play
 * time (the same 0..1 the choreography's beats use), so an effect is a function
 * of the play's own progress and cannot drift from the court. Seeds come from
 * `courtSeed`, never simulation RNG or `Math.random`.
 */
import { rimTime } from "@/components/game/watch/court/court-motion";
import type { PlayerId } from "@/domain/ids";
import type { PlayChoreography } from "@/state/watch-court-choreo";
import { COURT_RIM, courtSeed } from "@/state/watch-court-frame";
import {
  toFullCourt,
  type FullCourtFrame,
  type FullCourtPoint,
} from "@/state/watch-full-court";
import type {
  WatchGameView,
  WatchPlay,
  WatchSide,
} from "@/state/watch-game-view";
import { madeShotTier, type FxTier } from "./fx-intensity";

export type CourtFxKind =
  /** Radial flash at the rim on a make. */
  | "rim_flash"
  /** Rings dropping through the net on a make. */
  | "net_ripple"
  /** Team-coloured light washing out from the rim. */
  | "arena_pulse"
  /** Team-coloured light over the whole floor, for the biggest moments. */
  | "floor_wash"
  /** Sparks thrown out from the rim on a bigger make. */
  | "light_burst"
  /** Extra team-coloured ring for an and-one, clutch shot or lead change. */
  | "accent_ring"
  /** Small spark off the rim on a miss. */
  | "rim_spark"
  /** Shock ring where a shot is blocked. */
  | "impact_ring"
  /** Restrained flick where the ball changes hands. */
  | "steal_flick";

export type CourtFxCue = {
  id: string;
  /** Normalized play time the effect starts. */
  at: number;
  /** Normalized duration; may run past 1 into the next play. */
  span: number;
  kind: CourtFxKind;
  /** Fraction of the floor, like every other court layer. */
  point: FullCourtPoint;
  side: WatchSide;
  tier: FxTier;
  seed: number;
};

/** Final-buzzer celebration for the winning side. */
export type CourtFxCelebration = {
  side: WatchSide;
  tier: FxTier;
  seed: number;
};

/** Offsets `courtSeed`'s salt clear of the salts the court frames use. */
const SALT_FX = 1000;

const FLASH_MS = 650;
const RIPPLE_MS = 800;
const PULSE_MS = 1100;
const WASH_MS = 900;
const BURST_MS = 900;
const ACCENT_MS = 1000;
const SPARK_MS = 500;
const IMPACT_MS = 650;
const FLICK_MS = 500;

const MISS_KINDS: readonly WatchPlay["kind"][] = [
  "two_missed",
  "three_missed",
  "ft_missed",
];

function ballAtTime(choreo: PlayChoreography, time: number): FullCourtPoint {
  let best = 0;
  choreo.beats.forEach((beat, k) => {
    if (Math.abs(beat - time) < Math.abs(choreo.beats[best]! - time)) {
      best = k;
    }
  });
  return choreo.ball[best]!.at;
}

/**
 * The shot that decided the game: late, and it took a lead the scorer's team
 * then never gave back.
 */
export function isGameWinner(view: WatchGameView, index: number): boolean {
  const play = view.plays[index];
  if (
    !play ||
    play.points <= 0 ||
    !play.highlights.includes("clutch") ||
    !play.highlights.includes("lead_change")
  ) {
    return false;
  }
  return !view.plays
    .slice(index + 1)
    .some(
      (later) =>
        later.highlights.includes("lead_change") ||
        later.highlights.includes("tie"),
    );
}

/** Cues for the choreographed play; empty for anything with no effect. */
export function buildCourtFxCues(
  view: WatchGameView,
  choreo: PlayChoreography | null,
  frame: FullCourtFrame,
  motionMs: number,
): CourtFxCue[] {
  if (!choreo || motionMs <= 0) {
    return [];
  }
  const play = view.plays[choreo.index];
  const lastPlay = frame.lastPlay;
  if (!play || !lastPlay || lastPlay.index !== choreo.index) {
    return [];
  }
  const cues: CourtFxCue[] = [];
  const add = (
    kind: CourtFxKind,
    at: number,
    ms: number,
    point: FullCourtPoint,
    tier: FxTier,
  ) => {
    const n = cues.length;
    cues.push({
      id: `${view.gameId}:${play.index}:${kind}:${n}`,
      at,
      span: ms / motionMs,
      kind,
      point,
      side: play.side,
      tier,
      seed: courtSeed(view.gameId, play.index, SALT_FX + n),
    });
  };

  const rim = toFullCourt(COURT_RIM, frame.attackingEnd);
  const rimAt = rimTime(choreo);

  if (play.points > 0 && play.kind !== "ft_made" && rimAt !== null) {
    const tier = madeShotTier(
      play.kind,
      play.highlights,
      isGameWinner(view, play.index),
    );
    add("arena_pulse", rimAt, PULSE_MS, rim, tier);
    add("rim_flash", rimAt, FLASH_MS, rim, tier);
    add("net_ripple", rimAt, RIPPLE_MS, rim, tier);
    if (tier !== "subtle") {
      add("light_burst", rimAt, BURST_MS, rim, tier);
    }
    if (tier === "strong" || tier === "signature") {
      add("accent_ring", rimAt, ACCENT_MS, rim, tier);
      add("floor_wash", rimAt, WASH_MS, rim, tier);
    }
  } else if (play.kind === "ft_made" && rimAt !== null) {
    add("rim_flash", rimAt, FLASH_MS, rim, "subtle");
    add("net_ripple", rimAt, RIPPLE_MS, rim, "subtle");
  } else if (lastPlay.outcome === "blocked" && rimAt !== null) {
    add("impact_ring", rimAt, IMPACT_MS, ballAtTime(choreo, rimAt), "moderate");
  } else if (MISS_KINDS.includes(play.kind) && rimAt !== null) {
    add("rim_spark", rimAt, SPARK_MS, rim, "subtle");
  } else if (lastPlay.motion === "turnover") {
    add(
      "steal_flick",
      choreo.eventAt,
      FLICK_MS,
      ballAtTime(choreo, choreo.eventAt),
      lastPlay.outcome === "stolen" ? "moderate" : "subtle",
    );
  }
  return cues;
}

/** Celebration for the winner once the game is over; null without a winner. */
export function buildCourtFxCelebration(
  view: WatchGameView,
): CourtFxCelebration | null {
  const last = view.plays[view.plays.length - 1];
  if (!last || last.homeScore === last.awayScore) {
    return null;
  }
  const decided = view.plays.some((_, index) => isGameWinner(view, index));
  return {
    side: last.homeScore > last.awayScore ? 0 : 1,
    tier: decided ? "signature" : "strong",
    seed: courtSeed(view.gameId, view.plays.length, SALT_FX),
  };
}

/**
 * Progress through a cue (0..1) at play time `p`; null when it isn't showing.
 * `minSpan` holds a cue on screen when playback speed would make it a blink.
 */
export function cueProgress(
  cue: CourtFxCue,
  p: number,
  minSpan = 0,
): number | null {
  if (cue.span <= 0) {
    return null;
  }
  const span = Math.max(cue.span, minSpan);
  return p < cue.at || p >= cue.at + span ? null : (p - cue.at) / span;
}

/** Stable value in [0, 1) for particle `index` of a seed (Mulberry32 mix). */
export function fxUnit(seed: number, index: number): number {
  let t = (seed + Math.imul(index + 1, 0x6d2b79f5)) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** How hot a run's ambience burns (0..1), building as the run grows. */
export function runLevel(points: number): number {
  return points <= 0 ? 0 : Math.min(1, 0.5 + (points - 8) * 0.06);
}

/** Index of the ball's leg at play time `p`. */
function legIndexAt(choreo: PlayChoreography, p: number): number {
  let k = 0;
  while (k < choreo.legs.length - 1 && p >= choreo.beats[k + 1]!) {
    k += 1;
  }
  return k;
}

/** Who has the ball at play time `p`, and whether it is on its way up. */
export function ballHolderAt(
  choreo: PlayChoreography,
  p: number,
): { holderId: PlayerId | null; shooting: boolean } {
  const k = legIndexAt(choreo, p);
  const next = choreo.legs[k + 1];
  return {
    holderId: choreo.ball[k]?.holderId ?? null,
    shooting: choreo.legs[k] === "shot" || next === "shot",
  };
}

/** The ball's leg at play time `p`. */
export function legAt(choreo: PlayChoreography, p: number) {
  return choreo.legs[legIndexAt(choreo, p)] ?? null;
}
