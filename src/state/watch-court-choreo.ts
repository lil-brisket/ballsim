/**
 * Play choreography for the Watch Game court: a few timed beats per revealed
 * play so players and the ball move through the whole play instead of
 * sliding once and waiting.
 *
 * Presentation only, a pure function of (view, index). Every beat starts at
 * `buildFullCourtFrame(view, index)` and ends exactly at
 * `buildFullCourtFrame(view, index + 1)` (a run of substitutions goes from the
 * frame before the run to the frame after it), so scrubbing, restart and skip
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
  isAndOne,
  subRunEnd,
  subRunStart,
} from "@/state/watch-court-frame";
import {
  FULL_COURT_FEET,
  buildFullCourtFrame,
  opensAtNewEnd,
  toFullCourt,
  type FullCourtFrame,
  type FullCourtPoint,
} from "@/state/watch-full-court";
import { jumpBall } from "@/state/watch-jump-ball";
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
  /**
   * One point per beat for every on-court player (frame order). A
   * substitution run also lists the bench, with seats as points below the
   * sideline (y < 0).
   */
  tracks: { playerId: PlayerId; side: WatchSide; points: FullCourtPoint[] }[];
  /** Ball at each beat; a held ball sits on its holder's track. */
  ball: ChoreoBall[];
  /** Ball legs between consecutive beats (beats.length - 1). */
  legs: ChoreoLeg[];
  /**
   * Play time (0..1) when the logged event happens on screen: the ball
   * reaches the rim, the rebound or steal, the whistle. The feed and score
   * wait for it.
   */
  eventAt: number;
  /** The play ends on a dead ball: everyone stops instead of running on. */
  deadBall: boolean;
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

/** Default share of an opening play spent bringing the ball up the floor. */
const OPENER_SHARE = 0.4;

/**
 * A field goal's action, in milliseconds at 1x: the handler sizes it up, each
 * pass gets its own window (the ball in the air for most of it), the shooter
 * rises, and the shot flies to the rim. Playback pacing uses the same total
 * (`fieldGoalActionMs`), so a possession with more passes runs longer instead
 * of squeezing them.
 */
const FG_HANDLE_MS = 250;
const FG_PASS_MS = 750;
/**
 * A pass flies at about this speed (ft/s), within these bounds (ms), so a
 * cross-court swing takes longer than a short dump-off.
 */
const PASS_FEET_PER_SECOND = 50;
const PASS_FLIGHT_MIN_MS = 300;
const PASS_FLIGHT_MAX_MS = 600;
const FG_RISE_MS = 300;
const FG_SHOT_FLIGHT_MS = 500;
const FG_AFTER_MS = 300;
/** The ball meets the blocker this far through the shot's flight. */
const FG_BLOCK_SHARE = 0.48;

/** Action times (fraction of the action) for each script. */
const FT_CATCH_BEAT = 0.3;
const FT_RELEASE_BEAT = 0.55;
/** A free throw reaches the rim here and sits for the rest. */
const RIM_BEAT = 0.85;
/**
 * A block: the blocker's hand meets the ball `FG_BLOCK_SHARE` through the
 * shot's flight, about BLOCK_CONTACT_FEET in front of the shooter. The ball is
 * cut off there, then swatted to its resting spot by the time a shot would
 * reach the rim. The ball's height at contact is a share of the shot arc.
 */
const BLOCK_CONTACT_FEET = 3.1;
const BLOCK_LIFT = 0.6;
/** The intended receiver of a stolen pass steps this far toward the lane, then stops. */
const RECEIVER_STEP = 0.2;
const BOX_OUT_BEAT = 0.3;
const REBOUND_BEAT = 0.55;
const HANDOFF_BEAT = 0.3;
const STEAL_BEAT = 0.6;
const WHISTLE_BEAT = 0.4;
/** An and-one adds nothing to the made shot: a quick whistle, then stillness. */
const AND_ONE_BEAT = 0.35;
/** Free throws: everyone is on the lane spots by here. */
const FT_LINEUP_BEAT = 0.45;
const MAX_SWINGS = 2;

