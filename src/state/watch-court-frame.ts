/**
 * Court replay frame for the Watch Game page: a pure function of
 * (view, revealed) that places the on-court players, the ball and the latest
 * play's ball path on a half court.
 *
 * Presentation only. The play-by-play log has no coordinates, zones or
 * matchups, so every location here is invented deterministically from
 * `gameId + play index` (a small string hash, never simulation RNG, never
 * Math.random). Players hold fixed formation slots that flip with possession;
 * only the shooter, rebounder and the defender making a play leave their
 * slot. Nothing here is stored or fed back into the game.
 *
 * Coordinates are normalized to a half court: x across the court (0..1 over
 * 50 ft), y from the baseline (0) to the half-court line (1 over 47 ft), so
 * the basket is at the top. The renderer chooses the on-screen orientation.
 */
import type { PlayerId } from "@/domain/ids";
import {
  START_PERIOD_CLOCK_SECONDS,
  clampRevealed,
  lineupAt,
} from "@/state/watch-game-selectors";
import type {
  WatchGameView,
  WatchPlay,
  WatchPlayKind,
  WatchSide,
} from "@/state/watch-game-view";

/** Half-court geometry in feet (baseline at y = 0). */
export const COURT_FEET = {
  width: 50,
  length: 47,
  hoopX: 25,
  hoopY: 5.25,
  rimRadius: 0.75,
  backboardY: 4,
  laneWidth: 16,
  laneLength: 19,
  freeThrowY: 19,
  freeThrowCircleRadius: 6,
  restrictedRadius: 4,
  threeRadius: 23.75,
  cornerThreeX: 22,
  /** Where the corner three straight line meets the arc. */
  cornerThreeY: 5.25 + Math.sqrt(23.75 ** 2 - 22 ** 2),
} as const;

/** Normalized half-court point (see module docs). */
export type CourtPoint = { x: number; y: number };

export type CourtRole = "handler" | "shooter" | "off-ball";

export type CourtPlayer = {
  playerId: PlayerId;
  side: WatchSide;
  /** Token label: last name, or "J. Smith" when teammates share it. */
  label: string;
  shortName: string;
  fullName: string;
  /** Formation slot 0..4 (stable across substitutions). */
  slot: number;
  onOffense: boolean;
  spot: CourtPoint;
  role: CourtRole;
};

export type CourtBall = { at: CourtPoint; holderId: PlayerId | null };

export type CourtMotion =
  "shot" | "free_throw" | "rebound" | "turnover" | "foul" | "substitution";

export type CourtOutcome = "made" | "missed" | "blocked" | "stolen" | "none";

export type CourtLastPlay = {
  index: number;
  kind: WatchPlayKind;
  motion: CourtMotion;
  outcome: CourtOutcome;
  playerId: PlayerId;
  player2Id: PlayerId | null;
  points: number;
  /**
   * Ball waypoints for this play. The first point is where the ball was
   * before it (the previous frame's ball), the last is `CourtFrame.ball.at`.
   * One point means the ball did not move (whistle, substitution).
   */
  path: CourtPoint[];
  /**
   * Waypoint the shooter cuts through on the way to an assisted shot (from
   * their previous spot to their shot spot); null for every other play.
   */
  cut: CourtPoint | null;
  /**
   * Steals only: the teammate the handler was passing to when the stealer
   * stepped into the lane (the stealer ends on the line between them).
   */
  receiverId?: PlayerId;
};

export type CourtShot = {
  index: number;
  side: WatchSide;
  playerId: PlayerId;
  at: CourtPoint;
  made: boolean;
  three: boolean;
};

export type CourtFrame = {
  revealed: number;
  total: number;
  isFinal: boolean;
  period: number;
  /** Seconds left in the period at the start of the current possession. */
  clock: number;
  /** Dense 0-based index into possessionGroups(view); -1 before the first. */
  possessionIndex: number;
  /** Team attacking the basket in the current possession. */
  offenseSide: WatchSide;
  /** Team that has the next possession; null once the game is over. */
  ballSide: WatchSide | null;
  /** Home slots then away slots. */
  players: CourtPlayer[];
  ball: CourtBall;
  /** Most recently revealed play; null at tip-off. */
  lastPlay: CourtLastPlay | null;
  /** Field-goal attempts revealed so far (shot-chart layer). */
  shots: CourtShot[];
  /**
   * The run of substitutions ending at the latest revealed play (one
   * checkpoint can swap several players); empty unless the latest play is a
   * substitution.
   */
  substitutions: CourtSubstitution[];
};

export type CourtSubstitution = {
  index: number;
  side: WatchSide;
  outId: PlayerId;
  inId: PlayerId;
};

/**
 * One feed-row possession: consecutive non-substitution plays sharing
 * (period, poss). `end` is exclusive.
 */
export type CourtPossession = {
  start: number;
  end: number;
  period: number;
  offenseSide: WatchSide;
};

type Feet = { x: number; y: number };

const HOOP_X = COURT_FEET.hoopX;
const HOOP: Feet = { x: COURT_FEET.hoopX, y: COURT_FEET.hoopY };
const FREE_THROW_SPOT: Feet = { x: COURT_FEET.hoopX, y: COURT_FEET.freeThrowY };

