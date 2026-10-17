import { FULL_COURT_FEET, type CourtEnd } from "@/state/watch-full-court";

/**
 * Broadcast camera for the full court: a pure function of the frame's
 * attacking end and the viewer's chosen view, applied as CSS transforms on
 * one stage element. No per-frame state; the pan is a CSS transition.
 */

/** Broadcast: tilted sideline camera that follows the play. Top-down: flat, whole floor. */
export type CourtCameraView = "broadcast" | "top-down";

/** Feet of floor the follow camera shows: the attacking half plus some backcourt. */
export const FOLLOW_FEET = 60;

/** Follow framing on phones: a little past half court, so tokens keep room. */
export const COMPACT_FOLLOW_FEET = 50;

/** Sideline-camera tilt in Broadcast, in degrees. */
export const BROADCAST_TILT_DEG = 22;

export type CourtCamera = {
  framing: "follow" | "wide";
  /** Viewport `aspect-ratio` (width / height in feet). */
  aspect: string;
  /** Stage width as a percentage of the viewport (the stage holds the whole floor). */
  stageWidth: string;
  /**
   * Pan and zoom of the stage, origin top left. Always `translate(..) scale(..)`
   * so a change of framing interpolates as one smooth move.
   */
  transform: string;
  /** Floor tilt in degrees; 0 is flat. */
  tilt: number;
  /**
   * Stage `perspective-origin`: the middle of the floor on screen, so the
   * tilt reads straight on rather than leaning toward the stage centre.
   */
  perspectiveOrigin: string;
};

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Camera for `view`. Broadcast follows the attacking end (`wide` frames the
 * whole floor inside the same viewport, for breaks and the final); Top-down
 * always shows the whole floor flat. `compact` (phone widths) follows tighter.
 */
export function courtCamera(
  view: CourtCameraView,
  end: CourtEnd,
  wide = false,
  compact = false,
): CourtCamera {
  const { length, width } = FULL_COURT_FEET;
  const follow = compact ? COMPACT_FOLLOW_FEET : FOLLOW_FEET;
  if (view === "top-down") {
    return {
      framing: "wide",
      aspect: `${length} / ${width}`,
      stageWidth: "100%",
      transform: "translate(0%, 0%) scale(1)",
      tilt: 0,
      perspectiveOrigin: "50% 50%",
    };
  }
  const aspect = `${follow} / ${width}`;
  const stageWidth = `${round((length / follow) * 100)}%`;
  if (wide) {
    // Shrink the floor to the viewport width and centre it vertically.
    const scale = follow / length;
    return {
      framing: "wide",
      aspect,
      stageWidth,
      transform: `translate(0%, ${round(((1 - scale) / 2) * 100)}%) scale(${round(scale)})`,
      tilt: BROADCAST_TILT_DEG,
      perspectiveOrigin: "50% 50%",
    };
  }
  const offset = end === "left" ? 0 : (length - follow) / length;
  return {
    framing: "follow",
    aspect,
    stageWidth,
    transform: `translate(${round(-offset * 100)}%, 0%) scale(1)`,
    tilt: BROADCAST_TILT_DEG,
    perspectiveOrigin: `${round((offset + follow / 2 / length) * 100)}% 50%`,
  };
}
