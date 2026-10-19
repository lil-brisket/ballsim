import type { PlayerId } from "@/domain/ids";
import type { PlayChoreography } from "@/state/watch-court-choreo";
import type { CourtLastPlay } from "@/state/watch-court-frame";
import type { FullCourtPoint } from "@/state/watch-full-court";

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

/** Passes leave the hand fast and arrive soft. */
const PASS_EASING = "ease-out";

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
 * play instead of stopping at every reveal.
 */
function tangents(times: number[], values: number[]): number[] {
  const n = values.length;
  const slope = (k: number) =>
    (values[k + 1]! - values[k]!) / (times[k + 1]! - times[k]!);
  return values.map((_, k) => {
    if (k === 0) {
      return n > 1 ? slope(0) : 0;
    }
    if (k === n - 1) {
      return slope(n - 2);
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
): (t: number) => FullCourtPoint {
  const mx = tangents(
    beats,
    points.map((p) => p.x),
  );
  const my = tangents(
    beats,
    points.map((p) => p.y),
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
): Keyframe[] {
  const at = smoothTrack(beats, points);
  const frames: Keyframe[] = [];
  beats.forEach((t, k) => {
    frames.push({ transform: courtTranslate(points[k]!), offset: t });
    if (k < beats.length - 1) {
      for (const sample of legSamples(t, beats[k + 1]!)) {
        frames.push({ transform: courtTranslate(at(sample)), offset: sample });
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
export function ballFloorKeyframes(choreo: PlayChoreography): Keyframe[] {
  const tracks = new Map(
    choreo.tracks.map((track) => [
      track.playerId,
      smoothTrack(choreo.beats, track.points),
    ]),
  );
  const frames: Keyframe[] = [];
  choreo.ball.forEach((ball, k) => {
    const leg = choreo.legs[k];
    frames.push({
      transform: courtTranslate(ball.at),
      offset: choreo.beats[k],
      easing: leg === "pass" || leg === "steal" ? PASS_EASING : "linear",
    });
    const holder = ball.holderId !== null ? tracks.get(ball.holderId) : null;
    if (leg === "carry" && holder) {
      for (const sample of legSamples(choreo.beats[k]!, choreo.beats[k + 1]!)) {
        frames.push({
          transform: courtTranslate(holder(sample)),
          offset: sample,
        });
      }
    }
  });
  return frames;
}

/**
 * Height of the ball above the floor, on an inner layer: steady dribbles
 * while carried, an arc for the shot, and a smaller one for a ball coming
 * off the rim to a rebounder.
 */
export function ballLiftKeyframes(choreo: PlayChoreography): Keyframe[] {
  const frames: Keyframe[] = [{ transform: BALL_REST, offset: 0 }];
  choreo.legs.forEach((leg, k) => {
    const from = choreo.beats[k]!;
    const to = choreo.beats[k + 1]!;
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
    frames.push({ transform: BALL_REST, offset: to });
  });
  return frames;
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

export function initialOf(label: string): string {
  const word = label.trim().split(/\s+/).pop() ?? "";
  return word.slice(0, 1).toUpperCase();
}
