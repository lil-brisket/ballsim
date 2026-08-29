import {
  createGame,
  type Game,
  type GamePlayerStats,
  type GameScore,
  type GameTeamSnapshot,
} from "@/domain/entities/game";
import {
  aggregateTeamStats,
  createGameResult,
  type GameResult,
} from "@/domain/entities/game-result";
import { assertCompletedGameBoxScore } from "@/domain/entities/game-box-score";
import type { Player } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import {
  asPossessionId,
  type TeamId,
} from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import { systemResult, type SystemResult } from "@/domain/system-result";
import {
  DEFAULT_COACHING_PHILOSOPHY,
  type CoachingPhilosophy,
} from "@/domain/coaching/coaching-philosophy";
import {
  getCoachingModifiers,
  type CoachingModifiers,
} from "@/domain/coaching/coaching-philosophy-config";
import type { GameState } from "@/state/game-state";
import {
  consumeTime,
  createGameClock,
  isPeriodOver,
  resetPeriodClock,
  type GameClock,
} from "@/systems/game-clock";
import {
  GAME_SIMULATION_CONFIG,
  mergeGameSimulationConfig,
  type GameSimulationConfig,
} from "@/systems/game-simulation-config";
import {
  applyPossessionToSimState,
  appendPeriodScore,
  assertGameSimStatsConservation,
  createGameSimState,
  finalizeGameSimState,
  finalizeMinutesOnSimState,
  lineupCacheKey,
  type GameSimState,
} from "@/systems/game-sim-state";
import { choosePossessionDecision } from "@/systems/possession-decision-selection";
import type { PossessionDecision } from "@/systems/possession-decision";
import {
  resolvePossession,
  type PossessionResolution,
} from "@/systems/possession-resolution";
import {
  buildGameIdsByDate,
  scheduledGameIdsForDate,
} from "@/systems/schedule-date-index";
import type { SimulationProfiler } from "@/systems/simulation/simulation-profiler";
import { getEmergencyLineup } from "@/systems/roster-management";
import {
  accumulateOnCourtTime,
  averageOnCourtFatigue,
  finalizeRotationExplanations,
  initializeRotationForSim,
  maybeRunRotationWindow,
  runSubstitutionCheckpoint,
  syncFoulOutsFromStats,
} from "@/systems/rotation/sim-bridge";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";
import { assertTeamSecondsOnCourt } from "@/systems/rotation/rotation-invariants";
import {
  buildTeamStaffGameContext,
  type TeamStaffGameContext,
} from "@/systems/staff-effects";

export type SimulateGameContext = {
  homePlayers: readonly Player[];
  awayPlayers: readonly Player[];
  /** When set, used instead of overall-sorted default starters. */
  homeStartingLineup?: readonly Player[];
  /** When set, used instead of overall-sorted default starters. */
  awayStartingLineup?: readonly Player[];
  config?: Partial<GameSimulationConfig>;
  /** Home team coaching philosophy; defaults to all balanced. */
  homeCoachingPhilosophy?: CoachingPhilosophy;
  /** Away team coaching philosophy; defaults to all balanced. */
  awayCoachingPhilosophy?: CoachingPhilosophy;
  /** Precomputed once per game — do not look up staff in possession loops. */
  homeStaffContext?: TeamStaffGameContext;
  awayStaffContext?: TeamStaffGameContext;
  /**
   * Optional decision injector for tests. Production uses choosePossessionDecision.
   */
  chooseDecision?: (
    input: {
      offensiveTeamId: TeamId;
      defensiveTeamId: TeamId;
      offensivePlayers: readonly Player[];
      defensivePlayers: readonly Player[];
      config: GameSimulationConfig;
      shotSelectionModifiers?: CoachingModifiers["shotSelection"];
      foulActionWeightMultiplier?: number;
    },
    rng: Rng,
  ) => PossessionDecision;
  /** Optional profiler for cost-model benchmarks. */
  profiler?: SimulationProfiler;
  /** Optional GameState for rotation substitutions mid-game. */
  gameState?: GameState;
};

