/**
 * Play choreography for the Watch Game court: a few timed beats per revealed
 * play so players and the ball move through the whole play instead of
 * sliding once and waiting.
 *
 * Presentation only, a pure function of (view, index). Every beat starts at
 * `buildFullCourtFrame(view, index)` and ends exactly at
 * `buildFullCourtFrame(view, index + 1)`, so scrubbing, restart and skip
 * still land on the same frame. Invented motion (swing passes, box-outs, a
 * defender trailing his man) is seeded by `courtSeed` and never contradicts
 * the log: the scorer shoots, the assister makes the last pass, the stealer
 * ends with the ball, and invented passes only go between teammates on the
 * floor.
 *
 * Coordinates are full-court normalized points (see watch-full-court.ts).
 */
import type { PlayerId } from "@/domain/ids";
import {
  COURT_RIM,
  DEFENSE_SHADE,
  courtBeforePlay,
  courtSeed,
} from "@/state/watch-court-frame";
import {
  FULL_COURT_FEET,
  buildFullCourtFrame,
  opensAtNewEnd,
  toFullCourt,
  type FullCourtFrame,
  type FullCourtPoint,
} from "@/state/watch-full-court";
import type {
  WatchGameView,
  WatchPlayKind,
  WatchSide,
} from "@/state/watch-game-view";

/** How the ball travels from one beat to the next. */
export type ChoreoLeg =
  /** Held by the same player (dribble). */
  | "carry"
  /** Hand to hand between teammates. */
  | "pass"
  /** Taken by an opponent (a logged steal). */
  | "steal"
  /** From the shooter's hand to the rim (or the block). */
  | "shot"
  /** Dead, loose or off the rim (nobody holds it at one end of the leg), or
   * changing teams on a whistle. */
  | "loose";

export type ChoreoBall = {
  at: FullCourtPoint;
  holderId: PlayerId | null;
  /** 0 on the floor or in a hand; 1 at rim height. */
  lift: number;
};

export type PlayChoreography = {
  index: number;
  /** Normalized times, ascending, first 0 and last 1. */
  beats: number[];
  /** One point per beat for every on-court player (frame order). */
  tracks: { playerId: PlayerId; side: WatchSide; points: FullCourtPoint[] }[];
  /** Ball at each beat; a held ball sits on its holder's track. */
  ball: ChoreoBall[];
  /** Ball legs between consecutive beats (beats.length - 1). */
  legs: ChoreoLeg[];
};

const SALT_CHOREO = 8;

const FIELD_GOAL_KINDS = new Set<WatchPlayKind>([
  "two_made",
  "two_missed",
  "three_made",
  "three_missed",
]);
const SHOT_KINDS = new Set<WatchPlayKind>([
  ...FIELD_GOAL_KINDS,
  "ft_made",
  "ft_missed",
]);

/** Share of an opening play spent bringing the ball up the floor. */
const OPENER_SHARE = 0.4;
/** Action times (fraction of the action) for each script. */
const SHOT_BEAT = 0.6;
const PASSES_BEFORE = 0.45;
const CUT_BEAT = 0.3;
const FT_CATCH_BEAT = 0.3;
const FT_RELEASE_BEAT = 0.55;
const BOX_OUT_BEAT = 0.3;
const REBOUND_BEAT = 0.55;
const HANDOFF_BEAT = 0.3;
const STEAL_BEAT = 0.6;
const WHISTLE_BEAT = 0.4;
const MAX_SWINGS = 2;
/** Box-outs step this fraction of the way to the rim. */
const BOX_OUT_STEP = 0.25;

/** No two tokens closer than this at an inner beat. */
export const CHOREO_MIN_SPACING_FEET = 3;
const MARGIN_FEET = 0.5;
const SPACING_PASSES = 40;

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

function lerp(a: FullCourtPoint, b: FullCourtPoint, t: number): FullCourtPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Distance in feet between two full-court points. */
export function feetBetween(a: FullCourtPoint, b: FullCourtPoint): number {
  return Math.hypot(
    (a.x - b.x) * FULL_COURT_FEET.length,
    (a.y - b.y) * FULL_COURT_FEET.width,
  );
}

