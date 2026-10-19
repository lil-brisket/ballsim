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
  courtLabels,
  courtSeed,
  possessionGroups,
  type CourtFrame,
  type CourtPoint,
  type CourtPossession,
  type CourtShot,
} from "@/state/watch-court-frame";
import type { PlayerId } from "@/domain/ids";
import { pickJumper } from "@/state/watch-jump-ball";
import type {
  WatchGameView,
  WatchPlayKind,
  WatchSide,
} from "@/state/watch-game-view";

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
 * How a possession's opening play restarts the ball, inferred from the log
 * (it has no jump-ball or inbound rows):
 * - `tip`: the jump ball at centre court that opens the game.
 * - `baseline`: the inbound from the backcourt baseline that opens a period.
 * - `sideline`: the dead-ball inbound after a foul or an out-of-bounds
 *   turnover, on the sideline nearest the ball.
 * A baseline inbound after a made basket is not listed here: it is the
 * second waypoint of `transition`.
 */
export type RestartKind = "tip" | "baseline" | "sideline";

export type FullCourtRestart = { kind: RestartKind; at: FullCourtPoint };

/**
 * `CourtFrame` with every point (players, ball, last play, shots) on the full
 * court.
 */
export type FullCourtFrame = Omit<CourtFrame, "shots"> & {
  shots: FullCourtShot[];
  /** End the current offense attacks. */
  attackingEnd: CourtEnd;
  /**
   * End the team with the next possession (`ballSide`) will attack, in that
   * possession's period; null once the game is over.
   */
  ballEnd: CourtEnd | null;
  /**
   * Ball waypoints that bring the ball to the start of `lastPlay.path` from
   * the other end (or from centre court at tip-off): the previous ball spot,
   * the inbound spot after a make, a midcourt waypoint, then the first point
   * of the play. Null unless the latest play opens the game or a possession
   * at a different end from the previous one.
   */
  transition: FullCourtPoint[] | null;
  /**
   * Where the latest play's possession restarts the ball (see RestartKind);
   * null unless the latest play opens a possession that restarts that way.
   * When `transition` also exists its inbound waypoint is this point.
   */
  restart: FullCourtRestart | null;
  /**
   * Every roster player not on the floor, seated on the benches above the top
   * sideline (y < 0; see `BENCH_LAYOUT`). Ordered home then away, by seat.
   */
  bench: FullCourtBenchPlayer[];
  /**
   * Rows of seats the benches need over the whole game (at least 1): the same
   * for every frame of a game, so the court can reserve the space once.
   */
  benchRows: number;
};

/** A player on a bench seat. `spot` is a full-court point with y < 0. */
export type FullCourtBenchPlayer = {
  playerId: PlayerId;
  side: WatchSide;
  spot: FullCourtPoint;
  label: string;
  fullName: string;
  shortName: string;
};

/**
 * Bench geometry. Spots live above the top sideline (y < 0, in floor heights),
 * home on the left half and away on the right, `perRow` seats a row with
 * further rows stacked upward. A phone-width floor is about 160 px tall, so
 * these y values keep tokens clear of each other there.
 */
export const BENCH_LAYOUT = {
  perRow: 5,
  /** x of seat column 0 for each side, and the gap between columns. */
  firstX: [0.05, 0.55] as const,
  columnGap: 0.1,
  /** y of the row nearest the court, and the step to each further row. */
  firstRowY: -0.1,
  rowGap: 0.17,
} as const;

/**
 * Pixels the "<team> bench" captions take above the top row's centres. The
 * seats scale with the floor but the tokens and text do not, so the caption
 * strip is sized in pixels rather than floor heights.
 */
export const BENCH_CAPTION_PX = 36;

/**
 * A floor at least this wide (px) seats each bench in one row of ten, close
 * to the sideline, instead of stacking rows of five.
 */
export const WIDE_BENCH_MIN_PX = 640;

export const WIDE_BENCH_LAYOUT = {
  perRow: 10,
  firstX: [0.03, 0.53] as const,
  columnGap: 0.044,
  firstRowY: -0.07,
  rowGap: 0.1,
} as const;

/** y (floor heights, negative) of the top row of seats for `rows` rows. */
export function benchTopRowY(rows: number, wide = false): number {
  if (wide) {
    const wideRows = Math.ceil(
      (Math.max(1, rows) * BENCH_LAYOUT.perRow) / WIDE_BENCH_LAYOUT.perRow,
    );
    return (
      WIDE_BENCH_LAYOUT.firstRowY - (wideRows - 1) * WIDE_BENCH_LAYOUT.rowGap
    );
  }
  return BENCH_LAYOUT.firstRowY - (Math.max(1, rows) - 1) * BENCH_LAYOUT.rowGap;
}

