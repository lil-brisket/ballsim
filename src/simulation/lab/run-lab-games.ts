import { asGameId, asTeamId } from "@/domain/ids";
import { createSeededRng, deriveSeed, type Rng } from "@/domain/rng";
import { simulateGame } from "@/systems/game-simulation";
import { aggregateSnapshots } from "@/simulation/validation/aggregate";
import { collectGameSnapshot } from "@/simulation/validation/collect-game-stats";
import { computeValidationChecksum } from "@/simulation/validation/checksum";
import {
  combineVerdicts,
  evaluatePlausibility,
} from "@/simulation/validation/plausibility";
import { evaluatePlayerCorrelations } from "@/simulation/validation/correlations";
import {
  collectRawGameFailures,
  gameFromResult,
  overtimeHighFailure,
  parseThrownInvariantError,
} from "@/simulation/lab/collect-game-failures";
import { createLabScheduledGame } from "@/simulation/lab/create-lab-game";
import { readEngineIdentity } from "@/simulation/lab/engine-identity";
import { toLabFailure } from "@/simulation/lab/map-failure";
import { formatReproCommand } from "@/simulation/lab/repro";
import { buildLabRotationState } from "@/simulation/lab/rotation-state";
import {
  getScenarioBuilder,
  isLabScenarioId,
} from "@/simulation/lab/scenarios";
import { INJURY_HEAVY_SCENARIO_ID } from "@/simulation/lab/scenarios/injury-heavy";
import { buildNormalRosters } from "@/simulation/lab/scenarios/normal";
import { NORMAL_SCENARIO_ID } from "@/simulation/lab/scenarios/normal";
import { processPostGameInjuryExposures } from "@/systems/injury/injury-post-game";
import type {
  LabFailure,
  LabFailureContext,
  LabReport,
  LabRotationMode,
  LabScenarioBuilder,
  RawInvariantFailure,
} from "@/simulation/lab/types";
import type { GameSnapshot } from "@/simulation/validation/types";

export type RunLabGamesOptions = {
  seed: number | string;
  games: number;
  scenarioId?: string;
  rotation?: LabRotationMode;
  buildRosters?: LabScenarioBuilder;
  rosterSize?: number;
};

const DEFAULT_ROTATION: LabRotationMode = "on";