const roundTime = (t: number) => Math.round(t * 10000) / 10000;

type Holder = { holderId: PlayerId | null; at?: FullCourtPoint };

/**
 * Beats, keyed positions and ball holders for one play. Times are play times
 * (0..1); unkeyed players follow `base` between the frames.
 */
class Script {
  readonly times = new Set<number>([0, 1]);
  readonly keys = new Map<PlayerId, Map<number, FullCourtPoint>>();
  readonly holders = new Map<number, Holder>();

  key(id: PlayerId, t: number, at: FullCourtPoint): void {
    const time = roundTime(t);
    this.times.add(time);
    let byTime = this.keys.get(id);
    if (!byTime) {
      byTime = new Map();
      this.keys.set(id, byTime);
    }
    byTime.set(time, at);
  }

  hold(t: number, holderId: PlayerId | null, at?: FullCourtPoint): void {
    const time = roundTime(t);
    this.times.add(time);
    this.holders.set(time, { holderId, at });
  }

  beat(t: number): void {
    this.times.add(roundTime(t));
  }
}

/**
 * Timed beats for the play at `index` (the move from `revealed = index` to
 * `index + 1`); null for substitutions and indices outside the log.
 */
export function buildPlayChoreography(
  view: WatchGameView,
  index: number,
): PlayChoreography | null {
  const play = view.plays[index];
  if (!play || play.kind === "substitution") {
    return null;
  }
  const before = courtBeforePlay(view, index);
  if (!before) {
    return null;
  }
  const from = buildFullCourtFrame(view, index);
  const to = buildFullCourtFrame(view, index + 1);
  const end = to.attackingEnd;
  const hoop = toFullCourt(COURT_RIM, end);
  const offense = before.offenseSide;

  const fromSpot = new Map(from.players.map((p) => [p.playerId, p.spot]));
  const toSpot = new Map(to.players.map((p) => [p.playerId, p.spot]));
  const sideOf = new Map(to.players.map((p) => [p.playerId, p.side]));
  const setUp = new Map<PlayerId, FullCourtPoint>();
  for (const [id, spot] of before.spots) {
    setUp.set(id, toFullCourt(spot, end));
  }
  const onFloor = (id: PlayerId | null): id is PlayerId =>
    id !== null && toSpot.has(id);
  const offenseIds = to.players
    .filter((p) => p.side === offense)
    .map((p) => p.playerId);

  const transition = to.transition;
  const opener = opensAtNewEnd(view, index) && transition !== null;
  const share = opener ? OPENER_SHARE : 0;
  const at = (u: number) => share + u * (1 - share);

  // Where the action starts: the set-up after an opener, the previous frame
  // otherwise.
  const start = (id: PlayerId): FullCourtPoint =>
    (opener ? setUp.get(id) : fromSpot.get(id)) ?? toSpot.get(id) ?? hoop;
  const startHolder: PlayerId | null = opener
    ? before.ball.holderId
    : from.ball.holderId;

  const script = new Script();
  // Unkeyed players reach their end spot at this action time (fouls freeze).
  let settle = 1;
  const actors = new Set<PlayerId>();

  if (opener && transition) {
    // Bring it up: the handler carries the ball through the transition
    // waypoints and arrives at the set-up as the action starts.
    const handler = onFloor(before.ball.holderId) ? before.ball.holderId : null;
    const legs = transition.length - 1;
    for (let j = 1; j <= legs; j += 1) {
      const t = (share * j) / legs;
      if (handler) {
        script.key(handler, t, transition[j]!);
        script.hold(t, handler);
      } else {
        script.hold(t, null, transition[j]!);
      }
    }
    if (handler) {
      actors.add(handler);
    }
    script.beat(share);
  }

  // Ball handoffs inside the action; a change between opponents only happens
  // through a logged steal, anything else is a loose ball.
  const shooterId = play.playerId;
  if (FIELD_GOAL_KINDS.has(play.kind)) {
    const made = play.points > 0;
    const assister = made && onFloor(play.player2Id) ? play.player2Id : null;
    const next = unitStream(courtSeed(view.gameId, index, SALT_CHOREO));
    const swings = Math.floor(next() * (MAX_SWINGS + 1));
    const first =
      onFloor(startHolder) && sideOf.get(startHolder) === offense
        ? startHolder
        : null;
    const finalPasser = assister ?? shooterId;
    const chain: PlayerId[] = [];
    let holder = first;
    for (let j = 0; j < swings; j += 1) {
      const options = offenseIds.filter(
        (id) => id !== holder && id !== shooterId && id !== assister,
      );
      if (options.length === 0) {
        break;
      }
      holder = options[Math.floor(next() * options.length)]!;
      chain.push(holder);
    }
    if (holder !== finalPasser) {
      chain.push(finalPasser);
    }
    if (assister !== null) {
      chain.push(shooterId);
    }
    // Catches spread up to the shot; an assisted shooter catches on the spot.
    const lastCatch = assister !== null ? SHOT_BEAT : PASSES_BEFORE;
    chain.forEach((id, j) => {
      script.hold(at((lastCatch * (j + 1)) / chain.length), id);
    });
    if (to.lastPlay?.cut && assister !== null) {
      script.key(shooterId, at(CUT_BEAT), to.lastPlay.cut);
    }
    script.key(shooterId, at(SHOT_BEAT), toSpot.get(shooterId) ?? hoop);
    script.hold(at(SHOT_BEAT), shooterId);
    actors.add(shooterId);
    if (onFloor(play.player2Id)) {
      actors.add(play.player2Id);
    }
  } else if (play.kind === "ft_made" || play.kind === "ft_missed") {
    const line = toSpot.get(shooterId) ?? hoop;
    script.key(shooterId, at(FT_CATCH_BEAT), line);
    script.hold(at(FT_CATCH_BEAT), shooterId);
    script.key(shooterId, at(FT_RELEASE_BEAT), line);
    script.hold(at(FT_RELEASE_BEAT), shooterId);
    actors.add(shooterId);
  } else if (
    play.kind === "offensive_rebound" ||
    play.kind === "defensive_rebound"
  ) {
    // Each side's player nearest the rim boxes out; the rebounder goes
    // to the ball.
    for (const side of [0, 1] as const) {
      const nearest = to.players
        .filter((p) => p.side === side && p.playerId !== shooterId)
        .map((p) => ({
          id: p.playerId,
          d: feetBetween(start(p.playerId), hoop),
        }))
        .sort((a, b) => a.d - b.d)[0];
      if (nearest) {
        const base = lerp(
          start(nearest.id),
          toSpot.get(nearest.id)!,
          BOX_OUT_BEAT,
        );
        script.key(
          nearest.id,
          at(BOX_OUT_BEAT),
          lerp(base, hoop, BOX_OUT_STEP),
        );
        actors.add(nearest.id);
      }
    }
    script.key(shooterId, at(REBOUND_BEAT), toSpot.get(shooterId) ?? hoop);
    script.hold(at(REBOUND_BEAT), shooterId);
    actors.add(shooterId);
  } else if (play.kind === "turnover") {
    const handler = onFloor(shooterId) ? shooterId : null;
    if (handler) {
      script.hold(at(HANDOFF_BEAT), handler);
      actors.add(handler);
    }
    const stealer = to.ball.holderId;
    if (onFloor(stealer) && stealer === play.player2Id) {
      script.key(stealer, at(STEAL_BEAT), toSpot.get(stealer)!);
      script.hold(at(STEAL_BEAT), stealer);
      actors.add(stealer);
    } else {
      script.hold(at(STEAL_BEAT), null, to.ball.at);
    }
  } else {
    // Fouls: everyone stops on the whistle and holds.
    settle = WHISTLE_BEAT;
    script.beat(at(WHISTLE_BEAT));
    script.hold(at(WHISTLE_BEAT), to.ball.holderId, to.ball.at);
  }

  return assemble(index, script, {
    from,
    to,
    hoop,
    offense,
    share,
    settle,
    actors,
    start,
    shot: SHOT_KINDS.has(play.kind),
    stealer: play.kind === "turnover" ? play.player2Id : null,
  });
}

