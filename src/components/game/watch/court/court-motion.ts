import type { PlayerId } from "@/domain/ids";
import type { PlayChoreography } from "@/state/watch-court-choreo";
import type { CourtLastPlay } from "@/state/watch-court-frame";
import type { FullCourtPoint } from "@/state/watch-full-court";
import { RIM_HEIGHT_FT } from "./court-tilt";

export const pct = (value: number): string =>
  `${Math.round(value * 10000) / 100}%`;

const hundredths = (value: number) => Math.round(value * 10000) / 100;

/**
 * Transform that places a zero-size layer at a full-court point. The court
 * floor is a size container, so 100cqw/100cqh is the floor's width/height
 * and motion stays on the compositor (no left/top layout).
 */
export function courtTranslate(point: FullCourtPoint): string {
  return `translate(${hundredths(point.x)}cqw, ${hundredths(point.y)}cqh)`;
}

/** The ball's size under the tilted camera, in proportion to the rim. */
export const TILT_BALL_SCALE = 0.8;

/** Passes travel at an even speed, so a short pass never looks flicked. */
const PASS_EASING = "linear";

/** Ball rest pose, a dribble (pushed into the floor) and the arc heights. */
const BALL_REST = "translateY(0px) scale(1)";
const BALL_DRIBBLE = "translateY(1px) scale(0.85)";
const SHOT_LIFT_PX = 18;
const DROP_LIFT_PX = 8;
const ARC_STEPS = 6;
/** Dribbles over a whole play's length of carrying. */
const DRIBBLES_PER_PLAY = 5;

/**
 * Keyframe samples per whole play along a smoothed track. Between samples
 * the motion is linear, so this sets how round the curves look.
 */
const SAMPLES_PER_PLAY = 30;

/**
 * Monotone cubic (Fritsch-Carlson) tangents for one axis: smooth through
 * every beat without overshooting, and zero where the player stops or turns
 * back. The ends keep the one-sided speed so motion runs on into the next
 * play instead of stopping at every reveal, unless `stop` (a dead ball) brings
 * the last beat to rest.
 */
function tangents(times: number[], values: number[], stop: boolean): number[] {
  const n = values.length;
  const slope = (k: number) =>
    (values[k + 1]! - values[k]!) / (times[k + 1]! - times[k]!);
  return values.map((_, k) => {
    if (k === 0) {
      return n > 1 ? slope(0) : 0;
    }
    if (k === n - 1) {
      return stop || n < 2 ? 0 : slope(n - 2);
    }
    const a = slope(k - 1);
    const b = slope(k);
    if (a * b <= 0) {
      return 0;
    }
    const h0 = times[k]! - times[k - 1]!;
    const h1 = times[k + 1]! - times[k]!;
    const w0 = 2 * h1 + h0;
    const w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / a + w1 / b);
  });
}

/** Smooth position along a track at play time `t` (exact at every beat). */
export function smoothTrack(
  beats: number[],
  points: FullCourtPoint[],
  stop = false,
): (t: number) => FullCourtPoint {
  const mx = tangents(
    beats,
    points.map((p) => p.x),
    stop,
  );
  const my = tangents(
    beats,
    points.map((p) => p.y),
    stop,
  );
  return (t) => {
    let k = 0;
    while (k < beats.length - 2 && t > beats[k + 1]!) {
      k += 1;
    }
    const t0 = beats[k]!;
    const h = beats[k + 1]! - t0;
    if (h <= 0) {
      return points[k + 1]!;
    }
    const u = Math.min(1, Math.max(0, (t - t0) / h));
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    const a = points[k]!;
    const b = points[k + 1]!;
    return {
      x: h00 * a.x + h10 * h * mx[k]! + h01 * b.x + h11 * h * mx[k + 1]!,
      y: h00 * a.y + h10 * h * my[k]! + h01 * b.y + h11 * h * my[k + 1]!,
    };
  };
}

/** Sample times for the leg between two beats (both ends excluded). */
function legSamples(from: number, to: number): number[] {
  const count = Math.max(1, Math.ceil((to - from) * SAMPLES_PER_PLAY));
  return Array.from(
    { length: count - 1 },
    (_, i) => from + ((to - from) * (i + 1)) / count,
  );
}

