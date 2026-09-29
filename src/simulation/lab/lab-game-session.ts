import type { GameResult } from "@/domain/entities/game-result";
import type { Player } from "@/domain/entities/player";
import { asGameId, asTeamId, type TeamId } from "@/domain/ids";
import { createSeededRng, type Rng } from "@/domain/rng";
import {
  parseThrownInvariantError,
  gameFromResult,
} from "@/simulation/lab/collect-game-failures";
import { createLabScheduledGame } from "@/simulation/lab/create-lab-game";
import {
  assertGameModeSeedList,
  buildGameModeSeedList,
  labGameStreamName,
  labRosterStreamName,
  seedForStream,
  type LabSeedListEntry,
} from "@/simulation/lab/lab-seeds";
import {
  buildLabRotationState,
  type LabRotationSetup,
} from "@/simulation/lab/rotation-state";
import {
  getScenarioBuilder,
  isLabScenarioId,
} from "@/simulation/lab/scenarios";
import { INJURY_HEAVY_SCENARIO_ID } from "@/simulation/lab/scenarios/injury-heavy";
import { buildNormalRosters } from "@/simulation/lab/scenarios/normal";
import { NORMAL_SCENARIO_ID } from "@/simulation/lab/scenarios/normal";
import type {
  LabRotationMode,
  LabScenarioBuilder,
  RawInvariantFailure,
} from "@/simulation/lab/types";
import { simulateGame } from "@/systems/game-simulation";
import { processPostGameInjuryExposures } from "@/systems/injury/injury-post-game";

export type LabGameSessionOptions = {
  seed: number | string;
  games: number;
  scenarioId?: string;
  rotation?: LabRotationMode;
  buildRosters?: LabScenarioBuilder;
  rosterSize?: number;
  seedList?: LabSeedListEntry[];
};

export type LabGameSession = {
  seed: number | string;
  games: number;
  scenarioId: string;
  rotation: LabRotationMode;
  seedList: LabSeedListEntry[];
  homePlayers: Player[];
  awayPlayers: Player[];
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  homeIds: Set<string>;
  awayIds: Set<string>;
  rotationSetup: LabRotationSetup | null;
};

export type PlayedLabGame = {
  gameIndex: number;
  gameSeed: number;
  result: GameResult | null;
  thrown: RawInvariantFailure[];
};

const DEFAULT_ROTATION: LabRotationMode = "on";

export function resolveLabGameConfig(options: LabGameSessionOptions): {
  scenarioId: string;
  rotation: LabRotationMode;
  seedList: LabSeedListEntry[];
} {
  if (!Number.isInteger(options.games) || options.games < 1) {
    throw new Error("createLabGameSession: games must be a positive integer.");
  }
  const scenarioId = options.scenarioId ?? NORMAL_SCENARIO_ID;
  const rotation = options.rotation ?? DEFAULT_ROTATION;
  const seedList =
    options.seedList ??
    buildGameModeSeedList(options.seed, scenarioId, options.games);
  assertGameModeSeedList(seedList, scenarioId, options.games);
  return { scenarioId, rotation, seedList };
}

export function createLabGameSession(
  options: LabGameSessionOptions,
): LabGameSession {
  const { scenarioId, rotation, seedList } = resolveLabGameConfig(options);

  const rosterRng = createSeededRng(
    seedForStream(seedList, labRosterStreamName(scenarioId)),
  );
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
  const generated = buildRosters(rosterRng);

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

  return {
    seed: options.seed,
    games: options.games,
    scenarioId,
    rotation,
    seedList,
    homePlayers,
    awayPlayers,
    homeTeamId,
    awayTeamId,
    homeIds: new Set(homePlayers.map((player) => player.id as string)),
    awayIds: new Set(awayPlayers.map((player) => player.id as string)),
    rotationSetup,
  };
}

export function playLabGame(
  session: LabGameSession,
  gameIndex: number,
  afterSimulateGame?: (result: GameResult) => GameResult,
): PlayedLabGame {
  if (!Number.isInteger(gameIndex) || gameIndex < 0) {
    throw new Error("playLabGame: gameIndex must be a non-negative integer.");
  }
  const gameSeed = seedForStream(
    session.seedList,
    labGameStreamName(session.scenarioId, gameIndex),
  );
  const homeFirst = gameIndex % 2 === 0;
  const venueHomeId = homeFirst ? session.homeTeamId : session.awayTeamId;
  const venueAwayId = homeFirst ? session.awayTeamId : session.homeTeamId;
  const gameHomePlayers = homeFirst ? session.homePlayers : session.awayPlayers;
  const gameAwayPlayers = homeFirst ? session.awayPlayers : session.homePlayers;
  const game = createLabScheduledGame({
    id: asGameId(`val_game_${gameIndex}`),
    homeTeamId: venueHomeId,
    awayTeamId: venueAwayId,
  });
  const rng = createSeededRng(gameSeed);
  const thrown: RawInvariantFailure[] = [];
  let result: GameResult | null = null;
  try {
    const simulated = simulateGame(
      game,
      {
        homePlayers: gameHomePlayers,
        awayPlayers: gameAwayPlayers,
        homeStartingLineup: session.rotationSetup
          ? homeFirst
            ? session.rotationSetup.homeStarters
            : session.rotationSetup.awayStarters
          : undefined,
        awayStartingLineup: session.rotationSetup
          ? homeFirst
            ? session.rotationSetup.awayStarters
            : session.rotationSetup.homeStarters
          : undefined,
        gameState: session.rotationSetup?.state,
      },
      rng,
    );
    result = afterSimulateGame ? afterSimulateGame(simulated) : simulated;
    if (
      session.scenarioId === INJURY_HEAVY_SCENARIO_ID &&
      session.rotationSetup
    ) {
      const injury = processPostGameInjuryExposures(
        session.rotationSetup.state,
        gameFromResult(result),
        rng,
      );
      session.rotationSetup = { ...session.rotationSetup, state: injury.state };
    }
  } catch (error) {
    thrown.push(...parseThrownInvariantError(error));
  }
  return { gameIndex, gameSeed, result, thrown };
}

export function labGamePlayerIds(
  session: LabGameSession,
  gameIndex: number,
): { homePlayerIds: Set<string>; awayPlayerIds: Set<string> } {
  const homeFirst = gameIndex % 2 === 0;
  return {
    homePlayerIds: homeFirst ? session.homeIds : session.awayIds,
    awayPlayerIds: homeFirst ? session.awayIds : session.homeIds,
  };
}

export function labGameRosters(
  session: LabGameSession,
  gameIndex: number,
): { homePlayers: Player[]; awayPlayers: Player[] } {
  const homeFirst = gameIndex % 2 === 0;
  return {
    homePlayers: homeFirst ? session.homePlayers : session.awayPlayers,
    awayPlayers: homeFirst ? session.awayPlayers : session.homePlayers,
  };
}
