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

/** Players run between beats with a soft start and stop. */
const RUN_EASING = "ease-in-out";
/** Passes leave the hand fast and arrive soft. */
const PASS_EASING = "ease-out";

/** Ball rest pose, a dribble (pushed into the floor) and the arc heights. */
const BALL_REST = "translateY(0px) scale(1)";
const BALL_DRIBBLE = "translateY(1px) scale(0.85)";
const SHOT_LIFT_PX = 18;
const DROP_LIFT_PX = 8;
const ARC_STEPS = 6;

/** Keyframes for one player's track through a choreography. */
export function trackKeyframes(
  beats: number[],
  points: FullCourtPoint[],
): Keyframe[] {
  return points.map((point, k) => ({
    transform: courtTranslate(point),
    offset: beats[k],
    easing: RUN_EASING,
  }));
}

/**
 * The ball over the floor. A carried ball eases exactly like its holder so
 * the two never drift apart; passes and steals are quick and straight, shots
 * and loose balls travel evenly.
 */
export function ballFloorKeyframes(choreo: PlayChoreography): Keyframe[] {
  return choreo.ball.map((ball, k) => {
    const leg = choreo.legs[k];
    return {
      transform: courtTranslate(ball.at),
      offset: choreo.beats[k],
      easing:
        leg === "carry"
          ? RUN_EASING
          : leg === "pass" || leg === "steal"
            ? PASS_EASING
            : "linear",
    };
  });
}

/**
 * Height of the ball above the floor, on an inner layer: one dribble per
 * carried leg, an arc for the shot, and a smaller one for a ball coming off
 * the rim to a rebounder.
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
      frames.push({ transform: BALL_DRIBBLE, offset: (from + to) / 2 });
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