type TeamFoulCounters = {
  home: number;
  away: number;
};

type LineupTacticalCache = {
  key: string;
  offensiveModifiers: CoachingModifiers;
  defensiveModifiers: CoachingModifiers;
};

type PeriodSimResult = {
  clock: GameClock;
  offensiveTeamId: TeamId;
  defensiveTeamId: TeamId;
};

/**
 * Simulates a complete basketball game from tip-off through final buzzer.
 * Deterministic when supplied with a deterministic Rng.
 * Uses mutable {@link GameSimState} as the canonical in-game representation;
 * domain {@link Game} is validated once at finalize.
 */
export function simulateGame(
  game: Game,
  context: SimulateGameContext,
  rng: Rng,
): GameResult {
  if (rng == null || typeof rng.next !== "function") {
    throw new Error("simulateGame requires an Rng.");
  }
  if (context.homePlayers.length === 0 || context.awayPlayers.length === 0) {
    throw new Error("simulateGame requires home and away players.");
  }

  const totalStart = performance.now();
  let decisionSelectionMs = 0;
  let resolutionMs = 0;
  let statsMs = 0;
  let validationMs = 0;

  const config = mergeGameSimulationConfig(context.config);
  const homeOnCourt =
    context.homeStartingLineup != null && context.homeStartingLineup.length > 0
      ? [...context.homeStartingLineup]
      : selectStartingLineup(context.homePlayers, config.startingLineupSize);
  const awayOnCourt =
    context.awayStartingLineup != null && context.awayStartingLineup.length > 0
      ? [...context.awayStartingLineup]
      : selectStartingLineup(context.awayPlayers, config.startingLineupSize);

  const sim = createGameSimState({
    game,
    homePlayers: context.homePlayers,
    awayPlayers: context.awayPlayers,
    homeOnCourt,
    awayOnCourt,
  });
  initializeRotationForSim(
    sim,
    context.gameState,
    context.homePlayers,
    context.awayPlayers,
  );

  let offensiveTeamId: TeamId = rng.chance(0.5)
    ? game.homeTeamId
    : game.awayTeamId;
  let defensiveTeamId: TeamId =
    offensiveTeamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;

  let clock = createGameClock(config.regulationPeriodSeconds);
  const lineupCache: { current: LineupTacticalCache | null } = {
    current: null,
  };

  for (let period = 0; period < config.regulationPeriodCount; period += 1) {
    if (period > 0) {
      clock = {
        periodNumber: period + 1,
        remainingSeconds: config.regulationPeriodSeconds,
      };
      sim.windowsFiredThisPeriod = new Set();
      const checkpoint =
        period === 2 ? ("halftime" as const) : ("period_start" as const);
      runSubstitutionCheckpoint(
        sim,
        context.gameState,
        checkpoint,
        period + 1,
        config.regulationPeriodSeconds,
        context.homePlayers,
        context.awayPlayers,
      );
    }
    const periodResult = simulatePeriod({
      sim,
      clock,
      offensiveTeamId,
      defensiveTeamId,
      config,
      context,
      rng,
      lineupCache,
      timers: {
        addDecision: (ms) => {
          decisionSelectionMs += ms;
        },
        addResolution: (ms) => {
          resolutionMs += ms;
        },
        addStats: (ms) => {
          statsMs += ms;
        },
      },
    });
    clock = periodResult.clock;
    offensiveTeamId = periodResult.offensiveTeamId;
    defensiveTeamId = periodResult.defensiveTeamId;
  }

  let overtimePeriodCount = 0;
  while (sim.homeScore === sim.awayScore) {
    overtimePeriodCount += 1;
    sim.overtimePeriodCount = overtimePeriodCount;
    clock = resetPeriodClock(clock, config.overtimePeriodSeconds);
    sim.windowsFiredThisPeriod = new Set();
    runSubstitutionCheckpoint(
      sim,
      context.gameState,
      "period_start",
      config.regulationPeriodCount + overtimePeriodCount,
      config.overtimePeriodSeconds,
      context.homePlayers,
      context.awayPlayers,
    );
    const periodResult = simulatePeriod({
      sim,
      clock,
      offensiveTeamId,
      defensiveTeamId,
      config,
      context,
      rng,
      lineupCache,
      timers: {
        addDecision: (ms) => {
          decisionSelectionMs += ms;
        },
        addResolution: (ms) => {
          resolutionMs += ms;
        },
        addStats: (ms) => {
          statsMs += ms;
        },
      },
    });
    clock = periodResult.clock;
    offensiveTeamId = periodResult.offensiveTeamId;
    defensiveTeamId = periodResult.defensiveTeamId;
  }

  finalizeMinutesOnSimState(sim);
  finalizeRotationExplanations(sim);

  const homePlayerIds = new Set(context.homePlayers.map((player) => player.id));
  const awayPlayerIds = new Set(context.awayPlayers.map((player) => player.id));
  assertGameSimStatsConservation(sim, homePlayerIds, awayPlayerIds);

  // Minute accounting: secondsOnCourt is authoritative — never rewrite minutes.
  if (context.gameState != null) {
    assertTeamSecondsOnCourt({
      teamLabel: "home",
      secondsByPlayerId: sim.secondsOnCourt,
      teamPlayerIds: [...homePlayerIds],
      overtimePeriods: overtimePeriodCount,
      toleranceSeconds: 5,
    });
    assertTeamSecondsOnCourt({
      teamLabel: "away",
      secondsByPlayerId: sim.secondsOnCourt,
      teamPlayerIds: [...awayPlayerIds],
      overtimePeriods: overtimePeriodCount,
      toleranceSeconds: 5,
    });
  }

  const validationStart = performance.now();
  const finalizedGame = finalizeGameSimState(sim, "final");
  validationMs += performance.now() - validationStart;

  const finalizedStats = finalizedGame.playerStats;
  const homePlayerStats = finalizedStats.filter((row) =>
    homePlayerIds.has(row.playerId),
  );
  const awayPlayerStats = finalizedStats.filter((row) =>
    awayPlayerIds.has(row.playerId),
  );

  const result = createGameResult({
    gameId: finalizedGame.id,
    seasonId: finalizedGame.seasonId,
    date: finalizedGame.date,
    homeTeamId: finalizedGame.homeTeamId,
    awayTeamId: finalizedGame.awayTeamId,
    status: "final",
    score: { ...finalizedGame.score },
    periodScores: finalizedGame.periodScores.map((period) => ({ ...period })),
    overtimePeriodCount,
    possessionCounts: {
      home: sim.possessionCounts.home,
      away: sim.possessionCounts.away,
    },
    playerStats: finalizedStats,
    teamStats: {
      home: aggregateTeamStats(finalizedGame.homeTeamId, homePlayerStats),
      away: aggregateTeamStats(finalizedGame.awayTeamId, awayPlayerStats),
    },
    events: finalizedGame.events.map((event) => ({ ...event })),
    rotationMeta: finalizedGame.rotationMeta,
  });

  const totalMs = performance.now() - totalStart;
  const possessions = sim.possessionIndex;
  const events = sim.events.length;
  const accounted =
    validationMs + decisionSelectionMs + resolutionMs + statsMs;
  const otherMs = Math.max(0, totalMs - accounted);

  if (context.profiler) {
    context.profiler.recordGame({
      possessions,
      events,
      playersInvolved: context.homePlayers.length + context.awayPlayers.length,
      totalMs,
      validationMs,
      decisionSelectionMs,
      statsMs,
      resolutionMs,
      otherMs,
      msPerPossession: possessions > 0 ? totalMs / possessions : 0,
      msPerEvent: events > 0 ? totalMs / events : 0,
    });
  }

  return result;
}