/**
 * Keyframes for one player's track: the beats themselves plus samples along
 * a smooth curve through them, so a player keeps his momentum through a
 * beat instead of braking to a stop at each one.
 */
export function trackKeyframes(
  beats: number[],
  points: FullCourtPoint[],
  stop = false,
  translate: (point: FullCourtPoint) => string = courtTranslate,
): Keyframe[] {
  const at = smoothTrack(beats, points, stop);
  const frames: Keyframe[] = [];
  beats.forEach((t, k) => {
    frames.push({ transform: translate(points[k]!), offset: t });
    if (k < beats.length - 1) {
      for (const sample of legSamples(t, beats[k + 1]!)) {
        frames.push({ transform: translate(at(sample)), offset: sample });
      }
    }
  });
  return frames;
}

/**
 * The ball over the floor. A carried ball rides its holder's smooth track
 * at the same samples, so the two never drift apart; passes and steals are
 * quick and straight, shots and loose balls travel evenly.
 */
export function ballFloorKeyframes(
  choreo: PlayChoreography,
  translate: (point: FullCourtPoint) => string = courtTranslate,
): Keyframe[] {
  const tracks = new Map(
    choreo.tracks.map((track) => [
      track.playerId,
      smoothTrack(choreo.beats, track.points, choreo.deadBall),
    ]),
  );
  const frames: Keyframe[] = [];
  choreo.ball.forEach((ball, k) => {
    const leg = choreo.legs[k];
    frames.push({
      transform: translate(ball.at),
      offset: choreo.beats[k],
      easing: leg === "pass" || leg === "steal" ? PASS_EASING : "linear",
    });
    const holder = ball.holderId !== null ? tracks.get(ball.holderId) : null;
    if (leg === "carry" && holder) {
      for (const sample of legSamples(choreo.beats[k]!, choreo.beats[k + 1]!)) {
        frames.push({
          transform: translate(holder(sample)),
          offset: sample,
        });
      }
    }
  });
  return frames;
}

const liftPose = (px: number) =>
  `translateY(${-px}px) scale(${
    Math.round((1 + (0.6 * px) / SHOT_LIFT_PX) * 100) / 100
  })`;

/** Height in px of a ball held mid-air between two legs (a blocked shot); 0 otherwise. */
const heldLiftPx = (ball: { lift: number }) =>
  ball.lift > 0 && ball.lift < 1
    ? Math.round(ball.lift * SHOT_LIFT_PX * 10) / 10
    : 0;

/**
 * Height of the ball above the floor, on an inner layer: steady dribbles
 * while carried, an arc for the shot, and a smaller one for a ball coming
 * off the rim to a rebounder. A blocked shot rises only to the blocker's hand
 * (a partial lift, the short "shot" leg), then drops from there to the floor
 * on the "loose" leg that follows.
 */
export function ballLiftKeyframes(choreo: PlayChoreography): Keyframe[] {
  const frames: Keyframe[] = [{ transform: BALL_REST, offset: 0 }];
  choreo.legs.forEach((leg, k) => {
    const from = choreo.beats[k]!;
    const to = choreo.beats[k + 1]!;
    const risePx = leg === "shot" ? heldLiftPx(choreo.ball[k + 1]!) : 0;
    const dropPx = leg === "loose" ? heldLiftPx(choreo.ball[k]!) : 0;
    const offRim =
      leg === "loose" &&
      choreo.ball[k]!.lift > 0 &&
      choreo.ball[k + 1]!.holderId !== null;
    if (leg === "carry") {
      const dribbles = Math.max(1, Math.round((to - from) * DRIBBLES_PER_PLAY));
      for (let d = 0; d < dribbles; d += 1) {
        const step = (to - from) / dribbles;
        frames.push({
          transform: BALL_DRIBBLE,
          offset: from + step * (d + 0.5),
        });
        if (d < dribbles - 1) {
          frames.push({ transform: BALL_REST, offset: from + step * (d + 1) });
        }
      }
    } else if (risePx > 0 || dropPx > 0) {
      for (let step = 1; step < ARC_STEPS; step += 1) {
        const t = step / ARC_STEPS;
        const px =
          risePx > 0
            ? risePx * Math.sin((Math.PI / 2) * t)
            : dropPx * Math.cos((Math.PI / 2) * t);
        frames.push({
          transform: liftPose(Math.round(px * 10) / 10),
          offset: from + (to - from) * t,
        });
      }
    } else if (leg === "shot" || offRim) {
      const height = leg === "shot" ? SHOT_LIFT_PX : DROP_LIFT_PX;
      for (let step = 1; step < ARC_STEPS; step += 1) {
        const t = step / ARC_STEPS;
        const bump = Math.sin(Math.PI * t);
        const lift = Math.round(height * bump * 10) / 10;
        const scale =
          Math.round((1 + (0.6 * bump * height) / SHOT_LIFT_PX) * 100) / 100;
        frames.push({
          transform: `translateY(${-lift}px) scale(${scale})`,
          offset: from + (to - from) * t,
        });
      }
    }
    frames.push({
      transform: risePx > 0 ? liftPose(risePx) : BALL_REST,
      offset: to,
    });
  });
  return frames;
}