/**
 * The same bench seat on a wide floor: a frame's bench spot (y < 0, laid out
 * by `BENCH_LAYOUT`) moved to `WIDE_BENCH_LAYOUT`. Floor points pass through,
 * so a walk between the bench and the floor can be mapped point by point.
 */
export function wideBenchPoint(point: FullCourtPoint): FullCourtPoint {
  if (point.y >= 0) {
    return point;
  }
  const side = point.x < 0.5 ? 0 : 1;
  const column = Math.round(
    (point.x - BENCH_LAYOUT.firstX[side]) / BENCH_LAYOUT.columnGap,
  );
  const row = Math.round(
    (BENCH_LAYOUT.firstRowY - point.y) / BENCH_LAYOUT.rowGap,
  );
  const seat = row * BENCH_LAYOUT.perRow + column;
  return {
    x: round4(
      WIDE_BENCH_LAYOUT.firstX[side] +
        (seat % WIDE_BENCH_LAYOUT.perRow) * WIDE_BENCH_LAYOUT.columnGap,
    ),
    y: round4(
      WIDE_BENCH_LAYOUT.firstRowY -
        Math.floor(seat / WIDE_BENCH_LAYOUT.perRow) * WIDE_BENCH_LAYOUT.rowGap,
    ),
  };
}

/** Last period of the first half; ends switch after it (OT keeps the second-half ends). */
const FIRST_HALF_LAST_PERIOD = 2;

const SALT_TRANSITION = 7;
/** Midcourt waypoint spread either side of the middle (normalized width). */
const MIDCOURT_SPREAD = 0.3;

const CENTRE: FullCourtPoint = { x: 0.5, y: 0.5 };

/** Jump-ball formation: jumpers this far either side of the centre dot. */
const JUMPER_GAP_FEET = 1.6;
/**
 * The other eight stand on a ring 6 ft outside the 6 ft circle: wider than
 * on a real floor, so the tokens stay apart on a phone-width court.
 */
const JUMP_RING_FEET = 12;
/** Ring angles off a team's own axis (degrees), in lineup order. */
const JUMP_RING_DEGREES = [-72, -26, 26, 72] as const;

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

const newEndCache = new WeakMap<WatchGameView, Set<number>>();
const restartCache = new WeakMap<WatchGameView, Map<number, RestartKind>>();

/** Whistles: the ball is dead where the play stopped and is inbounded. */
const WHISTLE_KINDS = new Set<WatchPlayKind>([
  "shooting_foul",
  "personal_foul",
  "offensive_foul",
]);

/**
 * True when the ball is dead after `play` and goes back in from the sideline:
 * a foul with no free throws after it, or a turnover with no stealer (out of
 * bounds or a violation).
 */
function endsOnDeadBall(play: {
  kind: WatchPlayKind;
  player2Id: unknown;
}): boolean {
  return (
    WHISTLE_KINDS.has(play.kind) ||
    (play.kind === "turnover" && play.player2Id === null)
  );
}

/**
 * How the possession starting at play `index` restarts the ball, or null for
 * a live-ball start (steal, defensive rebound) or a baseline inbound after a
 * make. A period start always inbounds from the baseline; the game opens
 * with a tip.
 */
export function restartKindAt(
  view: WatchGameView,
  index: number,
): RestartKind | null {
  let kinds = restartCache.get(view);
  if (!kinds) {
    kinds = new Map<number, RestartKind>();
    const groups = possessionGroups(view);
    groups.forEach((group, i) => {
      const previous = groups[i - 1];
      if (!previous) {
        kinds!.set(group.start, "tip");
      } else if (previous.period !== group.period) {
        kinds!.set(group.start, "baseline");
      } else if (endsOnDeadBall(view.plays[previous.end - 1]!)) {
        kinds!.set(group.start, "sideline");
      }
    });
    restartCache.set(view, kinds);
  }
  return kinds.get(index) ?? null;
}

/**
 * True when play `index` opens the game, a period or a possession at a
 * different end from the previous one, i.e. its frame carries a `transition`
 * (the ball travels up the floor before the play). Playback pacing uses it.
 */
export function opensAtNewEnd(view: WatchGameView, index: number): boolean {
  let starts = newEndCache.get(view);
  if (!starts) {
    starts = new Set<number>();
    const groups = possessionGroups(view);
    groups.forEach((group, i) => {
      const previous = groups[i - 1];
      if (
        !previous ||
        previous.period !== group.period ||
        attackingEnd(previous.offenseSide, previous.period) !==
          attackingEnd(group.offenseSide, group.period)
      ) {
        starts!.add(group.start);
      }
    });
    newEndCache.set(view, starts);
  }
  return starts.has(index);
}

/** Sideline point nearest a dead ball: its x, on the closer side line. */
function sidelineSpot(ball: FullCourtPoint): FullCourtPoint {
  return {
    x: round4(Math.min(0.98, Math.max(0.02, ball.x))),
    y: ball.y < 0.5 ? 0 : 1,
  };
}

