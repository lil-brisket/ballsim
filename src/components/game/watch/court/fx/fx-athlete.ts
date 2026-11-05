/**
 * How an overhead athlete stands at a moment of a play, worked out from the
 * same tracks the court's tokens run on. Pure, with no Pixi: a pose is a
 * function of play time, so it pauses and retimes with the court.
 */
import type { PlayerId } from "@/domain/ids";
import type { PlayChoreography } from "@/state/watch-court-choreo";
import type { FullCourtPoint } from "@/state/watch-full-court";

export type AthletePoseInput = {
  /** Where the player is at a play time. */
  at: (p: number) => FullCourtPoint;
  /** Where the ball is at a play time. */
  ball: (p: number) => FullCourtPoint;
  /** Whether this player holds the ball at a play time. */
  holds: (p: number) => boolean;
  /** The rim the offense attacks, where a ball handler looks. */
  rim: FullCourtPoint;
  /** Play time this player lets a shot go; null when they don't shoot. */
  release: number | null;
  p: number;
  motionMs: number;
};

export type AthletePose = {
  /** Direction the player faces, in radians on the floor. */
  facing: number;
  /** Leg swing, -1..1; 0 standing still. */
  stride: number;
  /** Arms up for a shot and off the floor, 0..1. */
  lift: number;
  /** Has the ball in hand, 0..1 (eased so a catch never snaps). */
  hold: number;
};

/** Floor fractions to feet, so directions come out true on a 94 x 50 floor. */
const FEET_X = 94;
const FEET_Y = 50;
/** Time either side of now for measuring speed. */
const SPEED_WINDOW_MS = 60;
/** Slower than this (ft/s) the player reads as standing. */
const WALK_FT_S = 2;
/** At this speed (ft/s) the stride is at its fullest. */
const RUN_FT_S = 14;
/** One full leg cycle. */
const STRIDE_MS = 620;
/** Up with the ball: the jump peaks just after it leaves the hands. */
const RISE_MS = 120;
const RISE_AFTER_MS = 60;
const HANG_MS = 200;
const FALL_MS = 200;
const HOLD_EASE_MS = 60;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Arms and jump through a shot: up before the release, down after it. */
function shotLift(ms: number): number {
  if (ms < -RISE_MS || ms > HANG_MS + FALL_MS) {
    return 0;
  }
  if (ms < RISE_AFTER_MS) {
    const rise = (ms + RISE_MS) / (RISE_MS + RISE_AFTER_MS);
    return Math.sin(rise * (Math.PI / 2));
  }
  return ms < HANG_MS ? 1 : 1 - (ms - HANG_MS) / FALL_MS;
}

function unitToward(from: FullCourtPoint, to: FullCourtPoint) {
  const x = (to.x - from.x) * FEET_X;
  const y = (to.y - from.y) * FEET_Y;
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : null;
}

/**
 * When a player goes up in this play: the shooter at the release, a blocker as
 * they meet the ball, a rebounder as it reaches them. Null to stay on the floor.
 */
export function jumpTimeFor(
  choreo: PlayChoreography,
  playerId: PlayerId,
  blockerId: PlayerId | null,
): number | null {
  const shot = choreo.legs.indexOf("shot");
  if (shot >= 0) {
    if (choreo.ball[shot]?.holderId === playerId) {
      return choreo.beats[shot] ?? null;
    }
    if (blockerId === playerId) {
      return choreo.beats[shot + 1] ?? null;
    }
  }
  for (let k = 0; k < choreo.legs.length; k += 1) {
    if (
      choreo.legs[k] === "loose" &&
      (choreo.ball[k]?.lift ?? 0) > 0 &&
      choreo.ball[k + 1]?.holderId === playerId
    ) {
      return choreo.beats[k + 1] ?? null;
    }
  }
  return null;
}

export function athletePose(input: AthletePoseInput): AthletePose {
  const { at, p, motionMs } = input;
  const window = SPEED_WINDOW_MS / motionMs;
  const before = at(p - window);
  const after = at(p + window);
  const now = at(p);
  const dx = (after.x - before.x) * FEET_X;
  const dy = (after.y - before.y) * FEET_Y;
  const speed = Math.hypot(dx, dy) / ((SPEED_WINDOW_MS * 2) / 1000);
  const moving = clamp01(speed / WALK_FT_S);

  const ease = HOLD_EASE_MS / motionMs;
  const hold =
    [-ease, -ease / 2, 0, ease / 2, ease].filter((step) =>
      input.holds(p + step),
    ).length / 5;
  const lift =
    input.release === null ? 0 : shotLift((p - input.release) * motionMs);

  // Run toward where they're going; standing, watch the ball, or the rim with
  // the ball in hand. A shooter squares up to the rim whatever their feet do.
  const look =
    unitToward(now, hold > 0.5 || lift > 0 ? input.rim : input.ball(p)) ??
    unitToward(now, input.rim);
  const run = moving > 0 && speed > 0 ? { x: dx / speed, y: dy / speed } : null;
  const runLength = run ? Math.hypot(run.x, run.y) : 0;
  const runWeight = lift > 0 ? moving * (1 - lift) : moving;
  const fx =
    (run && runLength > 0 ? (run.x / runLength) * runWeight : 0) +
    (look?.x ?? 1) * (1 - runWeight);
  const fy =
    (run && runLength > 0 ? (run.y / runLength) * runWeight : 0) +
    (look?.y ?? 0) * (1 - runWeight);

  const amount = clamp01((speed - WALK_FT_S) / (RUN_FT_S - WALK_FT_S));
  const cycle = (p * motionMs) / STRIDE_MS;
  return {
    facing: Math.atan2(fy, fx),
    stride: Math.sin(cycle * Math.PI * 2) * amount * (1 - lift),
    lift,
    hold,
  };
}