/** Hands height when a shot leaves them, feet. */
const RELEASE_FT = 7.5;
/** How far a shot climbs above the straight line to the rim, feet. */
const SHOT_ARC_FT = 5;
/** A ball in hand, feet. */
const HELD_FT = 3;
const CHEST_PASS_FT = 4.5;
const FLOOR_FT = 0.4;
/** Share of the last carry before a shot spent bringing the ball up. */
const GATHER_SHARE = 0.2;

/**
 * The ball's real height in feet at play time `p`, for a camera that can show
 * it: dribbled low, passed at chest height, shot in an arc that arrives at rim
 * height. A make then falls through the net; a miss stays up for the rebound,
 * which the next play brings down.
 */
export function ballHeightAt(
  choreo: PlayChoreography,
  made = false,
): (p: number) => number {
  const restAt = (k: number): number => {
    const ball = choreo.ball[k]!;
    if (ball.lift > 0) {
      return ball.lift * RIM_HEIGHT_FT;
    }
    return ball.holderId !== null ? HELD_FT : FLOOR_FT;
  };
  return (p) => {
    let k = 0;
    while (k < choreo.legs.length - 1 && p >= choreo.beats[k + 1]!) {
      k += 1;
    }
    const from = choreo.beats[k]!;
    const to = choreo.beats[k + 1] ?? from;
    const u =
      to > from ? Math.min(1, Math.max(0, (p - from) / (to - from))) : 1;
    const start = restAt(k);
    const end = restAt(Math.min(k + 1, choreo.ball.length - 1));
    switch (choreo.legs[k]) {
      case "shot": {
        // A block rises only as far as the hand that meets it.
        const full = end >= RIM_HEIGHT_FT;
        return (
          RELEASE_FT +
          (end - RELEASE_FT) * u +
          Math.sin(Math.PI * u) * (full ? SHOT_ARC_FT : 1)
        );
      }
      case "loose": {
        // Falling: slow from the top, fast at the bottom.
        const landing = made && k === choreo.legs.length - 1 ? FLOOR_FT : end;
        return landing + (start - landing) * (1 - u * u);
      }
      case "pass":
      case "steal":
        return CHEST_PASS_FT + Math.sin(Math.PI * u) * 0.6;
      default: {
        const nextIsShot = choreo.legs[k + 1] === "shot";
        const span = to - from;
        const dribbles = Math.max(1, Math.round(span * DRIBBLES_PER_PLAY));
        const bounce =
          FLOOR_FT +
          (HELD_FT - FLOOR_FT) * Math.abs(Math.cos(Math.PI * dribbles * u));
        if (nextIsShot && u > 1 - GATHER_SHARE) {
          const gather = (u - (1 - GATHER_SHARE)) / GATHER_SHARE;
          return bounce + (RELEASE_FT - bounce) * gather;
        }
        return bounce;
      }
    }
  };
}