/** Offense slots: top, left wing, right wing, left corner, right dunker. */
const OFFENSE_BASE: readonly Feet[] = [
  { x: 25, y: 31 },
  { x: 7.5, y: 22.5 },
  { x: 42.5, y: 22.5 },
  { x: 2.5, y: 5 },
  { x: 31.5, y: 8 },
];
const SLOT_COUNT = OFFENSE_BASE.length;
const FORMATION_JITTER_FEET = 1.5;
const DEFENSE_JITTER_FEET = 1;
/** Defenders sit this fraction of the way from their man to the basket. */
export const DEFENSE_SHADE = 0.3;
/** A teammate this close to a player's new spot swaps into the old one. */
const SWAP_RADIUS_FEET = 3;

const SALT_SHOT = 1;
const SALT_OFFENSE = 2;
const SALT_DEFENSE = 3;
const SALT_REBOUND = 4;
const SALT_DRIFT = 5;
const SALT_CUT = 6;
const SALT_BLOCK = 10;
const SALT_STEAL = 11;

/**
 * Richer movement (court replay phase 5). Set either to 0 to turn it off:
 * off-ball players drift up to this far from their spot each play, and an
 * assisted shooter cuts this far off the straight line to the shot spot.
 */
const OFF_BALL_DRIFT_FEET = 1.2;
const DEFENSE_DRIFT_SCALE = 0.6;
const SHOOTER_CUT_FEET = 4;
const MIN_CUT_LENGTH_FEET = 3;
const COURT_MARGIN_FEET = 0.5;
const AND_ONE_GAP_FEET = 3;
/** A blocker ends this far from the shooter, toward the rim. */
const BLOCKER_GAP_FEET = 3.5;
/** A blocked ball is swatted this far from the shot spot, away from the rim. */
const SWAT_MIN_FEET = 8;
const SWAT_RANGE_FEET = 6;
/** A swat must end at least this much farther from the rim, and from the shooter. */
const SWAT_MIN_GAIN_FEET = 1.5;
const SWAT_MIN_TRAVEL_FEET = 6;
/** A stealer cuts the handler's pass lane this far along it. */
const STEAL_LANE_MIN = 0.45;
const STEAL_LANE_RANGE = 0.2;

/**
 * Free-throw line-up (feet, half court). Lane spots sit just inside the lane
 * lines on three rows: the defense takes the two nearest the rim plus the
 * outer left one, the offense the two between. Everyone else waits behind
 * the arc (offense on the wings, defense on top).
 */
const LANE_SPOT_X = 7.4;
const LANE_ROWS = [8, 11.5, 15] as const;
const FT_ARC_RADIUS_FEET = 26;
const FT_ARC_OFFENSE_DEGREES = [25, 155, 45, 135] as const;
const FT_ARC_DEFENSE_DEGREES = [65, 115, 80, 100] as const;
const FT_LANE_DEFENSE: readonly Feet[] = [
  { x: HOOP_X - LANE_SPOT_X, y: LANE_ROWS[0] },
  { x: HOOP_X + LANE_SPOT_X, y: LANE_ROWS[0] },
  { x: HOOP_X - LANE_SPOT_X, y: LANE_ROWS[2] },
];
const FT_LANE_OFFENSE: readonly Feet[] = [
  { x: HOOP_X - LANE_SPOT_X, y: LANE_ROWS[1] },
  { x: HOOP_X + LANE_SPOT_X, y: LANE_ROWS[1] },
];

/**
 * Where everyone stands for a free throw. The shooter is at the line; the
 * rest take lane spots, then arc spots, in descending slot order (the slots
 * nearest the rim go to the lane). Deterministic.
 */
export function freeThrowLineup(
  players: readonly { playerId: PlayerId; side: WatchSide; slot: number }[],
  shooterId: PlayerId | null,
  shooterSide: WatchSide,
): Map<PlayerId, CourtPoint> {
  const spots = new Map<PlayerId, CourtPoint>();
  const arcAt = (degrees: number): Feet => {
    const angle = (degrees * Math.PI) / 180;
    return aroundHoop(FT_ARC_RADIUS_FEET, angle);
  };
  for (const side of [0, 1] as const) {
    const offense = side === shooterSide;
    const lane = offense ? FT_LANE_OFFENSE : FT_LANE_DEFENSE;
    const arc = offense ? FT_ARC_OFFENSE_DEGREES : FT_ARC_DEFENSE_DEGREES;
    const others = players
      .filter((p) => p.side === side && p.playerId !== shooterId)
      .sort((a, b) => (b.slot % SLOT_COUNT) - (a.slot % SLOT_COUNT));
    const laneCount = lane.length;
    others.forEach((player, i) => {
      const spot =
        i < laneCount
          ? lane[i]!
          : arcAt(arc[Math.min(i - laneCount, arc.length - 1)]!);
      spots.set(player.playerId, normalize(spot));
    });
  }
  if (shooterId !== null) {
    spots.set(shooterId, normalize(FREE_THROW_SPOT));
  }
  return spots;
}

