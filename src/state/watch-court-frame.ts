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
const DEFENSE_SHADE = 0.3;
/** A teammate this close to a player's new spot swaps into the old one. */
const SWAP_RADIUS_FEET = 3;

const SALT_SHOT = 1;
const SALT_OFFENSE = 2;
const SALT_DEFENSE = 3;
const SALT_REBOUND = 4;

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
};

type PossessionCourt = {
  offenseSide: WatchSide;
  ball: Ball;
  spotAt: (side: WatchSide, slot: number) => Feet;
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

  const handler = openingHandler(view.plays[group.start]!);
  const court: PossessionCourt = {
    offenseSide,
    ball: { at: spotOf(handler) ?? offense[0]!, holderId: handler },
    spotAt,
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

      if (isFieldGoal(play.kind) || isFreeThrow(play.kind)) {
        motion = isFreeThrow(play.kind) ? "free_throw" : "shot";
        const spot = shotSpotFeet(
          play.kind,
          courtSeed(view.gameId, play.index, SALT_SHOT),
        );
        const assister =
          motion === "shot" && play.points > 0 ? play.player2Id : null;
        add(spotOf(assister));
        moveTo(play.playerId, spot, assister);
        add(spot);
        if (play.points > 0) {
          outcome = "made";
          add(HOOP);
        } else if (motion === "shot" && play.player2Id !== null) {
          outcome = "blocked";
          moveTo(play.player2Id, lerp(spot, HOOP, 0.12));
          add(lerp(spot, HOOP, 0.3));
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
        const spot = aroundHoop(
          3 + next() * 6,
          0.25 + next() * (Math.PI - 0.5),
        );
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
          const spot = lerp(handlerSpot, spotOf(stealer) ?? handlerSpot, 0.5);
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
          moveTo(play.playerId, lerp(fouled, HOOP, 0.1));
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
      return { play, motion, outcome, path };
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

  const shooterId =
    lastPlay && (lastPlay.motion === "shot" || lastPlay.motion === "free_throw")
      ? lastPlay.playerId
      : null;

  const byId = new Map(view.players.map((p) => [p.playerId, p]));
  const players: CourtPlayer[] = [];
  for (const side of [0, 1] as const) {
    lineups[side].forEach((playerId, slot) => {
      const player = byId.get(playerId);
      if (!player) {
        return;
      }
      const spot = court
        ? court.spotAt(side, slot)
        : side === offenseSide
          ? OFFENSE_BASE[slot % SLOT_COUNT]!
          : shade(OFFENSE_BASE[slot % SLOT_COUNT]!);
      players.push({
        playerId,
        side,
        label: labels.get(playerId) ?? player.shortName,
        shortName: player.shortName,
        fullName: player.fullName,
        slot,
        onOffense: side === offenseSide,
        spot: normalize(spot),
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