/**
 * The opening play's path on the full court, plus the trip that brings the
 * ball to it and how the possession restarts. `buildCourtFrame` starts an
 * opening play's path at the previous possession's ball spot; when the
 * possession opens a period or at the other end the leg moves into
 * `transition` instead.
 */
function openingPlay(
  view: WatchGameView,
  groups: CourtPossession[],
  possessionIndex: number,
  halfPath: CourtPoint[],
  end: CourtEnd,
): {
  path: FullCourtPoint[];
  transition: FullCourtPoint[] | null;
  restart: FullCourtRestart | null;
} {
  const group = groups[possessionIndex]!;
  const kind = restartKindAt(view, group.start);
  if (possessionIndex === 0) {
    const path = halfPath.map((point) => toFullCourt(point, end));
    return {
      path,
      transition: [CENTRE, path[0]!],
      restart: { kind: "tip", at: CENTRE },
    };
  }
  const previous = groups[possessionIndex - 1]!;
  const previousEnd = attackingEnd(previous.offenseSide, previous.period);
  const leftAt = buildCourtFrame(view, previous.end).ball.at;
  const leftFull = toFullCourt(leftAt, previousEnd);
  const sideline = kind === "sideline" ? sidelineSpot(leftFull) : null;
  if (previousEnd === end && kind !== "baseline") {
    return {
      path: halfPath.map((point) => toFullCourt(point, end)),
      transition: null,
      restart: sideline ? { kind: "sideline", at: sideline } : null,
    };
  }
  const own =
    halfPath.length > 1 && samePoint(halfPath[0]!, leftAt)
      ? halfPath.slice(1)
      : halfPath;
  const path = own.map((point) => toFullCourt(point, end));
  const made = view.plays[previous.end - 1]!.points > 0;
  const seed = courtSeed(view.gameId, group.start, SALT_TRANSITION);
  const midcourt: FullCourtPoint = {
    x: CENTRE.x,
    y: round4(CENTRE.y + (seed / 4294967296 - 0.5) * 2 * MIDCOURT_SPREAD),
  };
  // A period opens with an inbound from the baseline of the end the team
  // defends; after a make the ball goes in under the basket just scored on.
  const defendedEnd: CourtEnd = end === "left" ? "right" : "left";
  const baseline =
    kind === "baseline" ? toFullCourt(INBOUND, defendedEnd) : null;
  const inbound =
    sideline ?? baseline ?? (made ? toFullCourt(INBOUND, previousEnd) : null);
  const restart: FullCourtRestart | null = sideline
    ? { kind: "sideline", at: sideline }
    : baseline
      ? { kind: "baseline", at: baseline }
      : null;
  return {
    path,
    transition: [leftFull, ...(inbound ? [inbound] : []), midcourt, path[0]!],
    restart,
  };
}

/**
 * Jump-ball formation: the two jumpers face off at the centre dot and the
 * other eight stand on a ring just outside the circle, each team on the half
 * it defends. Lineup order picks ring places.
 */
function jumpFormation(
  view: WatchGameView,
  players: { playerId: PlayerId; side: WatchSide }[],
): Map<PlayerId, FullCourtPoint> {
  const L = FULL_COURT_FEET.length;
  const W = FULL_COURT_FEET.width;
  const spots = new Map<PlayerId, FullCourtPoint>();
  for (const side of [0, 1] as const) {
    const own = players.filter((p) => p.side === side).map((p) => p.playerId);
    const jumper = pickJumper(view, own);
    // A team attacking left defends the right half, so stands on the right.
    const dir = attackingEnd(side, 1) === "left" ? 1 : -1;
    own
      .filter((id) => id !== jumper)
      .forEach((id, i) => {
        const degrees =
          JUMP_RING_DEGREES[Math.min(i, JUMP_RING_DEGREES.length - 1)]!;
        const angle = (degrees * Math.PI) / 180;
        spots.set(id, {
          x: round4((L / 2 + dir * JUMP_RING_FEET * Math.cos(angle)) / L),
          y: round4((W / 2 + JUMP_RING_FEET * Math.sin(angle)) / W),
        });
      });
    if (jumper !== null) {
      spots.set(jumper, {
        x: round4((L / 2 + dir * JUMPER_GAP_FEET) / L),
        y: 0.5,
      });
    }
  }
  return spots;
}

const benchRowsCache = new WeakMap<WatchGameView, number>();

/**
 * Bench seats after the first `revealed` plays, replaying the substitution
 * rows in log order like `lineupAt`. At the start the non-starters take
 * seats 0, 1, 2, ... in roster order. A substitution puts the outgoing player
 * in the seat the incoming player just left, so seats stay compact (a side
 * never uses more than roster - 5 of them) and a walk crosses naturally. A
 * player leaving with nobody coming in takes the lowest free seat. `maxSeat`
 * is the highest seat in use at any point of the replay.
 */