/** FNV-1a hash of `gameId:index:salt` (uint32). Presentation seed only. */
export function courtSeed(gameId: string, index: number, salt = 0): number {
  const text = `${gameId}:${index}:${salt}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 stream in [0, 1) from a seed. */
function unitStream(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function normalize(point: Feet): CourtPoint {
  return {
    x: round4(point.x / COURT_FEET.width),
    y: round4(point.y / COURT_FEET.length),
  };
}

function aroundHoop(radius: number, angle: number): Feet {
  return {
    x: HOOP.x + radius * Math.cos(angle),
    y: HOOP.y + radius * Math.sin(angle),
  };
}

function lerp(a: Feet, b: Feet, t: number): Feet {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function distance(a: Feet, b: Feet): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function samePoint(a: Feet, b: Feet): boolean {
  return distance(a, b) < 1e-6;
}

function insideCourt(point: Feet): Feet {
  const clamp = (value: number, max: number) =>
    Math.min(max - COURT_MARGIN_FEET, Math.max(COURT_MARGIN_FEET, value));
  return {
    x: clamp(point.x, COURT_FEET.width),
    y: clamp(point.y, COURT_FEET.length),
  };
}

/**
 * Seeded waypoint off the straight line from `from` to `to` (a curl or a
 * flare); null when the shooter barely moves or cuts are turned off.
 */
function cutPoint(from: Feet, to: Feet, seed: number): Feet | null {
  const length = distance(from, to);
  if (SHOOTER_CUT_FEET <= 0 || length < MIN_CUT_LENGTH_FEET) {
    return null;
  }
  const next = unitStream(seed);
  const side = next() < 0.5 ? -1 : 1;
  const offset =
    side * Math.min(length / 2, SHOOTER_CUT_FEET * (0.5 + next() / 2));
  const mid = lerp(from, to, 0.35 + next() * 0.3);
  return insideCourt({
    x: mid.x + (-(to.y - from.y) / length) * offset,
    y: mid.y + ((to.x - from.x) / length) * offset,
  });
}

/** Fouler's spot on an and-one: a few feet to one side of the shooter. */
function besideShooter(shooter: Feet, seed: number): Feet {
  const length = distance(shooter, HOOP);
  const along =
    length < 1e-6
      ? { x: 1, y: 0 }
      : { x: (shooter.x - HOOP.x) / length, y: (shooter.y - HOOP.y) / length };
  const side = unitStream(seed)() < 0.5 ? -1 : 1;
  return insideCourt({
    x: shooter.x + -along.y * side * AND_ONE_GAP_FEET,
    y: shooter.y + along.x * side * AND_ONE_GAP_FEET,
  });
}

/** The blocker's spot: between the shooter and the rim, close to the shooter. */
function blockerSpotFeet(spot: Feet): Feet {
  const length = distance(spot, HOOP);
  const share =
    length < 1e-6
      ? 0.12
      : Math.min(0.8, Math.max(0.12, BLOCKER_GAP_FEET / length));
  return lerp(spot, HOOP, share);
}

/**
 * Where a blocked shot ends up: swatted 8-14 ft from the shot spot, outward
 * from the rim toward the perimeter or a sideline, kept in bounds. Tries the
 * seeded direction first, then its mirror and the sidelines, so a shot taken
 * near a wall still travels away from the rim.
 */
function deflectionFeet(spot: Feet, seed: number): Feet {
  const next = unitStream(seed);
  const travel = SWAT_MIN_FEET + next() * SWAT_RANGE_FEET;
  const side = next() < 0.5 ? -1 : 1;
  const swing = 0.35 + next() * 0.9;
  const outward =
    distance(spot, HOOP) < 1e-6
      ? Math.PI / 2
      : Math.atan2(spot.y - HOOP.y, spot.x - HOOP.x);
  const rimGap = distance(spot, HOOP);
  let best: { point: Feet; gain: number } | null = null;
  for (const turn of [
    side * swing,
    -side * swing,
    side * (Math.PI / 2),
    -side * (Math.PI / 2),
    0,
  ]) {
    const point = insideCourt({
      x: spot.x + Math.cos(outward + turn) * travel,
      y: spot.y + Math.sin(outward + turn) * travel,
    });
    const gain = distance(point, HOOP) - rimGap;
    if (
      gain >= SWAT_MIN_GAIN_FEET &&
      distance(point, spot) >= SWAT_MIN_TRAVEL_FEET
    ) {
      return point;
    }
    if (!best || gain > best.gain) {
      best = { point, gain };
    }
  }
  return best!.point;
}

function shotSpotFeet(kind: WatchPlayKind, seed: number): Feet {
  if (kind === "ft_made" || kind === "ft_missed") {
    return FREE_THROW_SPOT;
  }
  const next = unitStream(seed);
  if (kind === "three_made" || kind === "three_missed") {
    if (next() < 0.3) {
      const side = next() < 0.5 ? -1 : 1;
      return {
        x: HOOP.x + side * (COURT_FEET.cornerThreeX + 0.5 + next()),
        y: 1 + next() * (COURT_FEET.cornerThreeY - 2),
      };
    }
    const edge = Math.atan2(
      COURT_FEET.cornerThreeY - HOOP.y,
      COURT_FEET.cornerThreeX,
    );
    const angle = edge + next() * (Math.PI - 2 * edge);
    return aroundHoop(COURT_FEET.threeRadius + 0.5 + next() * 2.5, angle);
  }
  if (next() < 0.55) {
    // Restricted area and paint.
    const angle = -0.35 + next() * (Math.PI + 0.7);
    return aroundHoop(1 + next() * 7, angle);
  }
  // Mid-range, always inside the arc and the corner lines.
  const angle = 0.15 + next() * (Math.PI - 0.3);
  return aroundHoop(10 + next() * 10, angle);
}

/**
 * Deterministic court location for a shot kind: threes on or behind the arc
 * (corners included), twos split between the paint and mid-range, free
 * throws at the line. Same kind and seed always give the same point.
 */
export function courtSpot(kind: WatchPlayKind, seed: number): CourtPoint {
  return normalize(shotSpotFeet(kind, seed));
}

function jittered(base: readonly Feet[], seed: number, size: number): Feet[] {
  const next = unitStream(seed);
  return base.map((point) => ({
    x: point.x + (next() * 2 - 1) * size,
    y: point.y + (next() * 2 - 1) * size,
  }));
}

function shade(point: Feet): Feet {
  return lerp(point, HOOP, DEFENSE_SHADE);
}

function offenseFormationFeet(seed: number): Feet[] {
  return jittered(OFFENSE_BASE, seed, FORMATION_JITTER_FEET);
}

function defenseJitterFeet(seed: number): Feet[] {
  return jittered(
    OFFENSE_BASE.map(() => ({ x: 0, y: 0 })),
    seed,
    DEFENSE_JITTER_FEET,
  );
}

/**
 * Five formation spots with small seeded jitter. Defensive spots shade each
 * offensive slot toward the basket (slot i guards slot i).
 */
export function formationSpots(
  role: "offense" | "defense",
  seed: number,
): CourtPoint[] {
  const offense = offenseFormationFeet(seed);
  if (role === "offense") {
    return offense.map(normalize);
  }
  const jitter = defenseJitterFeet(seed ^ SALT_DEFENSE);
  return offense.map((point, slot) => {
    const shaded = shade(point);
    return normalize({
      x: shaded.x + jitter[slot]!.x,
      y: shaded.y + jitter[slot]!.y,
    });
  });
}

/** Rim position (normalized). */
export const COURT_RIM: CourtPoint = normalize(HOOP);

const DEFENSE_SIDE_KINDS = new Set<WatchPlayKind>([
  "defensive_rebound",
  "shooting_foul",
  "personal_foul",
]);

/** Team on offense for a non-substitution play. */
function offenseOf(play: WatchPlay): WatchSide {
  return DEFENSE_SIDE_KINDS.has(play.kind)
    ? ((1 - play.side) as WatchSide)
    : play.side;
}

const groupCache = new WeakMap<WatchGameView, CourtPossession[]>();

/** Feed-row possessions in order (same grouping as the play-by-play feed). */
export function possessionGroups(view: WatchGameView): CourtPossession[] {
  const cached = groupCache.get(view);
  if (cached) {
    return cached;
  }
  const groups: CourtPossession[] = [];
  let current: CourtPossession | null = null;
  view.plays.forEach((play, index) => {
    if (play.kind === "substitution") {
      current = null;
      return;
    }
    const first: WatchPlay | undefined = current
      ? view.plays[current.start]
      : undefined;
    if (
      current &&
      first &&
      first.period === play.period &&
      first.poss === play.poss
    ) {
      current.end = index + 1;
      return;
    }
    current = {
      start: index,
      end: index + 1,
      period: play.period,
      offenseSide: offenseOf(play),
    };
    groups.push(current);
  });
  groupCache.set(view, groups);
  return groups;
}

/**
 * `revealed` at the end of the next (1) or previous (-1) feed-row
 * possession. Next from the last possession goes to the end of the log;
 * previous from the first goes back to tip-off.
 */
export function stepPossession(
  view: WatchGameView,
  revealed: number,
  direction: 1 | -1,
): number {
  const count = clampRevealed(view, revealed);
  const ends = possessionGroups(view).map((group) => group.end);
  if (direction > 0) {
    return ends.find((end) => end > count) ?? view.plays.length;
  }
  for (let i = ends.length - 1; i >= 0; i -= 1) {
    if (ends[i]! < count) {
      return ends[i]!;
    }
  }
  return 0;
}

const labelCache = new WeakMap<WatchGameView, Map<PlayerId, string>>();

/** Token labels: last name, or the short name when teammates share it. */
export function courtLabels(view: WatchGameView): Map<PlayerId, string> {
  const cached = labelCache.get(view);
  if (cached) {
    return cached;
  }
  const counts = new Map<string, number>();
  for (const player of view.players) {
    const key = `${player.side}:${player.lastName}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const labels = new Map<PlayerId, string>();
  for (const player of view.players) {
    const shared = (counts.get(`${player.side}:${player.lastName}`) ?? 0) > 1;
    labels.set(
      player.playerId,
      shared || player.lastName.length === 0
        ? player.shortName
        : player.lastName,
    );
  }
  labelCache.set(view, labels);
  return labels;
}