/**
 * Transition beats as fractions of the bring-up. After a make a teammate
 * inbounds to the handler; after a rebound or steal an outlet pass finds
 * him; then he dribbles through midcourt into the set-up.
 */
const INBOUND_BEAT = 0.3;
const INBOUND_CATCH_BEAT = 0.45;
const INBOUND_CATCH_STEP = 0.3;
/** A same-end inbound carries this far toward the set-up by the mid beat. */
const INBOUND_MID_STEP = 0.6;
const OUTLET_BEAT = 0.25;
const OUTLET_STEP = 0.35;
const MIDCOURT_AFTER_MAKE = 0.75;
const MIDCOURT_BEAT = 0.65;
/** The inbounder trails into the play this far along by the midcourt beat. */
const INBOUNDER_TRAIL = 0.55;

/**
 * Running the floor (fraction of the bring-up -> share of the way to the
 * set-up). Wings and the corner sprint their lanes ahead of the ball, the
 * top man follows the ball, the big trails; everyone gets wide early.
 * Defenders sprint back first and sag toward the rim before matching up.
 */
const LANE_PACE = [1.4, 2.4, 2.4, 2.4, 1.1] as const;
const LANE_WIDEN = 3;
const SPRINT_BACK = 2.6;
const SAG_TO_RIM = 0.35;
/** Box-outs step this fraction of the way to the rim. */
const BOX_OUT_STEP = 0.25;

/**
 * Tip-off beats as fractions of the tip: the ball goes up at centre, then is
 * tipped to a teammate who has it by the end of the tip.
 */
const TIP_UP_BEAT = 0.4;
const TIP_CATCH_BEAT = 0.8;
/** Tip-off bring-up: the handler dribbles this far toward the set-up by midcourt. */
const TIP_MIDCOURT_STEP = 0.55;
const SALT_TIP = 9;

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
  readonly lifts = new Map<number, number>();
  /** A player who stays exactly where he is keyed when tokens are spaced out. */
  readonly pinned = new Map<number, PlayerId>();
  /**
   * Passes in the air: the ball leaves `from` at `release` and flies straight
   * to `to` at `catch`, whatever beats other players add in between.
   */
  readonly flights: {
    from: PlayerId;
    to: PlayerId;
    release: number;
    catch: number;
  }[] = [];

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

  lift(t: number, lift: number): void {
    const time = roundTime(t);
    this.times.add(time);
    this.lifts.set(time, lift);
  }

  pin(t: number, id: PlayerId): void {
    this.pinned.set(roundTime(t), id);
  }

  pass(from: PlayerId, to: PlayerId, release: number, catchAt: number): void {
    this.hold(release, from);
    this.hold(catchAt, to);
    this.flights.push({
      from,
      to,
      release: roundTime(release),
      catch: roundTime(catchAt),
    });
  }

  beat(t: number): void {
    this.times.add(roundTime(t));
  }
}

/** A substitution run: everyone holds, then walks, arriving here. */
const SUB_WALK_START = 0.1;
const SUB_ARRIVE_BEAT = 0.85;

/**
 * Choreography of a run of substitutions revealed as one step: incoming
 * players walk from their bench seat to their floor spot, outgoing players
 * from their floor spot to their seat, and everyone else holds still. It
 * goes from the frame at the run's start (or `from`, when playback began
 * inside the run) to the frame after its last substitution, so it always lands
 * on the same frames as scrubbing. Dead ball: the ball stays where it is.
 */