function benchSeats(
  view: WatchGameView,
  revealed: number,
): { seats: Map<PlayerId, number>; maxSeat: number } {
  const seats = new Map<PlayerId, number>();
  const used = [new Set<number>(), new Set<number>()];
  let maxSeat = 0;
  const sideOf = new Map(view.players.map((p) => [p.playerId, p.side]));
  const lowestFree = (side: WatchSide) => {
    let seat = 0;
    while (used[side]!.has(seat)) {
      seat += 1;
    }
    return seat;
  };
  const seat = (id: PlayerId, side: WatchSide, at: number) => {
    seats.set(id, at);
    used[side]!.add(at);
    maxSeat = Math.max(maxSeat, at);
  };
  for (const side of [0, 1] as const) {
    view.players
      .filter((p) => p.side === side && !p.started)
      .forEach((p) => seat(p.playerId, side, lowestFree(side)));
  }
  const count = Math.min(Math.max(0, Math.floor(revealed)), view.plays.length);
  for (let i = 0; i < count; i += 1) {
    const play = view.plays[i]!;
    const side = sideOf.get(play.playerId);
    if (play.kind !== "substitution" || side === undefined) {
      continue;
    }
    const inSeat =
      play.player2Id === null ? undefined : seats.get(play.player2Id);
    if (play.player2Id !== null && inSeat !== undefined) {
      seats.delete(play.player2Id);
      used[side]!.delete(inSeat);
    }
    if (!seats.has(play.playerId)) {
      seat(play.playerId, side, inSeat ?? lowestFree(side));
    }
  }
  return { seats, maxSeat };
}

/** Rows of seats the benches need at their fullest during the game (at least 1). */
function benchRows(view: WatchGameView): number {
  let rows = benchRowsCache.get(view);
  if (rows === undefined) {
    rows =
      Math.floor(
        benchSeats(view, view.plays.length).maxSeat / BENCH_LAYOUT.perRow,
      ) + 1;
    benchRowsCache.set(view, rows);
  }
  return rows;
}

/** Full-court point of bench seat `seat` for `side`. */
function benchSpot(side: WatchSide, seat: number): FullCourtPoint {
  const column = seat % BENCH_LAYOUT.perRow;
  const row = Math.floor(seat / BENCH_LAYOUT.perRow);
  return {
    x: round4(BENCH_LAYOUT.firstX[side] + column * BENCH_LAYOUT.columnGap),
    y: round4(BENCH_LAYOUT.firstRowY - row * BENCH_LAYOUT.rowGap),
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
  let restart: FullCourtRestart | null = null;
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
      restart = opening.restart;
    }
    lastPlay = {
      ...lastPlay,
      path,
      cut: lastPlay.cut ? toEnd(lastPlay.cut) : null,
    };
  }

  // Before the tip the teams stand in the jump-ball formation.
  const jump = beforeTip ? jumpFormation(view, base.players) : null;
  const players = base.players.map((player) => ({
    ...player,
    spot: jump?.get(player.playerId) ?? toEnd(player.spot),
    role:
      beforeTip && player.role === "handler"
        ? ("off-ball" as const)
        : player.role,
  }));

  const shots = base.shots.map((shot) => {
    const shotEnd = attackingEnd(shot.side, view.plays[shot.index]!.period);
    return { ...shot, at: toFullCourt(shot.at, shotEnd), end: shotEnd };
  });

  const next = groups.find((g) => g.end > base.revealed);

  const { seats } = benchSeats(view, base.revealed);
  const onFloor = new Set(players.map((p) => p.playerId));
  const labels = courtLabels(view);
  const bench: FullCourtBenchPlayer[] = view.players
    .filter((p) => !onFloor.has(p.playerId))
    .map((p) => ({
      playerId: p.playerId,
      side: p.side,
      spot: benchSpot(p.side, seats.get(p.playerId) ?? 0),
      label: labels.get(p.playerId) ?? p.shortName,
      fullName: p.fullName,
      shortName: p.shortName,
    }))
    .sort(
      (a, b) =>
        a.side - b.side ||
        (seats.get(a.playerId) ?? 0) - (seats.get(b.playerId) ?? 0),
    );

  return {
    ...base,
    players,
    ball: beforeTip
      ? { at: CENTRE, holderId: null }
      : { at: toEnd(base.ball.at), holderId: base.ball.holderId },
    lastPlay,
    shots,
    attackingEnd: end,
    ballEnd: next ? attackingEnd(next.offenseSide, next.period) : null,
    transition,
    restart,
    bench,
    benchRows: benchRows(view),
  };
}