/**
 * Simulates all scheduled games for the given world date.
 * Produces GameCompleted domain events; uses possession-based simulateGame.
 */
export function simulateGamesForDate(
  state: GameState,
  rng: Rng,
  date: string,
  profiler?: SimulationProfiler,
): SystemResult {
  const games = { ...state.competition.games };
  const events: DomainEvent[] = [];

  let working = state;
  if (
    working.competition.schedule.gameIdsByDate == null ||
    Object.keys(working.competition.schedule.gameIdsByDate).length === 0
  ) {
    working = {
      ...working,
      competition: {
        ...working.competition,
        schedule: {
          ...working.competition.schedule,
          gameIdsByDate: buildGameIdsByDate(
            working.competition.games,
            working.competition.schedule.gameIds,
          ),
        },
      },
    };
  }

  const gameIds = scheduledGameIdsForDate(working, date);

  for (const gameId of gameIds) {
    const game = games[gameId];
    if (!game || game.status !== "scheduled") {
      continue;
    }

    const gameStart = performance.now();
    const { finalGame, event } = simulateScheduledGame(working, game, rng, {
      profiler,
    });
    if (profiler) {
      profiler.addSeason("gameSimMs", performance.now() - gameStart);
    }
    games[gameId] = finalGame;
    events.push(event);
  }

  if (events.length === 0) {
    return systemResult(working === state ? state : working);
  }

  return systemResult(
    {
      ...working,
      competition: {
        ...working.competition,
        games,
      },
    },
    events,
  );
}