function isFieldGoal(kind: WatchPlayKind): boolean {
  return (
    kind === "two_made" ||
    kind === "two_missed" ||
    kind === "three_made" ||
    kind === "three_missed"
  );
}

function isFreeThrow(kind: WatchPlayKind): boolean {
  return kind === "ft_made" || kind === "ft_missed";
}

/**
 * True for a shooting foul that directly follows a made field goal in the
 * same possession: the foul on a made shot (an and-one). It shows no new
 * action, just the whistle beside the shooter.
 */
export function isAndOne(view: WatchGameView, index: number): boolean {
  const play = view.plays[index];
  const previous = view.plays[index - 1];
  return (
    play !== undefined &&
    previous !== undefined &&
    play.kind === "shooting_foul" &&
    isFieldGoal(previous.kind) &&
    previous.points > 0 &&
    previous.period === play.period &&
    previous.poss === play.poss
  );
}

/** First ball handler of a possession, from its opening play. */
function openingHandler(play: WatchPlay): PlayerId {
  if (play.kind === "shooting_foul" || play.kind === "personal_foul") {
    return play.player2Id ?? play.playerId;
  }
  if (isFieldGoal(play.kind) && play.points > 0 && play.player2Id !== null) {
    return play.player2Id;
  }
  return play.playerId;
}