/** Inner layer keyframes for the tilted camera, from `ballHeightAt`. */
export function ballHeightKeyframes(
  choreo: PlayChoreography,
  pxPerFt: number,
  made = false,
): Keyframe[] {
  const heightOf = ballHeightAt(choreo, made);
  const pose = (t: number) => {
    const px = Math.round(heightOf(t) * pxPerFt * 10) / 10;
    return {
      transform: `translateY(${-px}px) scale(${TILT_BALL_SCALE})`,
      offset: t,
    };
  };
  const frames: Keyframe[] = [];
  choreo.beats.forEach((t, k) => {
    frames.push(pose(t));
    if (k < choreo.beats.length - 1) {
      const next = choreo.beats[k + 1]!;
      const steps = Math.max(6, Math.ceil((next - t) * SAMPLES_PER_PLAY));
      for (let step = 1; step < steps; step += 1) {
        frames.push(pose(t + ((next - t) * step) / steps));
      }
    }
  });
  return frames;
}

/**
 * Play time (0..1) of a running animation, read from the animation itself so
 * it follows pause, speed changes and retiming; null once it is cancelled.
 */
export function animationProgress(animation: Animation): number | null {
  const time = animation.currentTime;
  const end = animation.effect?.getComputedTiming().endTime;
  if (typeof time !== "number" || typeof end !== "number" || end <= 0) {
    return null;
  }
  return Math.min(1, Math.max(0, time / end));
}

/** Value at `p` along keyframes sampled as ascending offsets. */
function lerpAt(offsets: number[], values: number[], p: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid]! <= p) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const span = offsets[hi]! - offsets[lo]!;
  const u = span > 0 ? Math.min(1, Math.max(0, (p - offsets[lo]!) / span)) : 1;
  return values[lo]! + (values[hi]! - values[lo]!) * u;
}

export type BallSample = FullCourtPoint & { liftPx: number };

/**
 * The ball at play time `p`, read back from the keyframes the DOM ball runs,
 * so anything drawn alongside it follows the same path and arc.
 */
export function ballSampler(
  choreo: PlayChoreography,
): (p: number) => BallSample {
  const floor = ballFloorKeyframes(choreo).map((frame) => {
    const match = /translate\((-?[\d.]+)cqw, (-?[\d.]+)cqh\)/.exec(
      String(frame.transform),
    );
    return {
      offset: frame.offset as number,
      x: Number(match?.[1] ?? 0) / 100,
      y: Number(match?.[2] ?? 0) / 100,
    };
  });
  const lift = ballLiftKeyframes(choreo).map((frame) => {
    const match = /translateY\((-?[\d.]+)px\)/.exec(String(frame.transform));
    return {
      offset: frame.offset as number,
      px: -Number(match?.[1] ?? 0),
    };
  });
  const floorOffsets = floor.map((frame) => frame.offset);
  const xs = floor.map((frame) => frame.x);
  const ys = floor.map((frame) => frame.y);
  const liftOffsets = lift.map((frame) => frame.offset);
  const lifts = lift.map((frame) => frame.px);
  return (p) => ({
    x: lerpAt(floorOffsets, xs, p),
    y: lerpAt(floorOffsets, ys, p),
    liftPx: lerpAt(liftOffsets, lifts, p),
  });
}

/** Play time (0..1) when a shot or free throw reaches the rim; null without one. */
export function rimTime(choreo: PlayChoreography): number | null {
  const shot = choreo.legs.indexOf("shot");
  return shot >= 0 ? choreo.beats[shot + 1]! : null;
}

export function calloutText(
  play: CourtLastPlay,
  labelOf: (id: PlayerId | null) => string | null,
): string | null {
  const withName = (prefix: string, id: PlayerId | null) => {
    const name = labelOf(id);
    return name ? `${prefix} · ${name}` : prefix;
  };
  if (play.motion === "turnover") {
    return play.outcome === "stolen"
      ? withName("Steal", play.player2Id)
      : "Turnover";
  }
  if (play.outcome === "blocked") {
    return withName("Block", play.player2Id);
  }
  if (play.motion === "foul") {
    return play.kind === "offensive_foul"
      ? "Offensive foul"
      : withName("Foul", play.playerId);
  }
  return null;
}