/**
 * Simulates one scheduled game using {@link simulateGame} and returns the
 * finalized Game plus a GameCompleted domain event.
 * Shared by regular-season date sim and playoff series sim.
 */
export function simulateScheduledGame(
  state: GameState,
  game: Game,
  rng: Rng,
  options?: { profiler?: SimulationProfiler },
): { finalGame: Game; event: DomainEvent } {
  if (game.status !== "scheduled") {
    throw new Error(
      `simulateScheduledGame requires status "scheduled"; ${game.id} is "${game.status}".`,
    );
  }

  const homePlayers = rosterForTeam(state, game.homeTeamId);
  const awayPlayers = rosterForTeam(state, game.awayTeamId);
  const homeTeam = state.world.teams[game.homeTeamId];
  const awayTeam = state.world.teams[game.awayTeamId];
  const homeLineup = getEmergencyLineup(state, game.homeTeamId);
  const awayLineup = getEmergencyLineup(state, game.awayTeamId);
  const result = simulateGame(
    game,
    {
      homePlayers,
      awayPlayers,
      homeStartingLineup: homeLineup.players,
      awayStartingLineup: awayLineup.players,
      homeCoachingPhilosophy:
        homeTeam?.coachingPhilosophy ?? DEFAULT_COACHING_PHILOSOPHY,
      awayCoachingPhilosophy:
        awayTeam?.coachingPhilosophy ?? DEFAULT_COACHING_PHILOSOPHY,
      homeStaffContext: buildTeamStaffGameContext(state, game.homeTeamId),
      awayStaffContext: buildTeamStaffGameContext(state, game.awayTeamId),
      profiler: options?.profiler,
      gameState: state,
    },
    rng,
  );

  const finalGame = buildFinalizedGame(game, state, result, {
    homePlayers,
    awayPlayers,
  });

  const event = createDomainEvent({
    type: "GameCompleted",
    occurredOn: result.date,
    payload: {
      gameId: result.gameId,
      homeTeamId: result.homeTeamId,
      awayTeamId: result.awayTeamId,
      homeScore: result.score.home,
      awayScore: result.score.away,
    },
  });

  return { finalGame, event };
}

/**
 * Builds a historically snapshotted finalized Game from a GameResult.
 * Reads competitionType from the scheduled Game (single source of truth).
 * Throws on box-score invariant failure (matches createGame strictness).
 */