function assemble(
  index: number,
  script: Script,
  ctx: {
    from: FullCourtFrame;
    to: FullCourtFrame;
    hoop: FullCourtPoint;
    offense: WatchSide;
    share: number;
    settle: number;
    actors: Set<PlayerId>;
    start: (id: PlayerId) => FullCourtPoint;
    /** The last leg is a shot or free throw leaving the shooter's hand. */
    shot: boolean;
    /** The logged stealer: the only way the ball changes hands across teams. */
    stealer: PlayerId | null;
  },
): PlayChoreography {
  const { from, to, hoop, offense, share, settle } = ctx;
  const beats = [...script.times].sort((a, b) => a - b);
  const last = beats.length - 1;
  const fromSpot = new Map(from.players.map((p) => [p.playerId, p.spot]));

  // Unkeyed motion: frame to set-up during the opener, then set-up to the
  // end spot over the action (reached at `settle`).
  const base = (id: PlayerId, endSpot: FullCourtPoint, t: number) => {
    const fromAt = fromSpot.get(id) ?? endSpot;
    if (share > 0 && t <= share) {
      return lerp(fromAt, ctx.start(id), t / share);
    }
    const u = share >= 1 ? 1 : (t - share) / (1 - share);
    return lerp(ctx.start(id), endSpot, Math.min(1, u / settle));
  };

  const positions = new Map<PlayerId, FullCourtPoint[]>();
  const keyedAt = (id: PlayerId, t: number) => script.keys.get(id)?.get(t);
  const ordered = [
    ...to.players.filter((p) => p.side === offense),
    ...to.players.filter((p) => p.side !== offense),
  ];
  const manOf = new Map<number, PlayerId>();
  for (const p of to.players) {
    if (p.side === offense) {
      manOf.set(p.slot % 5, p.playerId);
    }
  }
  for (const player of ordered) {
    const endSpot = player.spot;
    const man =
      player.side !== offense ? manOf.get(player.slot % 5) : undefined;
    const points = beats.map((t, k) => {
      if (k === 0) {
        return fromSpot.get(player.playerId) ?? endSpot;
      }
      if (k === last) {
        return endSpot;
      }
      const keyed = keyedAt(player.playerId, t);
      if (keyed) {
        return keyed;
      }
      // A defender trails his man by half a beat, shaded toward the rim.
      if (
        man !== undefined &&
        t > share &&
        settle === 1 &&
        !ctx.actors.has(player.playerId)
      ) {
        const track = positions.get(man)!;
        const trail = lerp(track[k - 1]!, track[k]!, 0.5);
        return lerp(trail, hoop, DEFENSE_SHADE);
      }
      return base(player.playerId, endSpot, t);
    });
    positions.set(player.playerId, points);
  }

  // Who has the ball at each beat: explicit holders at their beats,
  // otherwise the last holder keeps it.
  const holders: Array<PlayerId | null> = [];
  const looseAt: FullCourtPoint[] = [];
  let holder: PlayerId | null = from.ball.holderId;
  let loose: FullCourtPoint = from.ball.at;
  beats.forEach((t, k) => {
    if (k === 0 || k === last) {
      const frame = k === 0 ? from : to;
      holders.push(frame.ball.holderId);
      looseAt.push(frame.ball.at);
      return;
    }
    const set = script.holders.get(t);
    if (set) {
      holder =
        set.holderId !== null && positions.has(set.holderId)
          ? set.holderId
          : null;
      if (holder === null) {
        loose = set.at ?? loose;
      }
    }
    holders.push(holder);
    looseAt.push(loose);
  });

  // Keep tokens apart at the inner beats; the ball holder stays put.
  const order = ordered.map((p) => p.playerId);
  for (let k = 1; k < last; k += 1) {
    const held = holders[k];
    spaceOut(
      order.map((id) => positions.get(id)!),
      k,
      held === null ? -1 : order.indexOf(held!),
    );
  }

  const ball: ChoreoBall[] = beats.map((_, k) => {
    const id = holders[k]!;
    const spot =
      k === 0 || k === last || id === null
        ? looseAt[k]!
        : positions.get(id)![k]!;
    return withLift(spot, id, hoop);
  });

  const sideOf = new Map(to.players.map((p) => [p.playerId, p.side]));
  const legs: ChoreoLeg[] = [];
  for (let k = 0; k < last; k += 1) {
    const a = ball[k]!;
    const b = ball[k + 1]!;
    if (a.holderId !== null && b.holderId === a.holderId) {
      legs.push("carry");
    } else if (a.holderId !== null && b.holderId !== null) {
      legs.push(
        sideOf.get(a.holderId) === sideOf.get(b.holderId)
          ? "pass"
          : b.holderId === ctx.stealer
            ? "steal"
            : "loose",
      );
    } else if (a.holderId !== null && ctx.shot && k + 1 === last) {
      legs.push("shot");
    } else {
      legs.push("loose");
    }
  }

  return {
    index,
    beats,
    tracks: to.players.map((p) => ({
      playerId: p.playerId,
      side: p.side,
      points: positions.get(p.playerId)!,
    })),
    ball,
    legs,
  };

  function withLift(
    spot: FullCourtPoint,
    holderId: PlayerId | null,
    rim: FullCourtPoint,
  ): ChoreoBall {
    const atRim = holderId === null && feetBetween(spot, rim) < 1;
    return { at: spot, holderId, lift: atRim ? 1 : 0 };
  }
}