type Ball = { at: Feet; holderId: PlayerId | null };

type StepResult = {
  play: WatchPlay;
  motion: CourtMotion;
  outcome: CourtOutcome;
  path: Feet[];
  cut: Feet | null;
  receiverId: PlayerId | null;
};

type PossessionCourt = {
  offenseSide: WatchSide;
  ball: Ball;
  spotAt: (side: WatchSide, slot: number) => Feet;
  slotOf: (id: PlayerId | null) => { side: WatchSide; slot: number } | null;
  step: (play: WatchPlay) => StepResult;
};

/**
 * Replays one possession's plays on fixed formation slots. Slots come from
 * the lineup at the possession's start; moves (shooter to the shot spot,
 * rebounder to the glass, defender to the ball) swap with the nearest
 * teammate so tokens never stack.
 */
function createPossessionCourt(
  view: WatchGameView,
  group: CourtPossession,
  lineups: [PlayerId[], PlayerId[]],
): PossessionCourt {
  const offenseSide = group.offenseSide;
  const seed = courtSeed(view.gameId, group.start, SALT_OFFENSE);
  const offense = offenseFormationFeet(seed);
  const defenseJitter = defenseJitterFeet(seed ^ SALT_DEFENSE);
  const defenseOverride: Array<Feet | null> = OFFENSE_BASE.map(() => null);

  const defenseAt = (slot: number): Feet => {
    const override = defenseOverride[slot];
    if (override) {
      return override;
    }
    const shaded = shade(offense[slot]!);
    const jitter = defenseJitter[slot]!;
    return { x: shaded.x + jitter.x, y: shaded.y + jitter.y };
  };

  const spotAt = (side: WatchSide, slot: number): Feet => {
    const s = slot % SLOT_COUNT;
    return side === offenseSide ? offense[s]! : defenseAt(s);
  };

  const slotOf = (
    id: PlayerId | null,
  ): { side: WatchSide; slot: number } | null => {
    if (id === null) {
      return null;
    }
    for (const side of [0, 1] as const) {
      const slot = lineups[side].indexOf(id);
      if (slot >= 0) {
        return { side, slot: slot % SLOT_COUNT };
      }
    }
    return null;
  };

  const spotOf = (id: PlayerId | null): Feet | null => {
    const found = slotOf(id);
    return found ? spotAt(found.side, found.slot) : null;
  };

  /** Moves a player; `pinned` (e.g. the passer) is never swapped away. */
  const moveTo = (
    id: PlayerId,
    target: Feet,
    pinned: PlayerId | null = null,
  ): void => {
    const found = slotOf(id);
    if (!found) {
      return;
    }
    const { side, slot } = found;
    const set = (s: number, point: Feet) => {
      if (side === offenseSide) {
        offense[s] = point;
      } else {
        defenseOverride[s] = point;
      }
    };
    const count = Math.min(SLOT_COUNT, lineups[side].length);
    const pinnedSlot = pinned === null ? -1 : lineups[side].indexOf(pinned);
    let nearest = -1;
    let nearestDistance = SWAP_RADIUS_FEET;
    for (let other = 0; other < count; other += 1) {
      const d =
        other === slot || other === pinnedSlot
          ? Infinity
          : distance(spotAt(side, other), target);
      if (d < nearestDistance) {
        nearest = other;
        nearestDistance = d;
      }
    }
    if (nearest >= 0) {
      set(nearest, spotAt(side, slot));
    }
    set(slot, target);
  };

  // Where the last play's blocked shot went; the next rebound picks it up there.
  let deflected: Feet | null = null;
  const handler = openingHandler(view.plays[group.start]!);
  const court: PossessionCourt = {
    offenseSide,
    ball: { at: spotOf(handler) ?? offense[0]!, holderId: handler },
    spotAt,
    slotOf,
    step: (play) => {
      const before = court.ball.at;
      const path: Feet[] = [before];
      const add = (point: Feet | null) => {
        if (point && !samePoint(path[path.length - 1]!, point)) {
          path.push(point);
        }
      };
      const end = () => path[path.length - 1]!;
      let motion: CourtMotion = "substitution";
      let outcome: CourtOutcome = "none";
      let cut: Feet | null = null;
      let receiverId: PlayerId | null = null;
      const loose = deflected;
      deflected = null;

      if (isFieldGoal(play.kind) || isFreeThrow(play.kind)) {
        motion = isFreeThrow(play.kind) ? "free_throw" : "shot";
        const spot = shotSpotFeet(
          play.kind,
          courtSeed(view.gameId, play.index, SALT_SHOT),
        );
        const assister =
          motion === "shot" && play.points > 0 ? play.player2Id : null;
        add(spotOf(assister));
        const from = spotOf(play.playerId);
        if (assister !== null && from) {
          cut = cutPoint(
            from,
            spot,
            courtSeed(view.gameId, play.index, SALT_CUT),
          );
        }
        moveTo(play.playerId, spot, assister);
        add(spot);
        if (play.points > 0) {
          outcome = "made";
          add(HOOP);
        } else if (motion === "shot" && play.player2Id !== null) {
          outcome = "blocked";
          moveTo(play.player2Id, blockerSpotFeet(spot));
          deflected = deflectionFeet(
            spot,
            courtSeed(view.gameId, play.index, SALT_BLOCK),
          );
          add(deflected);
        } else {
          outcome = "missed";
          add(HOOP);
        }
        court.ball = { at: end(), holderId: null };
      } else if (
        play.kind === "offensive_rebound" ||
        play.kind === "defensive_rebound"
      ) {
        motion = "rebound";
        const next = unitStream(
          courtSeed(view.gameId, play.index, SALT_REBOUND),
        );
        const underHoop = aroundHoop(
          3 + next() * 6,
          0.25 + next() * (Math.PI - 0.5),
        );
        // A blocked shot is recovered where it was swatted.
        const spot = loose ?? underHoop;
        moveTo(play.playerId, spot);
        add(spot);
        court.ball = { at: spot, holderId: play.playerId };
      } else if (play.kind === "turnover") {
        motion = "turnover";
        const handlerSpot = spotOf(play.playerId);
        add(handlerSpot);
        const stealer = play.player2Id;
        if (stealer !== null && handlerSpot) {
          outcome = "stolen";
          const stealerSpot = spotOf(stealer) ?? handlerSpot;
          // The handler throws to one of the two teammates nearest the
          // stealer; the stealer steps into that lane and takes the ball.
          const handlerSide = slotOf(play.playerId)?.side;
          const mates =
            handlerSide === undefined
              ? []
              : lineups[handlerSide]
                  .filter((id) => id !== play.playerId)
                  .flatMap((id) => {
                    const at = spotOf(id);
                    return at ? [{ id, at, d: distance(at, stealerSpot) }] : [];
                  })
                  .sort((a, b) => a.d - b.d)
                  .slice(0, 2);
          const next = unitStream(
            courtSeed(view.gameId, play.index, SALT_STEAL),
          );
          const receiver = mates[Math.floor(next() * mates.length)];
          const lane = STEAL_LANE_MIN + next() * STEAL_LANE_RANGE;
          const spot = receiver
            ? lerp(handlerSpot, receiver.at, lane)
            : lerp(handlerSpot, stealerSpot, 0.5);
          receiverId = receiver?.id ?? null;
          moveTo(stealer, spot);
          add(spot);
          court.ball = { at: spot, holderId: stealer };
        } else {
          court.ball = { at: end(), holderId: null };
        }
      } else if (
        play.kind === "personal_foul" ||
        play.kind === "shooting_foul"
      ) {
        motion = "foul";
        const fouled = spotOf(play.player2Id);
        if (fouled) {
          moveTo(
            play.playerId,
            isAndOne(view, play.index)
              ? besideShooter(
                  fouled,
                  courtSeed(view.gameId, play.index, SALT_CUT),
                )
              : lerp(fouled, HOOP, 0.1),
          );
        }
        if (play.kind === "personal_foul") {
          // Non-shooting foul: the ball stays with the fouled player.
          add(fouled);
          court.ball = {
            at: end(),
            holderId: fouled ? play.player2Id : null,
          };
        } else {
          court.ball = { at: before, holderId: null };
        }
      } else if (play.kind === "offensive_foul") {
        motion = "foul";
        add(spotOf(play.playerId));
        court.ball = { at: end(), holderId: null };
      }
      return { play, motion, outcome, path, cut, receiverId };
    },
  };
  return court;
}

