/**
 * Full-court layer over the half-court replay (watch-court-frame.ts): works
 * out which end each team attacks and rotates every half-court point onto a
 * 94 × 50 ft court, so the Watch Game page can show both baskets like a TV
 * broadcast.
 *
 * Presentation only, a pure function of (view, revealed). The half-court
 * model stays the source of truth for formations, shot spots and rebounds;
 * this module only adds ends, the halftime switch and the ball's trip up the
 * floor. Inferred values come from `courtSeed`, never simulation RNG.
 *
 * Coordinates are normalized to the full court: x along the length (0 = left
 * baseline, 1 = right baseline over 94 ft), y across the width (0..1 over
 * 50 ft). The renderer chooses the on-screen orientation.
 */
import {
  COURT_FEET,
  buildCourtFrame,
  courtSeed,
  possessionGroups,
  type CourtFrame,
  type CourtPoint,
  type CourtPossession,
  type CourtShot,
} from "@/state/watch-court-frame";
import type { WatchGameView, WatchSide } from "@/state/watch-game-view";

/** Full-court geometry in feet. */
export const FULL_COURT_FEET = {
  length: COURT_FEET.length * 2,
  width: COURT_FEET.width,
} as const;

export type CourtEnd = "left" | "right";

/** Normalized full-court point (see module docs). */
export type FullCourtPoint = { x: number; y: number };

export type FullCourtShot = CourtShot & {
  /** End the shot was taken at; it never moves after a halftime switch. */
  end: CourtEnd;
};

/**
 * `CourtFrame` with every point (players, ball, last play, shots) on the full
 * court.
 */
export type FullCourtFrame = Omit<CourtFrame, "shots"> & {
  shots: FullCourtShot[];
  /** End the current offense attacks. */
  attackingEnd: CourtEnd;
  /**
   * Ball waypoints that bring the ball to the start of `lastPlay.path` from
   * the other end (or from centre court at tip-off): the previous ball spot,
   * the inbound spot after a make, a midcourt waypoint, then the first point
   * of the play. Null unless the latest play opens the game or a possession
   * at a different end from the previous one.
   */
  transition: FullCourtPoint[] | null;
};

/** Last period of the first half; ends switch after it (OT keeps the second-half ends). */
const FIRST_HALF_LAST_PERIOD = 2;

const SALT_TRANSITION = 7;
/** Midcourt waypoint spread either side of the middle (normalized width). */
const MIDCOURT_SPREAD = 0.3;

const CENTRE: FullCourtPoint = { x: 0.5, y: 0.5 };

/** Inbound spot after a make: on the baseline, just outside the lane (half court). */
const INBOUND: CourtPoint = {
  x: (COURT_FEET.hoopX + COURT_FEET.laneWidth / 2 + 1) / COURT_FEET.width,
  y: 0.5 / COURT_FEET.length,
};

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function samePoint(a: CourtPoint, b: CourtPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * End `side` attacks in `period`: home attacks left in the first half and
 * right from the third period on, overtime included; away the opposite.
 */
export function attackingEnd(side: WatchSide, period: number): CourtEnd {
  const homeEnd: CourtEnd = period <= FIRST_HALF_LAST_PERIOD ? "left" : "right";
  if (side === 0) {
    return homeEnd;
  }
  return homeEnd === "left" ? "right" : "left";
}

/**
 * Half-court point to the full court, for an offense attacking `end`. A
 * rotation (not a reflection), so handedness matches at both ends: the
 * half-court baseline lands on that end's baseline and the half-court line
 * on the centre line.
 */
export function toFullCourt(point: CourtPoint, end: CourtEnd): FullCourtPoint {
  const along = (point.y * COURT_FEET.length) / FULL_COURT_FEET.length;
  return end === "right"
    ? { x: round4(1 - along), y: round4(point.x) }
    : { x: round4(along), y: round4(1 - point.x) };
}

/**
 * The opening play's path on the full court, plus the trip that brings the
 * ball to it. `buildCourtFrame` starts an opening play's path at the
 * previous possession's ball spot; when that spot is at the other end the
 * leg moves into `transition` instead.
 */
function openingPlay(
  view: WatchGameView,
  groups: CourtPossession[],
  possessionIndex: number,
  halfPath: CourtPoint[],
  end: CourtEnd,
): { path: FullCourtPoint[]; transition: FullCourtPoint[] | null } {
  if (possessionIndex === 0) {
    const path = halfPath.map((point) => toFullCourt(point, end));
    return { path, transition: [CENTRE, path[0]!] };
  }
  const previous = groups[possessionIndex - 1]!;
  const previousEnd = attackingEnd(previous.offenseSide, previous.period);
  if (previousEnd === end) {
    return {
      path: halfPath.map((point) => toFullCourt(point, end)),
      transition: null,
    };
  }
  const leftAt = buildCourtFrame(view, previous.end).ball.at;
  const own =
    halfPath.length > 1 && samePoint(halfPath[0]!, leftAt)
      ? halfPath.slice(1)
      : halfPath;
  const path = own.map((point) => toFullCourt(point, end));
  const made = view.plays[previous.end - 1]!.points > 0;
  const seed = courtSeed(
    view.gameId,
    groups[possessionIndex]!.start,
    SALT_TRANSITION,
  );
  const midcourt: FullCourtPoint = {
    x: CENTRE.x,
    y: round4(CENTRE.y + (seed / 4294967296 - 0.5) * 2 * MIDCOURT_SPREAD),
  };
  return {
    path,
    transition: [
      toFullCourt(leftAt, previousEnd),
      ...(made ? [toFullCourt(INBOUND, previousEnd)] : []),
      midcourt,
      path[0]!,
    ],
  };
}

/** Full-court state after the first `revealed` plays. Pure and deterministic. */
export function buildFullCourtFrame(
  view: WatchGameView,
  revealed: number,
): FullCourtFrame {
  const base = buildCourtFrame(view, revealed);
  const groups = possessionGroups(view);
  const group = groups[Math.max(0, base.possessionIndex)];
  const end = attackingEnd(base.offenseSide, group?.period ?? 1);
  const toEnd = (point: CourtPoint) => toFullCourt(point, end);
  // Before the first play the ball waits at centre court for the tip.
  const beforeTip = base.possessionIndex < 0;

  let lastPlay = base.lastPlay;
  let transition: FullCourtPoint[] | null = null;
  if (lastPlay) {
    let path = lastPlay.path.map(toEnd);
    if (beforeTip) {
      path = [CENTRE];
    } else if (group && lastPlay.index === group.start) {
      const opening = openingPlay(
        view,
        groups,
        base.possessionIndex,
        lastPlay.path,
        end,
      );
      path = opening.path;
      transition = opening.transition;
    }
    lastPlay = {
      ...lastPlay,
      path,
      cut: lastPlay.cut ? toEnd(lastPlay.cut) : null,
    };
  }

  const players = base.players.map((player) => ({
    ...player,
    spot: toEnd(player.spot),
    role:
      beforeTip && player.role === "handler"
        ? ("off-ball" as const)
        : player.role,
  }));

  const shots = base.shots.map((shot) => {
    const shotEnd = attackingEnd(shot.side, view.plays[shot.index]!.period);
    return { ...shot, at: toFullCourt(shot.at, shotEnd), end: shotEnd };
  });

  return {
    ...base,
    players,
    ball: beforeTip
      ? { at: CENTRE, holderId: null }
      : { at: toEnd(base.ball.at), holderId: base.ball.holderId },
    lastPlay,
    shots,
    attackingEnd: end,
    transition,
  };
}