/**
 * Pushes tokens apart at beat `k` until no two are closer than
 * `CHOREO_MIN_SPACING_FEET`, keeping them on the floor. The `fixed` token
 * (the ball holder, -1 for none) never moves; the other one of its pair takes
 * the whole push. Deterministic: a stacked pair splits along a fixed
 * direction.
 */
function spaceOut(tracks: FullCourtPoint[][], k: number, fixed: number): void {
  const L = FULL_COURT_FEET.length;
  const W = FULL_COURT_FEET.width;
  const feet = tracks.map((track) => ({
    x: track[k]!.x * L,
    y: track[k]!.y * W,
  }));
  for (let pass = 0; pass < SPACING_PASSES; pass += 1) {
    let moved = false;
    for (let i = 0; i < feet.length; i += 1) {
      for (let j = i + 1; j < feet.length; j += 1) {
        const a = feet[i]!;
        const b = feet[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= CHOREO_MIN_SPACING_FEET) {
          continue;
        }
        if (d < 1e-6) {
          const angle = (i * 7 + j * 3) % 8;
          dx = Math.cos((angle * Math.PI) / 4);
          dy = Math.sin((angle * Math.PI) / 4);
          d = 1;
        }
        // A little over the gap so rounding never leaves a pair just short.
        const gap =
          CHOREO_MIN_SPACING_FEET - Math.min(d, CHOREO_MIN_SPACING_FEET) + 0.02;
        const ux = dx / d;
        const uy = dy / d;
        const shareA = i === fixed ? 0 : j === fixed ? 1 : 0.5;
        a.x -= ux * gap * shareA;
        a.y -= uy * gap * shareA;
        b.x += ux * gap * (1 - shareA);
        b.y += uy * gap * (1 - shareA);
        moved = true;
      }
    }
    for (const point of feet) {
      point.x = Math.min(L - MARGIN_FEET, Math.max(MARGIN_FEET, point.x));
      point.y = Math.min(W - MARGIN_FEET, Math.max(MARGIN_FEET, point.y));
    }
    if (!moved) {
      break;
    }
  }
  tracks.forEach((track, i) => {
    if (i !== fixed) {
      track[k] = { x: feet[i]!.x / L, y: feet[i]!.y / W };
    }
  });
}