export function buildFinalizedGame(
  game: Game,
  state: GameState,
  result: GameResult,
  rosters: { homePlayers: Player[]; awayPlayers: Player[] },
): Game {
  const homeTeam = state.world.teams[result.homeTeamId];
  const awayTeam = state.world.teams[result.awayTeamId];
  if (!homeTeam || !awayTeam) {
    throw new Error(
      `buildFinalizedGame: missing team for game ${result.gameId}.`,
    );
  }

  const homeSnapshot = snapshotTeam(homeTeam);
  const awaySnapshot = snapshotTeam(awayTeam);

  const homeById = new Map(
    rosters.homePlayers.map((player) => [player.id, player] as const),
  );
  const awayById = new Map(
    rosters.awayPlayers.map((player) => [player.id, player] as const),
  );

  const playerStats: GamePlayerStats[] = result.playerStats.map((row) => {
    const homePlayer = homeById.get(row.playerId);
    const awayPlayer = awayById.get(row.playerId);
    const player = homePlayer ?? awayPlayer;
    if (!player) {
      throw new Error(
        `buildFinalizedGame: player ${row.playerId} not on either roster for ${result.gameId}.`,
      );
    }
    const teamId = homePlayer
      ? result.homeTeamId
      : result.awayTeamId;
    return {
      ...row,
      teamId,
      firstName: player.firstName,
      lastName: player.lastName,
    };
  });

  const finalGame = createGame({
    id: result.gameId,
    seasonId: result.seasonId,
    date: result.date,
    homeTeamId: result.homeTeamId,
    awayTeamId: result.awayTeamId,
    competitionType: game.competitionType,
    status: "final",
    score: { ...result.score },
    periodScores: result.periodScores.map((period) => ({ ...period })),
    events: result.events.map((event) => ({ ...event })),
    playerStats,
    homeTeamSnapshot: homeSnapshot,
    awayTeamSnapshot: awaySnapshot,
    rotationMeta: result.rotationMeta,
  });

  assertCompletedGameBoxScore(finalGame);
  return finalGame;
}

function snapshotTeam(team: {
  id: TeamId;
  city: string;
  name: string;
  abbreviation: string;
  branding: GameTeamSnapshot["branding"];
}): GameTeamSnapshot {
  return {
    teamId: team.id,
    city: team.city,
    name: team.name,
    abbreviation: team.abbreviation,
    branding: { ...team.branding },
  };
}

