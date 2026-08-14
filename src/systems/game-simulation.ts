import {
  createEmptyGamePlayerStats,
  createGame,
  type Game,
  type GamePlayerStats,
  type GameScore,
} from "@/domain/entities/game";
import {
  aggregateTeamStats,
  createGameResult,
  type GameResult,
} from "@/domain/entities/game-result";
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
  mergeGameSimulationConfig,
  type GameSimulationConfig,
} from "@/systems/game-simulation-config";
import { choosePossessionDecision } from "@/systems/possession-decision-selection";
import type { PossessionDecision } from "@/systems/possession-decision";
import {
  applyPossessionResolution,
  resolvePossession,
  type PossessionResolution,
} from "@/systems/possession-resolution";

export type SimulateGameContext = {
  homePlayers: readonly Player[];
  awayPlayers: readonly Player[];
  config?: Partial<GameSimulationConfig>;
  /** Home team coaching philosophy; defaults to all balanced. */
  homeCoachingPhilosophy?: CoachingPhilosophy;
  /** Away team coaching philosophy; defaults to all balanced. */
  awayCoachingPhilosophy?: CoachingPhilosophy;
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
};

type TeamFoulCounters = {
  home: number;
  away: number;
};

type PeriodSimResult = {
  game: Game;
  clock: GameClock;
  eventSequenceStart: number;
  possessionIndex: number;
  secondsOnCourt: Map<string, number>;
  offensiveTeamId: TeamId;
  defensiveTeamId: TeamId;
  possessionCounts: { home: number; away: number };
};

/**
 * Simulates a complete basketball game from tip-off through final buzzer.
 * Deterministic when supplied with a deterministic Rng.
 * resolvePossession is authoritative for points, stats, events, and nextPossession;
 * each resolution is applied exactly once via applyPossessionResolution.
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

  const config = mergeGameSimulationConfig(context.config);
  const homeOnCourt = selectStartingLineup(
    context.homePlayers,
    config.startingLineupSize,
  );
  const awayOnCourt = selectStartingLineup(
    context.awayPlayers,
    config.startingLineupSize,
  );
  const onCourtIds = new Set<string>([
    ...homeOnCourt.map((player) => player.id),
    ...awayOnCourt.map((player) => player.id),
  ]);

  const playerStats = [
    ...context.homePlayers.map((player) =>
      createEmptyGamePlayerStats(player.id),
    ),
    ...context.awayPlayers.map((player) =>
      createEmptyGamePlayerStats(player.id),
    ),
  ];

  let currentGame = createGame({
    id: game.id,
    seasonId: game.seasonId,
    date: game.date,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    status: "in_progress",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats,
  });

  const secondsOnCourt = new Map<string, number>();
  for (const playerId of onCourtIds) {
    secondsOnCourt.set(playerId, 0);
  }

  let eventSequenceStart = 0;
  let possessionIndex = 0;
  const possessionCounts = { home: 0, away: 0 };
  let offensiveTeamId: TeamId = rng.chance(0.5)
    ? game.homeTeamId
    : game.awayTeamId;
  let defensiveTeamId: TeamId =
    offensiveTeamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;

  let clock = createGameClock(config.regulationPeriodSeconds);

  for (let period = 0; period < config.regulationPeriodCount; period += 1) {
    if (period > 0) {
      clock = {
        periodNumber: period + 1,
        remainingSeconds: config.regulationPeriodSeconds,
      };
    }
    const periodResult = simulatePeriod({
      game: currentGame,
      clock,
      eventSequenceStart,
      possessionIndex,
      secondsOnCourt,
      offensiveTeamId,
      defensiveTeamId,
      possessionCounts,
      homeOnCourt,
      awayOnCourt,
      config,
      context,
      rng,
    });
    currentGame = periodResult.game;
    clock = periodResult.clock;
    eventSequenceStart = periodResult.eventSequenceStart;
    possessionIndex = periodResult.possessionIndex;
    offensiveTeamId = periodResult.offensiveTeamId;
    defensiveTeamId = periodResult.defensiveTeamId;
  }

  let overtimePeriodCount = 0;
  while (currentGame.score.home === currentGame.score.away) {
    overtimePeriodCount += 1;
    clock = resetPeriodClock(clock, config.overtimePeriodSeconds);
    const periodResult = simulatePeriod({
      game: currentGame,
      clock,
      eventSequenceStart,
      possessionIndex,
      secondsOnCourt,
      offensiveTeamId,
      defensiveTeamId,
      possessionCounts,
      homeOnCourt,
      awayOnCourt,
      config,
      context,
      rng,
    });
    currentGame = periodResult.game;
    clock = periodResult.clock;
    eventSequenceStart = periodResult.eventSequenceStart;
    possessionIndex = periodResult.possessionIndex;
    offensiveTeamId = periodResult.offensiveTeamId;
    defensiveTeamId = periodResult.defensiveTeamId;
  }

  const finalizedStats = finalizeMinutes(currentGame.playerStats, secondsOnCourt);
  currentGame = createGame({
    ...currentGame,
    status: "final",
    playerStats: finalizedStats,
  });

  const homePlayerStats = finalizedStats.filter((row) =>
    context.homePlayers.some((player) => player.id === row.playerId),
  );
  const awayPlayerStats = finalizedStats.filter((row) =>
    context.awayPlayers.some((player) => player.id === row.playerId),
  );

  return createGameResult({
    gameId: currentGame.id,
    seasonId: currentGame.seasonId,
    date: currentGame.date,
    homeTeamId: currentGame.homeTeamId,
    awayTeamId: currentGame.awayTeamId,
    status: "final",
    score: { ...currentGame.score },
    periodScores: currentGame.periodScores.map((period) => ({ ...period })),
    overtimePeriodCount,
    possessionCounts: {
      home: possessionCounts.home,
      away: possessionCounts.away,
    },
    playerStats: finalizedStats,
    teamStats: {
      home: aggregateTeamStats(currentGame.homeTeamId, homePlayerStats),
      away: aggregateTeamStats(currentGame.awayTeamId, awayPlayerStats),
    },
    events: currentGame.events.map((event) => ({ ...event })),
  });
}

/**
 * Simulates all scheduled games for the given world date.
 * Produces GameCompleted domain events; uses possession-based simulateGame.
 */