function runPossession(
  view: WatchGameView,
  group: CourtPossession,
  upTo: number,
): { court: PossessionCourt; last: StepResult | null } {
  const court = createPossessionCourt(view, group, lineupAt(view, group.start));
  let last: StepResult | null = null;
  for (let i = group.start; i < Math.min(upTo, group.end); i += 1) {
    last = court.step(view.plays[i]!);
  }
  return { court, last };
}

/** Index of the possession containing play `index`, or -1. */
function groupIndexOf(groups: CourtPossession[], index: number): number {
  let low = 0;
  let high = groups.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const group = groups[mid]!;
    if (index < group.start) {
      high = mid - 1;
    } else if (index >= group.end) {
      low = mid + 1;
    } else {
      return mid;
    }
  }
  return -1;
}

function toLastPlay(
  play: WatchPlay,
  motion: CourtMotion,
  outcome: CourtOutcome,
  path: Feet[],
  cut: Feet | null = null,
  receiverId: PlayerId | null = null,
): CourtLastPlay {
  return {
    index: play.index,
    kind: play.kind,
    motion,
    outcome,
    playerId: play.playerId,
    player2Id: play.player2Id,
    points: play.points,
    path: path.map(normalize),
    cut: cut ? normalize(cut) : null,
    ...(receiverId ? { receiverId } : {}),
  };
}