export function runLabGames(options: RunLabGamesOptions): LabReport {
  if (!Number.isInteger(options.games) || options.games < 1) {
    throw new Error("runLabGames: games must be a positive integer.");
  }

  const scenarioId = options.scenarioId ?? NORMAL_SCENARIO_ID;
  const rotation = options.rotation ?? DEFAULT_ROTATION;
  const engineIdentity = readEngineIdentity();
  const reproCommand = formatReproCommand({
    seed: options.seed,
    scenarioId,
    games: options.games,
    rotation,
  });
  const failureCtx: LabFailureContext = {
    seed: options.seed,
    scenarioId,
    reproCommand,
    engineIdentity,
  };

  const rng = createSeededRng(deriveSeed(options.seed, scenarioId));
  const buildRosters =
    options.buildRosters ??
    ((stream: Rng) => {
      if (scenarioId === NORMAL_SCENARIO_ID && options.rosterSize != null) {
        return buildNormalRosters(stream, options.rosterSize);
      }
      if (!isLabScenarioId(scenarioId)) {
        throw new Error(`Unknown Lab scenario: ${scenarioId}`);
      }
      return getScenarioBuilder(scenarioId)(stream);
    });
  const generated = buildRosters(rng);

  let homePlayers = generated.homePlayers;
  let awayPlayers = generated.awayPlayers;
  let homeTeamId = asTeamId("team_validation_home");
  let awayTeamId = asTeamId("team_validation_away");
  let rotationSetup =
    rotation === "on"
      ? buildLabRotationState(homePlayers, awayPlayers, options.seed)
      : null;
  if (rotationSetup) {
    homePlayers = rotationSetup.homePlayers;
    awayPlayers = rotationSetup.awayPlayers;
    homeTeamId = rotationSetup.homeTeamId;
    awayTeamId = rotationSetup.awayTeamId;
  }

  const homeIds = new Set(homePlayers.map((player) => player.id as string));
  const awayIds = new Set(awayPlayers.map((player) => player.id as string));

  const snapshots: GameSnapshot[] = [];
  const hardFailures: LabFailure[] = [];
  const warnings: LabFailure[] = [];
  const playerGameStats: Map<
    string,
    { points: number; rebounds: number; assists: number }
  >[] = [];
  let overtimeHighCount = 0;

  for (let gameIndex = 0; gameIndex < options.games; gameIndex += 1) {
    const homeFirst = gameIndex % 2 === 0;
    const venueHomeId = homeFirst ? homeTeamId : awayTeamId;
    const venueAwayId = homeFirst ? awayTeamId : homeTeamId;
    const gameHomePlayers = homeFirst ? homePlayers : awayPlayers;
    const gameAwayPlayers = homeFirst ? awayPlayers : homePlayers;
    const gameHomeIds = homeFirst ? homeIds : awayIds;
    const gameAwayIds = homeFirst ? awayIds : homeIds;

    const game = createLabScheduledGame({
      id: asGameId(`val_game_${gameIndex}`),
      homeTeamId: venueHomeId,
      awayTeamId: venueAwayId,
    });

    const rawFailures: RawInvariantFailure[] = [];
    try {
      const result = simulateGame(
        game,
        {
          homePlayers: gameHomePlayers,
          awayPlayers: gameAwayPlayers,
          homeStartingLineup: rotationSetup
            ? homeFirst
              ? rotationSetup.homeStarters
              : rotationSetup.awayStarters
            : undefined,
          awayStartingLineup: rotationSetup
            ? homeFirst
              ? rotationSetup.awayStarters
              : rotationSetup.homeStarters
            : undefined,
          gameState: rotationSetup?.state,
        },
        rng,
      );
      const snapshot = collectGameSnapshot(result);
      snapshots.push(snapshot);
      playerGameStats.push(playerStatsMap(result));
      rawFailures.push(
        ...collectRawGameFailures(result, snapshot, gameHomeIds, gameAwayIds),
      );
      const otWarning = overtimeHighFailure(
        result.overtimePeriodCount,
        result.gameId,
      );
      if (otWarning) {
        overtimeHighCount += 1;
        warnings.push(toLabFailure(otWarning, failureCtx));
      }
      if (scenarioId === INJURY_HEAVY_SCENARIO_ID && rotationSetup) {
        const injury = processPostGameInjuryExposures(
          rotationSetup.state,
          gameFromResult(result),
          rng,
        );
        rotationSetup = { ...rotationSetup, state: injury.state };
      }
    } catch (error) {
      rawFailures.push(...parseThrownInvariantError(error));
    }

    for (const raw of rawFailures) {
      const mapped = toLabFailure(raw, failureCtx);
      if (mapped.severity === "HARD_FAILURE") {
        hardFailures.push(mapped);
      } else if (mapped.severity === "WARNING") {
        warnings.push(mapped);
      }
    }
  }

  const aggregates =
    snapshots.length > 0 ? aggregateSnapshots(snapshots, options.seed) : null;
  const plausibilityChecks = aggregates ? evaluatePlausibility(aggregates) : [];
  const correlations = aggregates
    ? evaluatePlayerCorrelations(
        homePlayers,
        awayPlayers,
        snapshots,
        playerGameStats,
      )
    : [];
  const overallVerdict = combineVerdicts([
    ...plausibilityChecks.map((check) => check.verdict),
    ...correlations.map((corr) => corr.verdict),
  ]);
  const checksum = computeValidationChecksum({
    seed: options.seed,
    gamesSimulated: snapshots.length,
    aggregates: aggregates ?? emptyAggregates(options.seed),
    invariantFailureCount: hardFailures.length,
    plausibilityChecks,
    correlations,
    overallVerdict,
  });

  return {
    seed: options.seed,
    scenarioId,
    gamesSimulated: options.games,
    rotation,
    engineIdentity,
    reproCommand,
    hardFailures,
    warnings,
    statChecks: plausibilityChecks,
    checksum,
    aggregates,
    overtimeHighCount,
  };
}

function playerStatsMap(result: {
  playerStats: readonly {
    playerId: string;
    points: number;
    rebounds: number;
    assists: number;
  }[];
}): Map<string, { points: number; rebounds: number; assists: number }> {
  const map = new Map<
    string,
    { points: number; rebounds: number; assists: number }
  >();
  for (const row of result.playerStats) {
    map.set(row.playerId, {
      points: row.points,
      rebounds: row.rebounds,
      assists: row.assists,
    });
  }
  return map;
}

function emptyAggregates(seed: number | string) {
  const zero = {
    n: 0,
    mean: 0,
    median: 0,
    min: 0,
    max: 0,
    stdev: 0,
  };
  return {
    gamesSimulated: 0,
    seed,
    teamPoints: zero,
    gameTotals: zero,
    absoluteDifferentials: zero,
    possessionsPerTeam: zero,
    pointsPerPossession: zero,
    fieldGoalPct: zero,
    threePointPct: zero,
    freeThrowPct: zero,
    offensiveRebounds: zero,
    defensiveRebounds: zero,
    totalRebounds: zero,
    assists: zero,
    turnovers: zero,
    fouls: zero,
    freeThrowAttempts: zero,
    assistToFgmRatio: zero,
    pooledShooting: {
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      fieldGoalPct: null,
      threePointersMade: 0,
      threePointersAttempted: 0,
      threePointPct: null,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      freeThrowPct: null,
    },
    homeAway: {
      homeWinRate: 0,
      homeWins: 0,
      awayWins: 0,
      homePoints: zero,
      awayPoints: zero,
      homeFieldGoalPct: zero,
      awayFieldGoalPct: zero,
      homeThreePointPct: zero,
      awayThreePointPct: zero,
      homeTurnovers: zero,
      awayTurnovers: zero,
    },
  };
}