export function simulateGamesForDate(
  state: GameState,
  rng: Rng,
  date: string,
): SystemResult {
  const games = { ...state.competition.games };
  const events: DomainEvent[] = [];

  for (const gameId of state.competition.schedule.gameIds) {
    const game = games[gameId];
    if (!game || game.date !== date || game.status !== "scheduled") {
      continue;
    }

    const { finalGame, event } = simulateScheduledGame(state, game, rng);
    games[gameId] = finalGame;
    events.push(event);
  }

  if (events.length === 0) {
    return systemResult(state);
  }

  return systemResult(
    {
      ...state,
      competition: {
        ...state.competition,
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
  const result = simulateGame(
    game,
    {
      homePlayers,
      awayPlayers,
      homeCoachingPhilosophy:
        homeTeam?.coachingPhilosophy ?? DEFAULT_COACHING_PHILOSOPHY,
      awayCoachingPhilosophy:
        awayTeam?.coachingPhilosophy ?? DEFAULT_COACHING_PHILOSOPHY,
    },
    rng,
  );

  const finalGame = createGame({
    id: result.gameId,
    seasonId: result.seasonId,
    date: result.date,
    homeTeamId: result.homeTeamId,
    awayTeamId: result.awayTeamId,
    status: "final",
    score: { ...result.score },
    periodScores: result.periodScores.map((period) => ({ ...period })),
    events: result.events.map((event) => ({ ...event })),
    playerStats: result.playerStats.map((stats) => ({ ...stats })),
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

function simulatePeriod(args: {
  game: Game;
  clock: GameClock;
  eventSequenceStart: number;
  possessionIndex: number;
  secondsOnCourt: Map<string, number>;
  offensiveTeamId: TeamId;
  defensiveTeamId: TeamId;
  possessionCounts: { home: number; away: number };
  homeOnCourt: readonly Player[];
  awayOnCourt: readonly Player[];
  config: GameSimulationConfig;
  context: SimulateGameContext;
  rng: Rng;
}): PeriodSimResult {
  let currentGame = args.game;
  let clock = args.clock;
  let eventSequenceStart = args.eventSequenceStart;
  let possessionIndex = args.possessionIndex;
  let offensiveTeamId = args.offensiveTeamId;
  let defensiveTeamId = args.defensiveTeamId;
  const teamFouls: TeamFoulCounters = { home: 0, away: 0 };
  const scoreAtPeriodStart: GameScore = { ...currentGame.score };

  while (!isPeriodOver(clock)) {
    const offensivePlayers =
      offensiveTeamId === currentGame.homeTeamId
        ? args.homeOnCourt
        : args.awayOnCourt;
    const defensivePlayers =
      defensiveTeamId === currentGame.homeTeamId
        ? args.homeOnCourt
        : args.awayOnCourt;

    const chooseDecision =
      args.context.chooseDecision ?? choosePossessionDecision;
    const offensivePhilosophy = philosophyForTeam(
      offensiveTeamId,
      currentGame,
      args.context,
    );
    const defensivePhilosophy = philosophyForTeam(
      defensiveTeamId,
      currentGame,
      args.context,
    );
    const offensiveModifiers = getCoachingModifiers(offensivePhilosophy);
    const defensiveModifiers = getCoachingModifiers(defensivePhilosophy);

    const decision = chooseDecision(
      {
        offensiveTeamId,
        defensiveTeamId,
        offensivePlayers,
        defensivePlayers,
        config: args.config,
        shotSelectionModifiers: offensiveModifiers.shotSelection,
        foulActionWeightMultiplier:
          defensiveModifiers.foulActionWeightMultiplier,
      },
      args.rng,
    );

    possessionIndex += 1;
    const defensiveFoulsBefore =
      defensiveTeamId === currentGame.homeTeamId
        ? teamFouls.home
        : teamFouls.away;

    const resolution = resolvePossession(
      {
        possessionId: asPossessionId(
          `poss_${currentGame.id}_${possessionIndex}`,
        ),
        offensiveTeamId,
        defensiveTeamId,
        offensivePlayers,
        defensivePlayers,
        defensiveTeamFoulsBefore: defensiveFoulsBefore,
        decision,
        eventSequenceStart,
        fatigue: 0,
        defensivePressureMultiplier:
          defensiveModifiers.defensivePressureMultiplier,
      },
      args.rng,
    );

    // Apply exactly once — do not add points/stats/events elsewhere in the loop.
    currentGame = applyPossessionResolution(currentGame, resolution);
    eventSequenceStart = nextEventSequenceStart(
      eventSequenceStart,
      resolution,
    );

    if (defensiveTeamId === currentGame.homeTeamId) {
      teamFouls.home = resolution.defensiveTeamFoulsAfter;
    } else {
      teamFouls.away = resolution.defensiveTeamFoulsAfter;
    }

    const requestedSeconds = requestPossessionSeconds(
      resolution,
      args.config,
      args.rng,
      offensiveModifiers.possessionSecondsDelta,
    );
    const consumed = consumeTime(clock, requestedSeconds);
    clock = consumed.clock;
    addSecondsToOnCourtPlayers(
      args.secondsOnCourt,
      args.homeOnCourt,
      args.awayOnCourt,
      consumed.elapsedSeconds,
    );

    // Count completed offensive possessions when offense flips (not on
    // continue/OREB/pass-keep). One resolvePossession that ends the
    // possession increments exactly once for the team that had the ball.
    if (
      resolution.nextPossession.offensiveTeamId !== offensiveTeamId
    ) {
      if (offensiveTeamId === currentGame.homeTeamId) {
        args.possessionCounts.home += 1;
      } else {
        args.possessionCounts.away += 1;
      }
    }

    offensiveTeamId = resolution.nextPossession.offensiveTeamId;
    defensiveTeamId = resolution.nextPossession.defensiveTeamId;
  }

  const periodDelta: GameScore = {
    home: currentGame.score.home - scoreAtPeriodStart.home,
    away: currentGame.score.away - scoreAtPeriodStart.away,
  };
  currentGame = createGame({
    ...currentGame,
    periodScores: [
      ...currentGame.periodScores.map((period) => ({ ...period })),
      periodDelta,
    ],
  });

  return {
    game: currentGame,
    clock,
    eventSequenceStart,
    possessionIndex,
    secondsOnCourt: args.secondsOnCourt,
    offensiveTeamId,
    defensiveTeamId,
    possessionCounts: args.possessionCounts,
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
  game: Game,
  context: SimulateGameContext,
): CoachingPhilosophy {
  if (teamId === game.homeTeamId) {
    return context.homeCoachingPhilosophy ?? DEFAULT_COACHING_PHILOSOPHY;
  }
  if (teamId === game.awayTeamId) {
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

function finalizeMinutes(
  playerStats: readonly GamePlayerStats[],
  secondsOnCourt: Map<string, number>,
): GamePlayerStats[] {
  return playerStats.map((row) => ({
    ...row,
    minutes: Math.floor((secondsOnCourt.get(row.playerId) ?? 0) / 60),
  }));
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
  return Object.values(state.world.players)
    .filter((player) => player.teamId === teamId)
    .sort(
      (a, b) =>
        calculatePlayerOverall(b.position, b.attributes) -
        calculatePlayerOverall(a.position, a.attributes),
    );
}