function simulatePeriod(args: {
  sim: GameSimState;
  clock: GameClock;
  offensiveTeamId: TeamId;
  defensiveTeamId: TeamId;
  config: GameSimulationConfig;
  context: SimulateGameContext;
  rng: Rng;
  lineupCache: { current: LineupTacticalCache | null };
  timers: {
    addDecision: (ms: number) => void;
    addResolution: (ms: number) => void;
    addStats: (ms: number) => void;
  };
}): PeriodSimResult {
  const sim = args.sim;
  let clock = args.clock;
  let offensiveTeamId = args.offensiveTeamId;
  let defensiveTeamId = args.defensiveTeamId;
  const teamFouls: TeamFoulCounters = { home: 0, away: 0 };
  const scoreAtPeriodStart: GameScore = {
    home: sim.homeScore,
    away: sim.awayScore,
  };

  while (!isPeriodOver(clock)) {
    const offensivePlayers =
      offensiveTeamId === sim.homeTeamId ? sim.homeOnCourt : sim.awayOnCourt;
    const defensivePlayers =
      defensiveTeamId === sim.homeTeamId ? sim.homeOnCourt : sim.awayOnCourt;

    const chooseDecision =
      args.context.chooseDecision ?? choosePossessionDecision;

    const cacheKey = lineupCacheKey(offensivePlayers, defensivePlayers);
    let tactical = args.lineupCache.current;
    if (tactical == null || tactical.key !== cacheKey) {
      const offensivePhilosophy = philosophyForTeam(
        offensiveTeamId,
        sim,
        args.context,
      );
      const defensivePhilosophy = philosophyForTeam(
        defensiveTeamId,
        sim,
        args.context,
      );
      tactical = {
        key: cacheKey,
        offensiveModifiers: getCoachingModifiers(offensivePhilosophy),
        defensiveModifiers: getCoachingModifiers(defensivePhilosophy),
      };
      args.lineupCache.current = tactical;
    }

    const decisionStart = performance.now();
    const decision = chooseDecision(
      {
        offensiveTeamId,
        defensiveTeamId,
        offensivePlayers,
        defensivePlayers,
        config: args.config,
        shotSelectionModifiers: tactical.offensiveModifiers.shotSelection,
        foulActionWeightMultiplier:
          tactical.defensiveModifiers.foulActionWeightMultiplier,
      },
      args.rng,
    );
    args.timers.addDecision(performance.now() - decisionStart);

    sim.possessionIndex += 1;
    const defensiveFoulsBefore =
      defensiveTeamId === sim.homeTeamId ? teamFouls.home : teamFouls.away;

    const resolutionStart = performance.now();
    const resolution = resolvePossession(
      {
        possessionId: asPossessionId(
          `poss_${sim.id}_${sim.possessionIndex}`,
        ),
        offensiveTeamId,
        defensiveTeamId,
        offensivePlayers,
        defensivePlayers,
        defensiveTeamFoulsBefore: defensiveFoulsBefore,
        decision,
        eventSequenceStart: sim.eventSequenceStart,
        fatigue: averageOnCourtFatigue(sim, offensivePlayers),
        defensivePressureMultiplier:
          tactical.defensiveModifiers.defensivePressureMultiplier,
      },
      args.rng,
    );
    args.timers.addResolution(performance.now() - resolutionStart);

    const statsStart = performance.now();
    applyPossessionToSimState(sim, resolution);
    args.timers.addStats(performance.now() - statsStart);

    sim.eventSequenceStart = nextEventSequenceStart(
      sim.eventSequenceStart,
      resolution,
    );

    if (defensiveTeamId === sim.homeTeamId) {
      teamFouls.home = resolution.defensiveTeamFoulsAfter;
    } else {
      teamFouls.away = resolution.defensiveTeamFoulsAfter;
    }

    const newlyFouledOut = syncFoulOutsFromStats(sim);
    if (newlyFouledOut.length > 0) {
      runSubstitutionCheckpoint(
        sim,
        args.context.gameState,
        "foul_out",
        clock.periodNumber,
        clock.remainingSeconds,
        args.context.homePlayers,
        args.context.awayPlayers,
      );
    }

    const staffCtx =
      offensiveTeamId === sim.homeTeamId
        ? args.context.homeStaffContext
        : args.context.awayStaffContext;
    const staffTempoDelta = staffCtx
      ? Math.round(
          (staffCtx.offensiveModifier +
            staffCtx.preparationModifier +
            staffCtx.gameManagementModifier) *
            2,
        )
      : 0;

    const requestedSeconds = requestPossessionSeconds(
      resolution,
      args.config,
      args.rng,
      tactical.offensiveModifiers.possessionSecondsDelta + staffTempoDelta,
    );
    const consumed = consumeTime(clock, requestedSeconds);
    clock = consumed.clock;
    accumulateOnCourtTime(sim, consumed.elapsedSeconds);

    // Blowout relief late in regulation
    if (
      clock.periodNumber >= args.config.regulationPeriodCount &&
      Math.abs(sim.homeScore - sim.awayScore) >= ROTATION_CONFIG.blowoutMargin
    ) {
      const blowoutKey = `blowout:${clock.periodNumber}`;
      if (!sim.windowsFiredThisPeriod.has(blowoutKey)) {
        sim.windowsFiredThisPeriod.add(blowoutKey);
        runSubstitutionCheckpoint(
          sim,
          args.context.gameState,
          "blowout_relief",
          clock.periodNumber,
          clock.remainingSeconds,
          args.context.homePlayers,
          args.context.awayPlayers,
        );
      }
    }

    maybeRunRotationWindow(
      sim,
      args.context.gameState,
      clock.periodNumber,
      clock.remainingSeconds,
      args.context.homePlayers,
      args.context.awayPlayers,
    );

    if (resolution.nextPossession.offensiveTeamId !== offensiveTeamId) {
      if (offensiveTeamId === sim.homeTeamId) {
        sim.possessionCounts.home += 1;
      } else {
        sim.possessionCounts.away += 1;
      }
    }

    offensiveTeamId = resolution.nextPossession.offensiveTeamId;
    defensiveTeamId = resolution.nextPossession.defensiveTeamId;
  }

  appendPeriodScore(sim, {
    home: sim.homeScore - scoreAtPeriodStart.home,
    away: sim.awayScore - scoreAtPeriodStart.away,
  });

  return {
    clock,
    offensiveTeamId,
    defensiveTeamId,
  };
}

