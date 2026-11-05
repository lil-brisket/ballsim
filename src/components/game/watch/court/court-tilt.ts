/**
 * The tilted broadcast camera. The floor is tilted back around its near
 * sideline; everything standing on it stays upright and is placed through
 * `tiltPoint`, which is the same projection the floor's CSS transform makes.
 * Near sideline stays full width; the far sideline recedes and narrows, leaving
 * room above it for the benches.
 */
import { FULL_COURT_FEET, type FullCourtPoint } from "@/state/watch-full-court";

const ANGLE_DEG = 50;
/** Camera distance, in floor widths. Smaller means stronger perspective. */
const DISTANCE = 1.6;
/** Floor height as a share of its width. */
const FLOOR_ASPECT = FULL_COURT_FEET.width / FULL_COURT_FEET.length;

const ANGLE = (ANGLE_DEG * Math.PI) / 180;

/** How much a circle on the floor flattens as seen by the camera. */
export const TILT_SQUASH = Math.cos(ANGLE);
/** How much of a height shows on screen from this angle. */
export const TILT_RAISE = Math.sin(ANGLE);
/** Regulation rim height. */
export const RIM_HEIGHT_FT = 10;
/**
 * Benches sit further back than on the overhead floor: the angle foreshortens
 * the gap, and a seat must clear the far sideline.
 */
export const TILT_BENCH_PUSH = 2.2;

export type TiltedPoint = FullCourtPoint & {
  /** Size at this depth; 1 on the near sideline. */
  scale: number;
};

/** Where a floor point lands, as fractions of the same box the floor fills. */
export function tiltPoint(point: FullCourtPoint): TiltedPoint {
  const back = 1 - point.y;
  const scale = DISTANCE / (DISTANCE + back * FLOOR_ASPECT * Math.sin(ANGLE));
  return {
    x: 0.5 + (point.x - 0.5) * scale,
    y: 1 - back * Math.cos(ANGLE) * scale,
    scale,
  };
}

/** Where a point `feet` above a floor point lands. */
export function tiltRaised(point: FullCourtPoint, feet: number): TiltedPoint {
  const floor = tiltPoint(point);
  return {
    ...floor,
    y: floor.y - (feet * TILT_RAISE * floor.scale) / FULL_COURT_FEET.width,
  };
}

const hundredths = (value: number) => Math.round(value * 10000) / 100;

/** Transform placing a zero-size layer at a floor point, sized for its depth. */
export function tiltTranslate(point: FullCourtPoint): string {
  const { x, y, scale } = tiltPoint(point);
  return `translate(${hundredths(x)}cqw, ${hundredths(y)}cqh) scale(${
    Math.round(scale * 1000) / 1000
  })`;
}

/** Transform for the floor itself; use with `TILT_ORIGIN`. */
export function tiltFloorTransform(floorWidthPx: number): string {
  return `perspective(${Math.round(floorWidthPx * DISTANCE)}px) rotateX(${ANGLE_DEG}deg)`;
}

export const TILT_ORIGIN = "50% 100%";