function subRunChoreography(
  view: WatchGameView,
  index: number,
  from: number | undefined,
): PlayChoreography {
  const runStart = subRunStart(view, index);
  const startAt =
    from !== undefined && from >= runStart && from <= index ? from : runStart;
  const before = buildFullCourtFrame(view, startAt);
  const after = buildFullCourtFrame(view, subRunEnd(view, index));
  const spotsOf = (frame: FullCourtFrame) =>
    new Map<PlayerId, FullCourtPoint>([
      ...frame.players.map((p) => [p.playerId, p.spot] as const),
      ...frame.bench.map((b) => [b.playerId, b.spot] as const),
    ]);
  const fromSpots = spotsOf(before);
  const toSpots = spotsOf(after);
  const beats = [0, SUB_WALK_START, SUB_ARRIVE_BEAT, 1];
  const tracks = [
    ...after.players.map((p) => ({ playerId: p.playerId, side: p.side })),
    ...after.bench.map((b) => ({ playerId: b.playerId, side: b.side })),
  ].map(({ playerId, side }) => {
    const a = fromSpots.get(playerId) ?? toSpots.get(playerId)!;
    const b = toSpots.get(playerId) ?? a;
    return { playerId, side, points: [a, a, b, b] };
  });
  const ballAt = (ball: FullCourtFrame["ball"]): ChoreoBall => ({
    at: ball.at,
    holderId: ball.holderId,
    lift: 0,
  });
  return {
    index: startAt,
    beats,
    tracks,
    ball: [
      ballAt(before.ball),
      ballAt(before.ball),
      ballAt(before.ball),
      ballAt(after.ball),
    ],
    legs: ["loose", "loose", "loose"],
    eventAt: SUB_ARRIVE_BEAT,
    deadBall: true,
  };
}

/**
 * Passes a field goal's action makes room for: the seeded swing passes, the
 * pass to the final passer and, on an assisted make, the assist. The chain
 * may use fewer (the handler can already be the final passer); the spare
 * time goes to sizing it up.
 */
export function plannedPasses(view: WatchGameView, index: number): number {
  const play = view.plays[index];
  if (!play || !FIELD_GOAL_KINDS.has(play.kind)) {
    return 0;
  }
  const swings = plannedSwings(view, index);
  const assisted = play.points > 0 && play.player2Id !== null;
  return swings + 1 + (assisted ? 1 : 0);
}

/** Swing passes before the final pass: the first draw of the play's stream. */
function plannedSwings(view: WatchGameView, index: number): number {
  const next = unitStream(courtSeed(view.gameId, index, SALT_CHOREO));
  return Math.floor(next() * (MAX_SWINGS + 1));
}

/**
 * Milliseconds at 1x of a field goal's action (without any bring-up): longer
 * with every pass, so each pass gets the same time in the air.
 */
export function fieldGoalActionMs(view: WatchGameView, index: number): number {
  return (
    FG_HANDLE_MS +
    plannedPasses(view, index) * FG_PASS_MS +
    FG_RISE_MS +
    FG_SHOT_FLIGHT_MS +
    FG_AFTER_MS
  );
}

/**
 * Timed beats for the play at `index` (the move from `revealed = index` to
 * `index + 1`); null for indices outside the log. A substitution index gives
 * the choreography of its whole run of substitutions instead (see
 * `subRunChoreography`).
 */
