import {
  createPossession,
  type Possession,
  type PossessionAction,
  type PossessionOutcome,
} from "@/domain/entities/possession";
import { RATING_MAX, RATING_MIN, type Player } from "@/domain/entities/player";
import type { GameEvent } from "@/domain/entities/game";
import { PLAY_CODE } from "@/domain/entities/play-by-play";
import type { PlayerId, PossessionId, TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import {
  resolvePossessionDecision,
  type PossessionDecision,
  type ResolvedPossessionDecision,
} from "@/systems/possession-decision";
import {
  resolveFoul,
  type FoulResolution,
  type FoulRules,
} from "@/systems/foul-resolution";
import {
  resolveFreeThrow,
  type FreeThrowResult,
} from "@/systems/free-throw-resolution";
import { resolvePass, type PassResolution } from "@/systems/pass-resolution";
import {
  DIRECT_SHOT_ASSIST_CONFIG,
  STEAL_CREDIT_CONFIG,
} from "@/systems/pass-resolution-config";
import { pickMatchedDefender } from "@/systems/defensive-matchups";
import {
  buildOffensiveUsageProfiles,
  pickWeightedPlayer,
} from "@/systems/player-usage";
import {
  resolveRebound,
  type ReboundResult,
} from "@/systems/rebound-resolution";
import {
  blockProbability,
  resolveShot,
  type ShotResolution,
} from "@/systems/shot-resolution";
import type { ShotType } from "@/systems/shot-resolution-config";
import {
  addAssist,
  addBlock,
  addFieldGoal,
  addFoul,
  addFreeThrow,
  addPoints,
  addRebound,
  addSteal,
  addTouch,
  addTurnover,
  createPossessionStatsAccumulator,
  fieldGoalPoints,
  finalizePlayerStatsDeltas,
  pushEvent,
  pushPlay,
  type PlayerStatsDelta,
  type PossessionPlay,
  type PossessionStatsAccumulator,
} from "@/systems/possession-stats";

export type {
  PossessionDecision,
  ResolvedPossessionDecision,
} from "@/systems/possession-decision";
export {
  applyPossessionResolution,
  type PlayerStatsDelta,
} from "@/systems/possession-stats";

export type ResolvePossessionInput = {
  possessionId: PossessionId;
  offensiveTeamId: TeamId;
  defensiveTeamId: TeamId;
  offensivePlayers: readonly Player[];
  defensivePlayers: readonly Player[];
  /** Defensive team's team-foul count before this possession; integer >= 0. */
  defensiveTeamFoulsBefore: number;
  decision: PossessionDecision;
  eventSequenceStart?: number;
  fatigue?: number;
  /** True when the offensive team is the home team (home-court shot bonus). */
  offenseIsHome?: boolean;
  /** Offense score minus defense score before this possession. */
  offenseScoreMargin?: number;
  foulRules?: FoulRules;
  /**
   * Already-derived defensive pressure multiplier (coaching).
   * Applied to perimeterDefense before resolvePass; defaults to 1 (no-op).
   */
  defensivePressureMultiplier?: number;
  /**
   * Passer of a completed pass on the previous step that kept the ball
   * (`continuingPasserId` of that resolution). Preferred assister when a
   * made direct shot is assisted.
   */
  assistPasserId?: PlayerId | null;
  /**
   * When true, also returns play-by-play rows in `plays`. Recording draws no
   * random numbers, so results are identical either way.
   */
  recordPlays?: boolean;
};

export type PossessionStep =
  | { type: "shot"; result: ShotResolution }
  | { type: "pass"; result: PassResolution }
  | { type: "rebound"; result: ReboundResult }
  | { type: "foul"; result: FoulResolution }
  | { type: "free_throw"; result: FreeThrowResult };

export type NextPossession = {
  offensiveTeamId: TeamId;
  defensiveTeamId: TeamId;
};

export type PossessionResolution = {
  possession: Possession;
  steps: PossessionStep[];
  events: GameEvent[];
  /** Play-by-play rows; null unless `recordPlays` was set. */
  plays: PossessionPlay[] | null;
  playerStats: PlayerStatsDelta[];
  pointsScored: number;
  scoringTeamId: TeamId | null;
  defensiveTeamFoulsAfter: number;
  nextPossession: NextPossession;
  /** Passer when a completed pass kept the ball with no shot; else null. */
  continuingPasserId: PlayerId | null;
};

type ExecutionContext = {
  input: ResolvePossessionInput;
  rng: Rng;
  fatigue: number;
  resolved: ResolvedPossessionDecision;
  steps: PossessionStep[];
  stats: PossessionStatsAccumulator;
  defensiveTeamFoulsAfter: number;
  nextPossession: NextPossession;
  possessionAction: PossessionAction;
  possessionOutcome: PossessionOutcome;
  primaryOffensivePlayerId: PlayerId;
  primaryDefensivePlayerId: PlayerId | null;
};

/**
 * Resolves one possession by composing existing resolution building blocks.
 * Does not mutate GameState. Does not contain basketball probability formulas.
 */
export function resolvePossession(
  input: ResolvePossessionInput,
  rng: Rng,
): PossessionResolution {
  if (rng == null) {
    throw new Error("Possession resolution requires an Rng.");
  }

  validatePossessionContext(input);

  const fatigue = input.fatigue ?? 0;
  const eventSequenceStart = input.eventSequenceStart ?? 0;

  const resolved = resolvePossessionDecision(input.decision, {
    offensiveTeamId: input.offensiveTeamId,
    defensiveTeamId: input.defensiveTeamId,
    offensivePlayers: input.offensivePlayers,
    defensivePlayers: input.defensivePlayers,
  });

  const ctx: ExecutionContext = {
    input,
    rng,
    fatigue,
    resolved,
    steps: [],
    stats: createPossessionStatsAccumulator(
      eventSequenceStart,
      input.recordPlays === true,
    ),
    defensiveTeamFoulsAfter: input.defensiveTeamFoulsBefore,
    nextPossession: {
      offensiveTeamId: input.offensiveTeamId,
      defensiveTeamId: input.defensiveTeamId,
    },
    possessionAction: input.decision.action,
    possessionOutcome: "turnover",
    primaryOffensivePlayerId: input.offensivePlayers[0]!.id,
    primaryDefensivePlayerId: null,
  };

  switch (input.decision.action) {
    case "shot":
      resolveShotBranch(ctx);
      break;
    case "pass":
      resolvePassBranch(ctx);
      break;
    case "turnover":
      resolveTurnoverBranch(ctx);
      break;
    case "foul":
      resolveFoulBranch(ctx);
      break;
    case "free_throw":
      resolveFreeThrowBranch(ctx);
      break;
  }

  const pointsScored = ctx.stats.pointsScored;
  const scoringTeamId = pointsScored > 0 ? input.offensiveTeamId : null;

  const possession = createPossession({
    id: input.possessionId,
    offensivePlayerId: ctx.primaryOffensivePlayerId,
    defensivePlayerId: ctx.primaryDefensivePlayerId,
    action: ctx.possessionAction,
    outcome: ctx.possessionOutcome,
  });

  return {
    possession,
    steps: ctx.steps,
    events: ctx.stats.events.map((event) => ({ ...event })),
    plays: ctx.stats.plays,
    playerStats: finalizePlayerStatsDeltas(ctx.stats),
    pointsScored,
    scoringTeamId,
    defensiveTeamFoulsAfter: ctx.defensiveTeamFoulsAfter,
    nextPossession: { ...ctx.nextPossession },
    continuingPasserId:
      ctx.possessionOutcome === "pass_completed" &&
      !ctx.steps.some((step) => step.type === "shot")
        ? ctx.resolved.passer!.id
        : null,
  };
}

function validatePossessionContext(input: ResolvePossessionInput): void {
  if (input == null || typeof input !== "object") {
    throw new Error("Possession resolution requires input.");
  }
  if (
    typeof input.possessionId !== "string" ||
    input.possessionId.length === 0
  ) {
    throw new Error("Possession possessionId must be a non-empty string.");
  }
  if (
    typeof input.offensiveTeamId !== "string" ||
    input.offensiveTeamId.length === 0
  ) {
    throw new Error("Possession offensiveTeamId must be a non-empty string.");
  }
  if (
    typeof input.defensiveTeamId !== "string" ||
    input.defensiveTeamId.length === 0
  ) {
    throw new Error("Possession defensiveTeamId must be a non-empty string.");
  }
  if (input.offensiveTeamId === input.defensiveTeamId) {
    throw new Error(
      "Possession offensiveTeamId and defensiveTeamId must be different.",
    );
  }
  if (
    !Array.isArray(input.offensivePlayers) ||
    input.offensivePlayers.length === 0
  ) {
    throw new Error("Possession offensivePlayers must be a non-empty array.");
  }
  if (
    !Array.isArray(input.defensivePlayers) ||
    input.defensivePlayers.length === 0
  ) {
    throw new Error("Possession defensivePlayers must be a non-empty array.");
  }
  assertPoolTeamIds(
    input.offensivePlayers,
    input.offensiveTeamId,
    "offensivePlayers",
  );
  assertPoolTeamIds(
    input.defensivePlayers,
    input.defensiveTeamId,
    "defensivePlayers",
  );
  if (
    !Number.isInteger(input.defensiveTeamFoulsBefore) ||
    input.defensiveTeamFoulsBefore < 0
  ) {
    throw new Error(
      "Possession defensiveTeamFoulsBefore must be a non-negative integer.",
    );
  }
  if (input.fatigue !== undefined) {
    if (
      typeof input.fatigue !== "number" ||
      !Number.isFinite(input.fatigue) ||
      input.fatigue < 0 ||
      input.fatigue > 1
    ) {
      throw new Error("Possession fatigue must be a finite number in [0, 1].");
    }
  }
  if (input.eventSequenceStart !== undefined) {
    if (
      !Number.isInteger(input.eventSequenceStart) ||
      input.eventSequenceStart < 0
    ) {
      throw new Error(
        "Possession eventSequenceStart must be a non-negative integer.",
      );
    }
  }
}

function assertPoolTeamIds(
  players: readonly Player[],
  teamId: TeamId,
  field: string,
): void {
  const seen = new Set<string>();
  for (let index = 0; index < players.length; index += 1) {
    const player = players[index]!;
    if (player.teamId !== teamId) {
      throw new Error(
        `Possession ${field}[${index}] must belong to team ${teamId}.`,
      );
    }
    if (seen.has(player.id)) {
      throw new Error(
        `Possession ${field} must not contain duplicate player IDs.`,
      );
    }
    seen.add(player.id);
  }
}

function resolveShotBranch(ctx: ExecutionContext): void {
  const decision = ctx.input.decision;
  if (decision.action !== "shot") {
    throw new Error("Internal error: expected shot decision.");
  }
  const shooter = ctx.resolved.shooter!;
  const defender = ctx.resolved.defender!;
  ctx.primaryOffensivePlayerId = shooter.id;
  ctx.primaryDefensivePlayerId = defender.id;
  ctx.possessionAction = "shot";

  const shot = resolveShot(
    {
      shooter,
      defender,
      shotType: decision.shotType,
      fatigue: ctx.fatigue,
      homeCourt: ctx.input.offenseIsHome === true,
      scoreMargin: ctx.input.offenseScoreMargin,
    },
    ctx.rng,
  );
  ctx.steps.push({ type: "shot", result: shot });
  addTouch(ctx.stats, shooter.id);

  if (shot.made) {
    const points = fieldGoalPoints(decision.shotType);
    addFieldGoal(ctx.stats, shooter.id, decision.shotType, true);
    addPoints(ctx.stats, shooter.id, points);
    pushEvent(ctx.stats, "shot_made", shooter.id, ctx.input.offensiveTeamId);
    const assisterId = maybeCreditDirectShotAssist(ctx, shooter);
    pushShotPlay(ctx, decision.shotType, true, shooter.id, assisterId);
    ctx.possessionOutcome = "shot_made";
    flipPossession(ctx);
    return;
  }

  addFieldGoal(ctx.stats, shooter.id, decision.shotType, false);
  pushEvent(ctx.stats, "shot_missed", shooter.id, ctx.input.offensiveTeamId);
  ctx.possessionOutcome = "shot_missed";
  const blockerId = maybeCreditBlock(ctx, defender, decision.shotType);
  pushShotPlay(ctx, decision.shotType, false, shooter.id, blockerId);
  resolveReboundAfterMiss(ctx);
}

function resolvePassBranch(ctx: ExecutionContext): void {
  const decision = ctx.input.decision;
  if (decision.action !== "pass") {
    throw new Error("Internal error: expected pass decision.");
  }
  const passer = ctx.resolved.passer!;
  const receiver = ctx.resolved.receiver!;
  const defender = ctx.resolved.defender!;
  ctx.primaryOffensivePlayerId = passer.id;
  ctx.primaryDefensivePlayerId = defender.id;

  const pass = resolvePass(
    {
      passer,
      receiver,
      defensivePressure: clampDefensivePressure(
        defender.attributes.perimeterDefense *
          (ctx.input.defensivePressureMultiplier ?? 1),
      ),
    },
    ctx.rng,
  );
  ctx.steps.push({ type: "pass", result: pass });
  addTouch(ctx.stats, passer.id);

  if (pass.outcome === "turnover") {
    addTurnover(ctx.stats, passer.id);
    pushEvent(ctx.stats, "turnover", passer.id, ctx.input.offensiveTeamId);
    const stealerId = maybeCreditSteal(
      ctx,
      defender,
      passer,
      STEAL_CREDIT_CONFIG.passTurnoverBase,
    );
    pushPlay(
      ctx.stats,
      PLAY_CODE.turnover,
      passer.id,
      stealerId,
      ctx.input.offensiveTeamId,
    );
    ctx.possessionAction = "turnover";
    ctx.possessionOutcome = "turnover";
    flipPossession(ctx);
    return;
  }

  ctx.possessionAction = "pass";
  ctx.possessionOutcome = "pass_completed";
  addTouch(ctx.stats, receiver.id);

  if (!pass.assistOpportunity) {
    // Possession continues; no shot in this call.
    return;
  }

  const shotType = catchAndShootType(receiver);
  const shot = resolveShot(
    {
      shooter: receiver,
      defender,
      shotType,
      fatigue: ctx.fatigue,
      homeCourt: ctx.input.offenseIsHome === true,
      scoreMargin: ctx.input.offenseScoreMargin,
    },
    ctx.rng,
  );
  ctx.steps.push({ type: "shot", result: shot });
  ctx.primaryOffensivePlayerId = receiver.id;
  // Receiver already credited on completed pass; no second touch.

  if (shot.made) {
    const points = fieldGoalPoints(shotType);
    addFieldGoal(ctx.stats, receiver.id, shotType, true);
    addPoints(ctx.stats, receiver.id, points);
    pushEvent(ctx.stats, "shot_made", receiver.id, ctx.input.offensiveTeamId);
    addAssist(ctx.stats, passer.id);
    pushEvent(ctx.stats, "assist", passer.id, ctx.input.offensiveTeamId);
    pushShotPlay(ctx, shotType, true, receiver.id, passer.id);
    flipPossession(ctx);
    return;
  }

  addFieldGoal(ctx.stats, receiver.id, shotType, false);
  pushEvent(ctx.stats, "shot_missed", receiver.id, ctx.input.offensiveTeamId);
  const blockerId = maybeCreditBlock(ctx, defender, shotType);
  pushShotPlay(ctx, shotType, false, receiver.id, blockerId);
  resolveReboundAfterMiss(ctx);
}

function resolveTurnoverBranch(ctx: ExecutionContext): void {
  const player = ctx.resolved.turnoverPlayer!;
  ctx.primaryOffensivePlayerId = player.id;
  ctx.primaryDefensivePlayerId = null;
  ctx.possessionAction = "turnover";
  ctx.possessionOutcome = "turnover";
  addTouch(ctx.stats, player.id);
  addTurnover(ctx.stats, player.id);
  pushEvent(ctx.stats, "turnover", player.id, ctx.input.offensiveTeamId);
  const defender = pickMatchedDefender(
    player,
    ctx.input.offensivePlayers,
    ctx.input.defensivePlayers,
    ctx.rng,
  );
  const stealerId = maybeCreditSteal(
    ctx,
    defender,
    player,
    STEAL_CREDIT_CONFIG.standaloneTurnoverBase,
  );
  pushPlay(
    ctx.stats,
    PLAY_CODE.turnover,
    player.id,
    stealerId,
    ctx.input.offensiveTeamId,
  );
  flipPossession(ctx);
}

function resolveFoulBranch(ctx: ExecutionContext): void {
  const decision = ctx.input.decision;
  if (decision.action !== "foul") {
    throw new Error("Internal error: expected foul decision.");
  }
  const fouler = ctx.resolved.fouler!;
  const fouled = ctx.resolved.fouled!;

  if (ctx.resolved.isOffensiveFoul) {
    ctx.primaryOffensivePlayerId = fouler.id;
    ctx.primaryDefensivePlayerId = fouled.id;
    ctx.possessionAction = "foul";
    ctx.possessionOutcome = "offensive_foul";
    addTouch(ctx.stats, fouler.id);
    addFoul(ctx.stats, fouler.id);
    pushEvent(ctx.stats, "foul", fouler.id, ctx.input.offensiveTeamId);
    pushPlay(
      ctx.stats,
      PLAY_CODE.offensiveFoul,
      fouler.id,
      fouled.id,
      ctx.input.offensiveTeamId,
    );
    flipPossession(ctx);
    return;
  }

  // Defensive foul
  ctx.primaryOffensivePlayerId = fouled.id;
  ctx.primaryDefensivePlayerId = fouler.id;
  ctx.possessionAction = "foul";

  if (decision.foul.foulType === "shooting") {
    const shotType = decision.shotType!;
    // resolveShot only feeds shotMade into resolveFoul — not a normal shot action.
    const shot = resolveShot(
      {
        shooter: fouled,
        defender: fouler,
        shotType,
        fatigue: ctx.fatigue,
        homeCourt: ctx.input.offenseIsHome === true,
        scoreMargin: ctx.input.offenseScoreMargin,
      },
      ctx.rng,
    );
    ctx.steps.push({ type: "shot", result: shot });

    const foulResult = resolveFoul({
      foul: decision.foul,
      teamFoulsBefore: ctx.input.defensiveTeamFoulsBefore,
      rules: ctx.input.foulRules,
      shotType,
      shotMade: shot.made,
    });
    ctx.steps.push({ type: "foul", result: foulResult });
    ctx.defensiveTeamFoulsAfter = foulResult.teamFoulsAfter;
    ctx.possessionOutcome = "shooting_foul";

    addFoul(ctx.stats, fouler.id);
    pushEvent(ctx.stats, "foul", fouler.id, ctx.input.defensiveTeamId);

    // Shooting foul credits the fouled shooter whether or not FGA is recorded;
    // if FGA is also recorded below, dedup keeps a single touch.
    addTouch(ctx.stats, fouled.id);
    // Only an and-one is a field-goal attempt; a fouled miss is not (NBA
    // scoring rules), so it adds no FGA and no shot row.
    if (foulResult.basketCounts) {
      addFieldGoal(ctx.stats, fouled.id, shotType, true);
      addPoints(ctx.stats, fouled.id, fieldGoalPoints(shotType));
      // The and-one has no shot GameEvent but counts as an FGA, so the play
      // log records it (shot row first, then the foul).
      pushShotPlay(ctx, shotType, true, fouled.id, null);
    }
    pushPlay(
      ctx.stats,
      PLAY_CODE.shootingFoul,
      fouler.id,
      fouled.id,
      ctx.input.defensiveTeamId,
    );

    resolveFreeThrowSequence(ctx, fouled, foulResult.freeThrowsAwarded);
    return;
  }

  const foulResult = resolveFoul({
    foul: decision.foul,
    teamFoulsBefore: ctx.input.defensiveTeamFoulsBefore,
    rules: ctx.input.foulRules,
  });
  ctx.steps.push({ type: "foul", result: foulResult });
  ctx.defensiveTeamFoulsAfter = foulResult.teamFoulsAfter;
  ctx.possessionOutcome = "non_shooting_foul";

  addFoul(ctx.stats, fouler.id);
  pushEvent(ctx.stats, "foul", fouler.id, ctx.input.defensiveTeamId);
  pushPlay(
    ctx.stats,
    PLAY_CODE.personalFoul,
    fouler.id,
    fouled.id,
    ctx.input.defensiveTeamId,
  );

  if (foulResult.freeThrowsAwarded > 0) {
    resolveFreeThrowSequence(ctx, fouled, foulResult.freeThrowsAwarded);
  }
  // else: offense retains possession (inbound)
}

function resolveFreeThrowBranch(ctx: ExecutionContext): void {
  const decision = ctx.input.decision;
  if (decision.action !== "free_throw") {
    throw new Error("Internal error: expected free_throw decision.");
  }
  const shooter = ctx.resolved.freeThrowShooter!;
  ctx.primaryOffensivePlayerId = shooter.id;
  ctx.primaryDefensivePlayerId = null;
  ctx.possessionAction = "free_throw";
  resolveFreeThrowSequence(ctx, shooter, decision.awarded);
}

/**
 * Resolves awarded free throws. Sets possession outcome for free_throw action
 * when this is the governing decision; for foul branches, leaves foul outcome.
 */
function resolveFreeThrowSequence(
  ctx: ExecutionContext,
  shooter: Player,
  awarded: number,
): void {
  if (awarded < 1) {
    return;
  }

  let anyMiss = false;
  let lastMade = false;

  for (let index = 0; index < awarded; index += 1) {
    const ft = resolveFreeThrow({ shooter }, ctx.rng);
    ctx.steps.push({ type: "free_throw", result: ft });
    pushEvent(ctx.stats, "free_throw", shooter.id, ctx.input.offensiveTeamId);
    addFreeThrow(ctx.stats, shooter.id, ft.made);
    pushPlay(
      ctx.stats,
      ft.made ? PLAY_CODE.freeThrowMade : PLAY_CODE.freeThrowMissed,
      shooter.id,
      null,
      ctx.input.offensiveTeamId,
    );
    if (ft.made) {
      addPoints(ctx.stats, shooter.id, 1);
      lastMade = true;
    } else {
      anyMiss = true;
      lastMade = false;
    }
  }

  if (ctx.possessionAction === "free_throw") {
    ctx.possessionOutcome = anyMiss ? "free_throw_missed" : "free_throw_made";
  }

  if (!lastMade) {
    resolveReboundAfterMiss(ctx);
    return;
  }

  flipPossession(ctx);
}

function resolveReboundAfterMiss(ctx: ExecutionContext): void {
  const rebound = resolveRebound(
    {
      offensivePlayers: ctx.input.offensivePlayers,
      defensivePlayers: ctx.input.defensivePlayers,
      offensiveTeamId: ctx.input.offensiveTeamId,
      defensiveTeamId: ctx.input.defensiveTeamId,
    },
    ctx.rng,
  );
  ctx.steps.push({ type: "rebound", result: rebound });
  addRebound(ctx.stats, rebound.playerId, rebound.type);
  pushEvent(ctx.stats, "rebound", rebound.playerId, rebound.teamId);
  pushPlay(
    ctx.stats,
    rebound.type === "offensive"
      ? PLAY_CODE.offensiveRebound
      : PLAY_CODE.defensiveRebound,
    rebound.playerId,
    null,
    rebound.teamId,
  );

  if (rebound.type === "offensive") {
    ctx.nextPossession = {
      offensiveTeamId: ctx.input.offensiveTeamId,
      defensiveTeamId: ctx.input.defensiveTeamId,
    };
    return;
  }

  flipPossession(ctx);
}

function flipPossession(ctx: ExecutionContext): void {
  ctx.nextPossession = {
    offensiveTeamId: ctx.input.defensiveTeamId,
    defensiveTeamId: ctx.input.offensiveTeamId,
  };
}

function catchAndShootType(receiver: Player): ShotType {
  const twoSkill =
    (receiver.attributes.finishing + receiver.attributes.midRange) / 2;
  if (
    receiver.attributes.threePoint >= 74 &&
    receiver.attributes.threePoint >= twoSkill
  ) {
    return "three_point";
  }
  return "two_point";
}

/**
 * Credits an assist on a made direct shot (see DIRECT_SHOT_ASSIST_CONFIG).
 * Draws one RNG value when the shooter has an on-court teammate, plus one
 * teammate pick when no continuing passer is eligible.
 */
function maybeCreditDirectShotAssist(
  ctx: ExecutionContext,
  shooter: Player,
): PlayerId | null {
  const teammates = ctx.input.offensivePlayers;
  if (teammates.length < 2) {
    return null;
  }
  if (!ctx.rng.chance(DIRECT_SHOT_ASSIST_CONFIG.directShotChance)) {
    return null;
  }
  const carriedId = ctx.input.assistPasserId;
  const assisterId =
    carriedId != null &&
    carriedId !== shooter.id &&
    teammates.some((player) => player.id === carriedId)
      ? carriedId
      : pickWeightedPlayer(
          buildOffensiveUsageProfiles(teammates),
          "passWeight",
          ctx.rng,
          shooter.id,
        ).id;
  addAssist(ctx.stats, assisterId);
  pushEvent(ctx.stats, "assist", assisterId, ctx.input.offensiveTeamId);
  return assisterId;
}

/**
 * Returns the credited stealer's id, or null when no steal is credited.
 * Draws one RNG value; the chance grows with the defender's steal rating
 * relative to the ball handler's handle.
 */
function maybeCreditSteal(
  ctx: ExecutionContext,
  defender: Player,
  ballHandler: Player,
  baseChance: number,
): PlayerId | null {
  const { skillImpact, minChance, maxChance } = STEAL_CREDIT_CONFIG;
  const chance = Math.min(
    maxChance,
    Math.max(
      minChance,
      baseChance +
        ((defender.attributes.steal - ballHandler.attributes.ballHandling) /
          RATING_MAX) *
          skillImpact,
    ),
  );
  if (!ctx.rng.chance(chance)) {
    return null;
  }
  addSteal(ctx.stats, defender.id);
  pushEvent(ctx.stats, "steal", defender.id, ctx.input.defensiveTeamId);
  return defender.id;
}

/**
 * Returns the credited blocker's id, or null when no block is credited.
 * Draws one RNG value only when the defender has a non-zero block chance.
 */
function maybeCreditBlock(
  ctx: ExecutionContext,
  defender: Player,
  shotType: ShotType,
): PlayerId | null {
  const probability = blockProbability(defender, shotType);
  if (probability > 0 && ctx.rng.chance(probability)) {
    addBlock(ctx.stats, defender.id);
    pushEvent(ctx.stats, "block", defender.id, ctx.input.defensiveTeamId);
    return defender.id;
  }
  return null;
}

/** `player2Id` is the assister on a make, the blocker on a miss. */
function pushShotPlay(
  ctx: ExecutionContext,
  shotType: ShotType,
  made: boolean,
  shooterId: PlayerId,
  player2Id: PlayerId | null,
): void {
  const code =
    shotType === "three_point"
      ? made
        ? PLAY_CODE.threeMade
        : PLAY_CODE.threeMissed
      : made
        ? PLAY_CODE.twoMade
        : PLAY_CODE.twoMissed;
  pushPlay(ctx.stats, code, shooterId, player2Id, ctx.input.offensiveTeamId);
}

/** Keeps resolvePass defensivePressure within the existing 1–99 contract. */
function clampDefensivePressure(value: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, value));
}
