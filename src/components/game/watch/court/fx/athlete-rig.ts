/**
 * A player's skeleton in feet, for a pose: where each joint is relative to the
 * spot on the floor they stand on. Pure, with no Pixi. Measuring in feet ties a
 * player's size to the court's, so they stand in proportion to the rim.
 */
import type { AthletePose } from "./fx-athlete";

/** Forward along the way they face, to their right, and up off the floor. */
export type Joint = { f: number; s: number; u: number };

export type AthleteRig = {
  head: Joint;
  neck: Joint;
  leftShoulder: Joint;
  rightShoulder: Joint;
  leftElbow: Joint;
  rightElbow: Joint;
  leftHand: Joint;
  rightHand: Joint;
  leftHip: Joint;
  rightHip: Joint;
  leftKnee: Joint;
  rightKnee: Joint;
  leftFoot: Joint;
  rightFoot: Joint;
};

export const HEAD_RADIUS_FT = 0.42;

const HIP_U = 3.25;
const HIP_S = 0.42;
const SHOULDER_U = 5.2;
const SHOULDER_S = 0.82;
const NECK_U = 5.5;
const HEAD_U = 5.95;
/** How far feet swing front to back at a full stride. */
const STRIDE_FT = 1.15;
/** Feet slightly staggered, so a standing player isn't a statue. */
const STANCE_FT = 0.3;
const FOOT_S = 0.42;
/** How far a trailing foot kicks up behind them at a full stride. */
const KICK_FT = 0.7;
/** Forward lean into a full sprint. */
const LEAN_FT = 0.35;
/** Off the floor at the top of a jump shot. */
const JUMP_FT = 1.4;

const mix = (a: Joint, b: Joint, t: number): Joint => ({
  f: a.f + (b.f - a.f) * t,
  s: a.s + (b.s - a.s) * t,
  u: a.u + (b.u - a.u) * t,
});

function leg(side: number, swing: number, hipF: number) {
  const foot: Joint = {
    f: swing * STRIDE_FT + side * STANCE_FT,
    s: side * FOOT_S,
    u: swing < 0 ? -swing * KICK_FT : 0,
  };
  const hip: Joint = { f: hipF, s: side * HIP_S, u: HIP_U };
  // Knees bend forward, and more as the foot comes off the floor.
  const knee: Joint = {
    f: (foot.f + hip.f) / 2 + 0.25 + foot.u * 0.3,
    s: side * (HIP_S + FOOT_S) * 0.5,
    u: (foot.u + hip.u) / 2 + 0.1,
  };
  return { foot, hip, knee };
}

export function athleteRig(pose: AthletePose): AthleteRig {
  const { stride, lift, hold } = pose;
  const jump = lift * JUMP_FT;
  const lean = Math.abs(stride) * LEAN_FT;

  const left = leg(-1, -stride, 0);
  const right = leg(1, stride, 0);

  const shoulderF = lean;
  const leftShoulder: Joint = { f: shoulderF, s: -SHOULDER_S, u: SHOULDER_U };
  const rightShoulder: Joint = { f: shoulderF, s: SHOULDER_S, u: SHOULDER_U };

  // Running: arms bent, swinging against the legs on the same side.
  const armOf = (side: number, swing: number) => ({
    elbow: {
      f: shoulderF - 0.15 + swing * 0.32,
      s: side * (SHOULDER_S + 0.14),
      u: SHOULDER_U - 1.1,
    },
    hand: {
      f: shoulderF + 0.42 + swing * 0.55,
      s: side * (SHOULDER_S - 0.1),
      u: SHOULDER_U - 1.4 + Math.max(0, swing) * 0.45,
    },
  });
  const leftRun = armOf(-1, stride);
  const rightRun = armOf(1, -stride);

  // Dribbling: the right hand low and out in front, over the ball.
  const rightDribble = {
    elbow: { f: shoulderF + 0.55, s: SHOULDER_S + 0.2, u: SHOULDER_U - 1.05 },
    hand: { f: shoulderF + 1.3, s: 0.5, u: SHOULDER_U - 2.2 },
  };
  // Shooting: both arms up and forward, hands together above the head.
  const shootOf = (side: number) => ({
    elbow: { f: shoulderF + 0.5, s: side * 0.72, u: SHOULDER_U + 0.75 },
    hand: { f: shoulderF + 0.45, s: side * 0.2, u: SHOULDER_U + 2.0 },
  });
  const leftShoot = shootOf(-1);
  const rightShoot = shootOf(1);

  const rightElbow = mix(
    mix(rightRun.elbow, rightDribble.elbow, hold),
    rightShoot.elbow,
    lift,
  );
  const rightHand = mix(
    mix(rightRun.hand, rightDribble.hand, hold),
    rightShoot.hand,
    lift,
  );

  const up = (joint: Joint): Joint => ({ ...joint, u: joint.u + jump });
  return {
    head: up({ f: shoulderF + 0.05, s: 0, u: HEAD_U }),
    neck: up({ f: shoulderF, s: 0, u: NECK_U }),
    leftShoulder: up(leftShoulder),
    rightShoulder: up(rightShoulder),
    leftElbow: up(mix(leftRun.elbow, leftShoot.elbow, lift)),
    rightElbow: up(rightElbow),
    leftHand: up(mix(leftRun.hand, leftShoot.hand, lift)),
    rightHand: up(rightHand),
    leftHip: up(left.hip),
    rightHip: up(right.hip),
    leftKnee: up(left.knee),
    rightKnee: up(right.knee),
    leftFoot: up(left.foot),
    rightFoot: up(right.foot),
  };
}
