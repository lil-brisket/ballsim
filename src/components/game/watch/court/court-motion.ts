import type { PlayerId } from "@/domain/ids";
import type { CourtLastPlay, CourtPoint } from "@/state/watch-court-frame";

/** Shooter cut on a catch-and-shoot, at 1x. */
export const CUT_MS = 500;

export const pct = (value: number): string =>
  `${Math.round(value * 10000) / 100}%`;

function lerpPoint(a: CourtPoint, b: CourtPoint, t: number): CourtPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Web Animations keyframes for the ball's latest play, or null when it did
 * not move. Shots and free throws arc over the final leg (a scale and lift
 * bump fakes height), rebounds drop from the rim, everything else is a
 * straight leg per waypoint pair.
 */
export function ballMotion(
  play: CourtLastPlay,
): { keyframes: Keyframe[]; duration: number } | null {
  const path = play.path;
  if (path.length < 2) {
    return null;
  }
  const legs = path.length - 1;
  type Sample = { at: CourtPoint; lift: number; scale: number };
  const samples: Sample[] = [{ at: path[0]!, lift: 0, scale: 1 }];
  const arc = play.motion === "shot" || play.motion === "free_throw";
  const drop = play.motion === "rebound";
  for (let leg = 0; leg < legs; leg += 1) {
    const from = path[leg]!;
    const to = path[leg + 1]!;
    const curved = arc && leg === legs - 1;
    const steps = curved || drop ? 8 : 1;
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const bump = Math.sin(Math.PI * t);
      samples.push({
        at: lerpPoint(from, to, t),
        lift: curved ? 16 * bump : drop ? 14 * (1 - t) : 0,
        scale: curved ? 1 + 0.9 * bump : drop ? 1 + 0.8 * (1 - t) : 1,
      });
    }
  }
  const keyframes: Keyframe[] = samples.map((sample, i) => ({
    left: pct(sample.at.x),
    top: pct(sample.at.y),
    transform: `translateY(${-sample.lift}px) scale(${sample.scale})`,
    offset: i / (samples.length - 1),
  }));
  const duration = arc ? 200 * (legs - 1) + 700 : drop ? 500 : 250 * legs + 150;
  return { keyframes, duration };
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