/**
 * Formation spots (no off-ball drift) and ball just before play `index`,
 * after the earlier plays of its possession: the set-up the play starts
 * from. Null for substitutions and out-of-range indices.
 */
export function courtBeforePlay(
  view: WatchGameView,
  index: number,
): {
  offenseSide: WatchSide;
  spots: Map<PlayerId, CourtPoint>;
  ball: CourtBall;
} | null {
  const groups = possessionGroups(view);
  const group = groups[groupIndexOf(groups, index)];
  if (!group) {
    return null;
  }
  const { court } = runPossession(view, group, index);
  const lineups = lineupAt(view, group.start);
  const spots = new Map<PlayerId, CourtPoint>();
  for (const side of [0, 1] as const) {
    lineups[side].forEach((playerId, slot) => {
      spots.set(playerId, normalize(court.spotAt(side, slot)));
    });
  }
  const holderId = court.ball.holderId;
  return {
    offenseSide: court.offenseSide,
    spots,
    ball: {
      at: normalize(court.ball.at),
      holderId: holderId !== null && spots.has(holderId) ? holderId : null,
    },
  };
}

/** Court state after the first `revealed` plays. Pure and deterministic. */
export function buildCourtFrame(
  view: WatchGameView,
  revealed: number,
): CourtFrame {
  const total = view.plays.length;
  const count = clampRevealed(view, revealed);
  const groups = possessionGroups(view);
  const labels = courtLabels(view);

  let lastPlayIndex = -1;
  for (let i = count - 1; i >= 0; i -= 1) {
    if (view.plays[i]!.kind !== "substitution") {
      lastPlayIndex = i;
      break;
    }
  }
  const possessionIndex =
    lastPlayIndex >= 0 ? groupIndexOf(groups, lastPlayIndex) : -1;
  const group = groups[Math.max(0, possessionIndex)];

  let court: PossessionCourt | null = null;
  let lastPlay: CourtLastPlay | null = null;
  if (group) {
    const upTo = possessionIndex >= 0 ? lastPlayIndex + 1 : group.start;
    const run = runPossession(view, group, upTo);
    court = run.court;
    if (run.last) {
      const path = [...run.last.path];
      if (lastPlayIndex === group.start && possessionIndex > 0) {
        // Ball travels from where the previous possession left it.
        const previous = groups[possessionIndex - 1]!;
        const before = runPossession(view, previous, previous.end).court.ball;
        if (!samePoint(before.at, path[0]!)) {
          path.unshift(before.at);
        }
      }
      lastPlay = toLastPlay(
        run.last.play,
        run.last.motion,
        run.last.outcome,
        path,
        run.last.cut,
        run.last.receiverId,
      );
    }
  }

  const lineups = lineupAt(view, count);
  const onCourt = new Set<PlayerId>([...lineups[0], ...lineups[1]]);
  const offenseSide: WatchSide = court?.offenseSide ?? 0;

  const ball: CourtBall = court
    ? {
        at: normalize(court.ball.at),
        holderId:
          court.ball.holderId !== null && onCourt.has(court.ball.holderId)
            ? court.ball.holderId
            : null,
      }
    : { at: COURT_RIM, holderId: null };

  const tail = count > 0 ? view.plays[count - 1]! : null;
  if (tail?.kind === "substitution") {
    lastPlay = toLastPlay(tail, "substitution", "none", [
      court?.ball.at ?? HOOP,
    ]);
  }

  // Off-ball drift, seeded by the latest non-substitution play. Slots that
  // play touched (and the ball holder's) stay put so the ball path lines
  // up; a substitute inherits the slot's exemption.
  const exempt = new Set<string>();
  const drift = new Map<string, Feet>();
  if (court && lastPlayIndex >= 0 && OFF_BALL_DRIFT_FEET > 0) {
    const touched = view.plays[lastPlayIndex]!;
    // An and-one adds nothing to the made shot: the shot's drift carries on
    // and its players stay put, so only the fouler moves.
    const andOne = isAndOne(view, lastPlayIndex);
    const shot = andOne ? view.plays[lastPlayIndex - 1]! : null;
    for (const id of [
      touched.playerId,
      touched.player2Id,
      shot?.playerId ?? null,
      shot?.player2Id ?? null,
      court.ball.holderId,
    ]) {
      const found = court.slotOf(id);
      if (found) {
        exempt.add(`${found.side}:${found.slot}`);
      }
    }
    const next = unitStream(
      courtSeed(
        view.gameId,
        andOne ? lastPlayIndex - 1 : lastPlayIndex,
        SALT_DRIFT,
      ),
    );
    for (const side of [0, 1] as const) {
      const size =
        side === court.offenseSide
          ? OFF_BALL_DRIFT_FEET
          : OFF_BALL_DRIFT_FEET * DEFENSE_DRIFT_SCALE;
      for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
        drift.set(`${side}:${slot}`, {
          x: (next() * 2 - 1) * size,
          y: (next() * 2 - 1) * size,
        });
      }
    }
  }

  const shooterId =
    lastPlay && (lastPlay.motion === "shot" || lastPlay.motion === "free_throw")
      ? lastPlay.playerId
      : null;

  const byId = new Map(view.players.map((p) => [p.playerId, p]));
  // Free throws: both teams line up on the lane, the shooter at the line.
  const lineup =
    lastPlay?.motion === "free_throw"
      ? freeThrowLineup(
          [0, 1].flatMap((side) =>
            lineups[side as WatchSide].map((playerId, slot) => ({
              playerId,
              side: side as WatchSide,
              slot,
            })),
          ),
          shooterId,
          byId.get(lastPlay.playerId)?.side ?? offenseSide,
        )
      : null;
  const players: CourtPlayer[] = [];
  for (const side of [0, 1] as const) {
    lineups[side].forEach((playerId, slot) => {
      const player = byId.get(playerId);
      if (!player) {
        return;
      }
      const key = `${side}:${slot % SLOT_COUNT}`;
      const offset = exempt.has(key) ? undefined : drift.get(key);
      const base = court
        ? court.spotAt(side, slot)
        : side === offenseSide
          ? OFFENSE_BASE[slot % SLOT_COUNT]!
          : shade(OFFENSE_BASE[slot % SLOT_COUNT]!);
      const spot = offset
        ? insideCourt({ x: base.x + offset.x, y: base.y + offset.y })
        : base;
      const lined = lineup?.get(playerId);
      players.push({
        playerId,
        side,
        label: labels.get(playerId) ?? player.shortName,
        shortName: player.shortName,
        fullName: player.fullName,
        slot,
        onOffense: side === offenseSide,
        spot: lined ?? normalize(spot),
        role:
          playerId === shooterId
            ? "shooter"
            : playerId === ball.holderId
              ? "handler"
              : "off-ball",
      });
    });
  }

  const shots: CourtShot[] = [];
  for (let i = 0; i < count; i += 1) {
    const play = view.plays[i]!;
    if (!isFieldGoal(play.kind)) {
      continue;
    }
    shots.push({
      index: i,
      side: play.side,
      playerId: play.playerId,
      at: courtSpot(play.kind, courtSeed(view.gameId, i, SALT_SHOT)),
      made: play.points > 0,
      three: play.kind === "three_made" || play.kind === "three_missed",
    });
  }

  const substitutions: CourtSubstitution[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const play = view.plays[i]!;
    if (play.kind !== "substitution") {
      break;
    }
    if (play.player2Id !== null) {
      substitutions.unshift({
        index: i,
        side: play.side,
        outId: play.playerId,
        inId: play.player2Id,
      });
    }
  }

  // The possession holding the next unrevealed play (or the current one).
  const nextGroup = groups.find((g) => g.end > count);

  return {
    revealed: count,
    total,
    isFinal: count === total,
    period: tail?.period ?? 1,
    clock: tail?.clock ?? START_PERIOD_CLOCK_SECONDS,
    possessionIndex,
    offenseSide,
    ballSide: nextGroup ? nextGroup.offenseSide : null,
    players,
    ball,
    lastPlay,
    shots,
    substitutions,
  };
}

/**
 * First play of the run of consecutive substitutions containing `index`
 * (`index` itself when that play is not a substitution).
 */
export function subRunStart(view: WatchGameView, index: number): number {
  let start = index;
  if (view.plays[start]?.kind !== "substitution") {
    return start;
  }
  while (start > 0 && view.plays[start - 1]!.kind === "substitution") {
    start -= 1;
  }
  return start;
}

/**
 * Revealed count after the run of consecutive substitutions containing
 * `index` (so the run is plays `subRunStart..subRunEnd - 1`); `index` itself
 * when that play is not a substitution.
 */
export function subRunEnd(view: WatchGameView, index: number): number {
  if (view.plays[index]?.kind !== "substitution") {
    return index;
  }
  let end = index + 1;
  while (view.plays[end]?.kind === "substitution") {
    end += 1;
  }
  return end;
}