function nextEventSequenceStart(
  previous: number,
  resolution: PossessionResolution,
): number {
  if (resolution.events.length === 0) {
    return previous;
  }
  let maxSequence = previous;
  for (const event of resolution.events) {
    if (event.sequence > maxSequence) {
      maxSequence = event.sequence;
    }
  }
  return maxSequence + 1;
}

/**
 * Rolls possession clock cost, then applies offensive pace delta.
 * Delta of 0 (balanced) matches pre-coaching behavior exactly.
 */
export function requestPossessionSeconds(
  resolution: PossessionResolution,
  config: GameSimulationConfig,
  rng: Rng,
  possessionSecondsDelta = 0,
): number {
  const times = config.possessionTimeSeconds;
  const action = resolution.possession.action;
  let seconds: number;
  if (action === "turnover") {
    seconds = rng.nextInt(times.turnoverMin, times.turnoverMax);
  } else if (action === "foul") {
    seconds = rng.nextInt(times.foulMin, times.foulMax);
  } else if (action === "free_throw") {
    seconds = rng.nextInt(times.freeThrowMin, times.freeThrowMax);
  } else {
    seconds = rng.nextInt(times.defaultMin, times.defaultMax);
  }
  return Math.max(1, seconds + possessionSecondsDelta);
}

function philosophyForTeam(
  teamId: TeamId,
  sim: GameSimState,
  context: SimulateGameContext,
): CoachingPhilosophy {
  if (teamId === sim.homeTeamId) {
    return context.homeCoachingPhilosophy ?? DEFAULT_COACHING_PHILOSOPHY;
  }
  if (teamId === sim.awayTeamId) {
    return context.awayCoachingPhilosophy ?? DEFAULT_COACHING_PHILOSOPHY;
  }
  return DEFAULT_COACHING_PHILOSOPHY;
}

function addSecondsToOnCourtPlayers(
  secondsOnCourt: Map<string, number>,
  homeOnCourt: readonly Player[],
  awayOnCourt: readonly Player[],
  elapsedSeconds: number,
): void {
  for (const player of homeOnCourt) {
    secondsOnCourt.set(
      player.id,
      (secondsOnCourt.get(player.id) ?? 0) + elapsedSeconds,
    );
  }
  for (const player of awayOnCourt) {
    secondsOnCourt.set(
      player.id,
      (secondsOnCourt.get(player.id) ?? 0) + elapsedSeconds,
    );
  }
}

function selectStartingLineup(
  roster: readonly Player[],
  size: number,
): Player[] {
  const sorted = [...roster].sort(
    (a, b) =>
      calculatePlayerOverall(b.position, b.attributes) -
      calculatePlayerOverall(a.position, a.attributes),
  );
  const lineup = sorted.slice(0, Math.min(size, sorted.length));
  if (lineup.length === 0) {
    throw new Error("Starting lineup requires at least one player.");
  }
  return lineup;
}

function rosterForTeam(state: GameState, teamId: TeamId): Player[] {
  const team = state.world.teams[teamId];
  const players: Player[] = [];
  if (team != null && Array.isArray(team.roster) && team.roster.length > 0) {
    for (const playerId of team.roster) {
      const player = state.world.players[playerId];
      if (player != null) {
        players.push(player);
      }
    }
  } else {
    for (const player of Object.values(state.world.players)) {
      if (player.teamId === teamId) {
        players.push(player);
      }
    }
  }
  return players.sort(
    (a, b) =>
      calculatePlayerOverall(b.position, b.attributes) -
      calculatePlayerOverall(a.position, a.attributes),
  );
}