export function buildPlayChoreography(
  view: WatchGameView,
  index: number,
  options: {
    /** Share of the play spent bringing the ball up on a new end (0..1). */
    openerShare?: number;
    /** Share of the play spent on the jump ball when it is the tip (0..1). */
    tipShare?: number;
    /**
     * Substitutions only: revealed count the walk starts from when playback
     * began inside the run (default: the start of the run).
     */
    subFrom?: number;
  } = {},
): PlayChoreography | null {
  const play = view.plays[index];
  if (!play) {
    return null;
  }
  if (play.kind === "substitution") {
    return subRunChoreography(view, index, options.subFrom);
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
  const restart = to.restart;
  const opener = opensAtNewEnd(view, index) && transition !== null;
  // A dead-ball inbound at the same end has no bring-up, but still opens.
  const opening = opener || restart?.kind === "sideline";
  const share = opening
    ? Math.min(0.85, Math.max(0.1, options.openerShare ?? OPENER_SHARE))
    : 0;
  const tipping = opener && restart?.kind === "tip";
  const tipEnd = tipping
    ? Math.min(share * 0.9, Math.max(0, options.tipShare ?? share * 0.5))
    : 0;
  const at = (u: number) => share + u * (1 - share);

  // Where the action starts: the set-up after an opening, the previous frame
  // otherwise.
  const start = (id: PlayerId): FullCourtPoint =>
    (opening ? setUp.get(id) : fromSpot.get(id)) ?? toSpot.get(id) ?? hoop;
  const start0 = (id: PlayerId): FullCourtPoint =>
    fromSpot.get(id) ?? toSpot.get(id) ?? hoop;
  const startHolder: PlayerId | null = opening
    ? before.ball.holderId
    : from.ball.holderId;

  const script = new Script();
  // Unkeyed players reach their end spot at this action time (fouls and free
  // throws freeze).
  let settle = 1;
  let eventAt = 1;
  let deadBall = false;
  const actors = new Set<PlayerId>();

  if (opening) {
    // Open the possession. The ball reaches the handler by a tip (game
    // start), an inbound (after a make, a whistle or at a period start) or an
    // outlet pass (after a rebound or steal), and he dribbles into the set-up
    // as the action starts.
    const handler = onFloor(before.ball.holderId) ? before.ball.holderId : null;
    const setUpAt =
      (handler ? setUp.get(handler) : undefined) ??
      transition?.[transition.length - 1] ??
      hoop;
    const inbound =
      restart && restart.kind !== "tip"
        ? restart.at
        : transition && transition.length >= 4
          ? transition[1]!
          : null;
    let midcourt =
      transition && transition.length >= 3
        ? transition[transition.length - 2]!
        : null;
    let fromHolder = from.ball.holderId;
    const t = (f: number) => tipEnd + (share - tipEnd) * f;

    if (tipping) {
      // The ball goes up at centre and the possession's team tips it to a
      // teammate: the handler, or someone else when he is the jumper.
      const ownJumper = jumpBall(view)?.jumpers[offense] ?? null;
      const pool = offenseIds.filter(
        (id) => id !== ownJumper && id !== handler,
      );
      const pick = unitStream(courtSeed(view.gameId, index, SALT_TIP))();
      const catcher =
        handler && handler !== ownJumper
          ? handler
          : (pool[Math.floor(pick * pool.length)] ?? handler);
      const up = tipEnd * TIP_UP_BEAT;
      script.hold(up, null, from.ball.at);
      script.lift(up, 1);
      if (catcher) {
        const caught = tipEnd * TIP_CATCH_BEAT;
        script.key(catcher, caught, start0(catcher));
        script.hold(caught, catcher);
        script.key(catcher, tipEnd, start0(catcher));
        script.hold(tipEnd, catcher);
        actors.add(catcher);
      } else {
        script.hold(tipEnd, null, from.ball.at);
      }
      fromHolder = catcher ?? null;
      if (handler) {
        midcourt = lerp(start0(handler), setUpAt, TIP_MIDCOURT_STEP);
      }
    }

    if (handler && inbound) {
      const mid = midcourt ?? lerp(inbound, setUpAt, INBOUND_MID_STEP);
      const inbounder = offenseIds
        .filter((id) => id !== handler)
        .map((id) => ({ id, d: feetBetween(start0(id), inbound) }))
        .sort((a, b) => a.d - b.d)[0]?.id;
      const catchAt = lerp(inbound, mid, INBOUND_CATCH_STEP);
      if (inbounder) {
        script.key(inbounder, t(INBOUND_BEAT), inbound);
        script.hold(t(INBOUND_BEAT), inbounder);
        script.key(inbounder, t(INBOUND_CATCH_BEAT), inbound);
        script.key(
          inbounder,
          t(MIDCOURT_AFTER_MAKE),
          lerp(inbound, start(inbounder), INBOUNDER_TRAIL),
        );
        actors.add(inbounder);
      } else {
        script.hold(t(INBOUND_BEAT), null, inbound);
      }
      script.key(handler, t(INBOUND_CATCH_BEAT), catchAt);
      script.hold(t(INBOUND_CATCH_BEAT), handler);
      script.key(handler, t(MIDCOURT_AFTER_MAKE), mid);
      script.hold(t(MIDCOURT_AFTER_MAKE), handler);
    } else if (handler && midcourt) {
      if (fromHolder !== handler) {
        // Outlet: a teammate's pass, or a loose ball he picks up.
        const outlet = lerp(start0(handler), midcourt, OUTLET_STEP);
        script.key(handler, t(OUTLET_BEAT), outlet);
        script.hold(t(OUTLET_BEAT), handler);
      }
      script.key(handler, t(MIDCOURT_BEAT), midcourt);
      script.hold(t(MIDCOURT_BEAT), handler);
    } else if (!handler && transition) {
      for (let j = 1; j < transition.length; j += 1) {
        script.hold(t(j / (transition.length - 1)), null, transition[j]!);
      }
    }
    if (handler) {
      script.key(handler, share, setUpAt);
      script.hold(share, handler);
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
    // Lay the action out in milliseconds: each pass gets a fixed window
    // ending on the catch, the ball in the air for most of it, then the
    // shooter rises and shoots. Unused planned passes become time on the ball
    // before the first one.
    const actionMs = fieldGoalActionMs(view, index);
    const u = (ms: number) => at(Math.min(1, ms / actionMs));
    const spare = Math.max(0, plannedPasses(view, index) - chain.length);
    const chainStart = FG_HANDLE_MS + spare * FG_PASS_MS;
    // Roughly where a player stands during the action, to size a pass.
    const midAction = (id: PlayerId) =>
      lerp(start(id), toSpot.get(id) ?? start(id), 0.5);
    const flightMs = (from: PlayerId, to: PlayerId) =>
      Math.min(
        PASS_FLIGHT_MAX_MS,
        Math.max(
          PASS_FLIGHT_MIN_MS,
          (feetBetween(midAction(from), midAction(to)) / PASS_FEET_PER_SECOND) *
            1000,
        ),
      );
    let passer: PlayerId | null = first;
    let assistFlightMs = PASS_FLIGHT_MIN_MS;
    chain.forEach((id, j) => {
      const catchMs = chainStart + (j + 1) * FG_PASS_MS;
      if (passer !== null) {
        const flight = flightMs(passer, id);
        assistFlightMs = flight;
        script.pass(passer, id, u(catchMs - flight), u(catchMs));
      } else {
        // A loose ball picked up: no pass to fly.
        script.hold(u(catchMs), id);
      }
      passer = id;
    });
    const lastCatchMs = chainStart + chain.length * FG_PASS_MS;
    const releaseMs = lastCatchMs + FG_RISE_MS;
    const rimMs = releaseMs + FG_SHOT_FLIGHT_MS;
    if (to.lastPlay?.cut && assister !== null) {
      // The shooter cuts while the assist is in the air.
      script.key(shooterId, u(lastCatchMs - assistFlightMs), to.lastPlay.cut);
    }
    const shooterAt = toSpot.get(shooterId) ?? hoop;
    script.key(shooterId, u(releaseMs), shooterAt);
    script.hold(u(releaseMs), shooterId);
    const blocker =
      to.lastPlay?.outcome === "blocked" && onFloor(play.player2Id)
        ? play.player2Id
        : null;
    if (blocker) {
      // The shooter rises and releases, the blocker closes out and meets the
      // ball a few feet in front of him, then the ball is swatted away.
      const reach = feetBetween(shooterAt, hoop);
      const contact = lerp(
        shooterAt,
        hoop,
        reach < 1e-6 ? 0 : Math.min(0.9, BLOCK_CONTACT_FEET / reach),
      );
      const contactAt = u(releaseMs + FG_BLOCK_SHARE * FG_SHOT_FLIGHT_MS);
      script.key(blocker, contactAt, contact);
      script.pin(contactAt, blocker);
      script.hold(contactAt, null, contact);
      script.lift(contactAt, BLOCK_LIFT);
      script.hold(u(rimMs), null, to.ball.at);
      script.lift(u(rimMs), 0);
      script.lift(1, 0);
      eventAt = contactAt;
    } else {
      script.hold(u(rimMs), null, to.ball.at);
      eventAt = u(rimMs);
    }
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
    script.hold(at(RIM_BEAT), null, to.ball.at);
    eventAt = at(RIM_BEAT);
    // Both teams settle on the lane spots before the shot.
    settle = FT_LINEUP_BEAT;
    deadBall = true;
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
    eventAt = at(REBOUND_BEAT);
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
      // The handler's pass is cut off at the stealer's spot; the teammate
      // it was meant for drifts toward it and stops.
      const receiver = to.lastPlay?.receiverId ?? null;
      if (onFloor(receiver)) {
        script.key(
          receiver,
          at(STEAL_BEAT),
          lerp(start(receiver), toSpot.get(stealer)!, RECEIVER_STEP),
        );
        actors.add(receiver);
      }
    } else {
      // Out of bounds or a violation: the whistle stops play.
      script.hold(at(STEAL_BEAT), null, to.ball.at);
      deadBall = true;
    }
    eventAt = at(STEAL_BEAT);
  } else {
    // Fouls: everyone stops on the whistle and holds. An and-one comes
    // straight after the made shot, so the whistle is quicker.
    settle = isAndOne(view, index) ? AND_ONE_BEAT : WHISTLE_BEAT;
    script.beat(at(settle));
    script.hold(at(settle), to.ball.holderId, to.ball.at);
    eventAt = at(settle);
    deadBall = true;
  }

  return assemble(index, script, {
    from,
    to,
    hoop,
    offense,
    share,
    tipEnd,
    settle,
    actors,
    start,
    shot: SHOT_KINDS.has(play.kind),
    stealer: play.kind === "turnover" ? play.player2Id : null,
    eventAt,
    deadBall,
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
    /** End of the jump ball within the play (0 without one). */
    tipEnd: number;
    settle: number;
    actors: Set<PlayerId>;
    start: (id: PlayerId) => FullCourtPoint;
    /** The ball leaves a hand once, toward the rim: a shot or free throw. */
    shot: boolean;
    /** The logged stealer: the only way the ball changes hands across teams. */
    stealer: PlayerId | null;
    eventAt: number;
    deadBall: boolean;
  },
): PlayChoreography {
  const { from, to, hoop, offense, share, settle } = ctx;
  const beats = [...script.times].sort((a, b) => a - b);
  const last = beats.length - 1;
  const fromSpot = new Map(from.players.map((p) => [p.playerId, p.spot]));

  // Unkeyed motion: run the floor to the set-up during the opener, then
  // set-up to the end spot over the action (reached at `settle`).
  const slotOf = new Map(to.players.map((p) => [p.playerId, p.slot % 5]));
  const base = (id: PlayerId, endSpot: FullCourtPoint, t: number) => {
    const fromAt = fromSpot.get(id) ?? endSpot;
    const setUp = ctx.start(id);
    if (share > 0 && t <= share) {
      const f = t <= ctx.tipEnd ? 0 : (t - ctx.tipEnd) / (share - ctx.tipEnd);
      if (to.players.find((p) => p.playerId === id)?.side === offense) {
        const pace = LANE_PACE[slotOf.get(id) ?? 0]!;
        return {
          x: fromAt.x + (setUp.x - fromAt.x) * (1 - (1 - f) ** pace),
          y: fromAt.y + (setUp.y - fromAt.y) * (1 - (1 - f) ** LANE_WIDEN),
        };
      }
      const back = lerp(fromAt, setUp, 1 - (1 - f) ** SPRINT_BACK);
      return lerp(back, hoop, SAG_TO_RIM * Math.sin(Math.PI * f));
    }
    const u = share >= 1 ? 1 : (t - share) / (1 - share);
    return lerp(setUp, endSpot, Math.min(1, u / settle));
  };

  // A keyed player moves straight between his own keys (and the frame and
  // set-up anchors) instead of snapping back to the unkeyed path.
  const anchorsOf = (id: PlayerId, endSpot: FullCourtPoint) => {
    const keys = script.keys.get(id);
    if (!keys) {
      return null;
    }
    const anchors = new Map<number, FullCourtPoint>([
      [0, fromSpot.get(id) ?? endSpot],
      [1, endSpot],
    ]);
    if (share > 0) {
      anchors.set(roundTime(share), ctx.start(id));
    }
    for (const [t, at] of keys) {
      anchors.set(t, at);
    }
    return [...anchors].sort((a, b) => a[0] - b[0]);
  };
  const between = (anchors: [number, FullCourtPoint][], t: number) => {
    for (let i = 1; i < anchors.length; i += 1) {
      const [t1, p1] = anchors[i]!;
      if (t <= t1) {
        const [t0, p0] = anchors[i - 1]!;
        return lerp(p0, p1, t1 > t0 ? (t - t0) / (t1 - t0) : 1);
      }
    }
    return anchors[anchors.length - 1]![1];
  };

  // From the whistle on, everyone stands on his end spot.
  const frozenFrom = settle < 1 ? roundTime(share + settle * (1 - share)) : 2;
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
    const anchors = anchorsOf(player.playerId, endSpot);
    const points = beats.map((t, k) => {
      if (k === 0) {
        return fromSpot.get(player.playerId) ?? endSpot;
      }
      if (k === last || t >= frozenFrom) {
        return endSpot;
      }
      const keyed = keyedAt(player.playerId, t);
      if (keyed) {
        return keyed;
      }
      if (anchors) {
        return between(anchors, t);
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

  // A pass in the air belongs to nobody between its release and catch, even
  // across beats other players add (their keys used to shorten the flight).
  const flights = script.flights.flatMap((flight) => {
    const r = beats.indexOf(flight.release);
    const c = beats.indexOf(flight.catch);
    return r >= 0 &&
      c > r &&
      positions.has(flight.from) &&
      positions.has(flight.to)
      ? [{ ...flight, r, c }]
      : [];
  });
  for (const flight of flights) {
    for (let k = flight.r + 1; k < flight.c; k += 1) {
      holders[k] = null;
    }
  }

  // Keep tokens apart at the inner beats; the ball holder stays put. A
  // frozen beat is the end frame already, so nobody is nudged off it.
  const order = ordered.map((p) => p.playerId);
  for (let k = 1; k < last; k += 1) {
    if (beats[k]! >= frozenFrom) {
      break;
    }
    const held = holders[k];
    const pinned = script.pinned.get(beats[k]!);
    spaceOut(
      order.map((id) => positions.get(id)!),
      k,
      held !== null && held !== undefined
        ? order.indexOf(held)
        : pinned !== undefined
          ? order.indexOf(pinned)
          : -1,
    );
  }

  // The ball flies straight from the passer's hand to the catcher's.
  for (const flight of flights) {
    const a = positions.get(flight.from)![flight.r]!;
    const b = positions.get(flight.to)![flight.c]!;
    for (let k = flight.r + 1; k < flight.c; k += 1) {
      looseAt[k] = lerp(
        a,
        b,
        (beats[k]! - flight.release) / (flight.catch - flight.release),
      );
    }
  }

  const ball: ChoreoBall[] = beats.map((_, k) => {
    const id = holders[k]!;
    const spot =
      k === 0 || k === last || id === null
        ? looseAt[k]!
        : positions.get(id)![k]!;
    return withLift(spot, id, hoop, script.lifts.get(beats[k]!));
  });

  const sideOf = new Map(to.players.map((p) => [p.playerId, p.side]));
  const legs: ChoreoLeg[] = [];
  for (let k = 0; k < last; k += 1) {
    const a = ball[k]!;
    const b = ball[k + 1]!;
    const flight = flights.find((f) => f.r <= k && k + 1 <= f.c);
    if (flight) {
      legs.push(
        sideOf.get(flight.from) === sideOf.get(flight.to)
          ? "pass"
          : flight.to === ctx.stealer
            ? "steal"
            : "loose",
      );
    } else if (a.holderId !== null && b.holderId === a.holderId) {
      legs.push("carry");
    } else if (a.holderId !== null && b.holderId !== null) {
      legs.push(
        sideOf.get(a.holderId) === sideOf.get(b.holderId)
          ? "pass"
          : b.holderId === ctx.stealer
            ? "steal"
            : "loose",
      );
    } else if (a.holderId !== null && ctx.shot && !legs.includes("shot")) {
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
    eventAt: roundTime(ctx.eventAt),
    deadBall: ctx.deadBall,
  };

  function withLift(
    spot: FullCourtPoint,
    holderId: PlayerId | null,
    rim: FullCourtPoint,
    lifted?: number,
  ): ChoreoBall {
    const atRim = holderId === null && feetBetween(spot, rim) < 1;
    return { at: spot, holderId, lift: lifted ?? (atRim ? 1 : 0) };
  }
}

function clampToFloor(point: { x: number; y: number }, L: number, W: number) {
  point.x = Math.min(L - MARGIN_FEET, Math.max(MARGIN_FEET, point.x));
  point.y = Math.min(W - MARGIN_FEET, Math.max(MARGIN_FEET, point.y));
}

/**
 * A token against the floor margin that is still too close to `other` moves
 * along the margin to the point exactly the minimum spacing away.
 */
function slideAlongWall(
  mover: { x: number; y: number },
  other: { x: number; y: number },
  L: number,
  W: number,
): void {
  const r = CHOREO_MIN_SPACING_FEET + 0.02;
  if (
    Math.hypot(mover.x - other.x, mover.y - other.y) >= CHOREO_MIN_SPACING_FEET
  ) {
    return;
  }
  const onY = mover.y <= MARGIN_FEET || mover.y >= W - MARGIN_FEET;
  const onX = mover.x <= MARGIN_FEET || mover.x >= L - MARGIN_FEET;
  if (onY) {
    const across = Math.sqrt(Math.max(0, r * r - (mover.y - other.y) ** 2));
    const dir = mover.x >= other.x ? 1 : -1;
    mover.x = other.x + dir * across;
    if (mover.x < MARGIN_FEET || mover.x > L - MARGIN_FEET) {
      mover.x = other.x - dir * across;
    }
  } else if (onX) {
    const across = Math.sqrt(Math.max(0, r * r - (mover.x - other.x) ** 2));
    const dir = mover.y >= other.y ? 1 : -1;
    mover.y = other.y + dir * across;
    if (mover.y < MARGIN_FEET || mover.y > W - MARGIN_FEET) {
      mover.y = other.y - dir * across;
    }
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
  // The fixed token stays where it is, even on the line (an inbounder); the
  // others start on the floor so the checks below see where they will stand.
  feet.forEach((point, i) => {
    if (i !== fixed) {
      clampToFloor(point, L, W);
    }
  });
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
        // A token pushed into the boundary slides along it instead of
        // staying too close.
        for (const [mover, other, share] of [
          [a, b, shareA],
          [b, a, 1 - shareA],
        ] as const) {
          if (share > 0) {
            clampToFloor(mover, L, W);
            slideAlongWall(mover, other, L, W);
          }
        }
        moved = true;
      }
    }
    feet.forEach((point, i) => {
      if (i !== fixed) {
        clampToFloor(point, L, W);
      }
    });
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
