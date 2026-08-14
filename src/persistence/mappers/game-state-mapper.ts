import { z } from "zod";
import type { Contract } from "@/domain/entities/contract";
import type {
  DevelopmentState,
  InjuryStatus,
  Player,
  PlayerAttributes,
  PlayerPersonality,
  PlayerPosition,
  PlayerPotential,
} from "@/domain/entities/player";
import type { ContractId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";

const gameStateEnvelopeSchema = z.object({
  meta: z.object({
    saveId: z.string().min(1),
    schemaVersion: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    rngSeed: z.number().int(),
    rngState: z.number().int().optional(),
  }),
  world: z.object({}).passthrough(),
  competition: z.object({}).passthrough(),
  business: z.object({}).passthrough(),
  user: z.object({}).passthrough(),
});

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeGameState(stateJson: string): GameState {
  const parsed: unknown = JSON.parse(stateJson);
  const envelope = gameStateEnvelopeSchema.parse(parsed);

  if (envelope.meta.schemaVersion === 1) {
    return migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(parsed as GameStateV1)));
  }

  if (envelope.meta.schemaVersion === 2) {
    return migrateV3ToV4(migrateV2ToV3(parsed as GameStateV2));
  }

  if (envelope.meta.schemaVersion === 3) {
    return migrateV3ToV4(parsed as GameStateV3);
  }

  if (envelope.meta.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported GameState schemaVersion ${envelope.meta.schemaVersion}; expected ${GAME_STATE_SCHEMA_VERSION}.`,
    );
  }

  const state = parsed as GameState;
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 4.");
  }

  return state;
}

type LegacyPlayerRatings = {
  overall: number;
  offense: number;
  defense: number;
};

type PlayerV2 = {
  id: PlayerId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
  age: number;
  ratings: LegacyPlayerRatings;
};

/** Historical schema v3 attribute shape (not the current domain model). */
type PlayerV3Attributes = {
  shooting: number;
  finishing: number;
  passing: number;
  ballHandling: number;
  perimeterDefense: number;
  interiorDefense: number;
  rebounding: number;
  athleticism: number;
  basketballIq: number;
};

type PlayerV3 = {
  id: PlayerId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  position: PlayerPosition;
  attributes: PlayerV3Attributes;
  potential: PlayerPotential;
  personality: PlayerPersonality;
  contractId: ContractId | null;
  injury: InjuryStatus;
  development: DevelopmentState;
};

type GameStateV1 = {
  meta: {
    saveId: string;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    rngSeed: number;
    rngState?: number;
  };
  world: {
    players: Record<string, unknown>;
  } & Omit<GameState["world"], "players">;
  competition: GameState["competition"];
  business: GameState["business"];
  user: GameState["user"];
};

type GameStateV2 = {
  meta: {
    saveId: string;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    rngSeed: number;
    rngState?: number;
  };
  world: {
    players: Record<string, PlayerV2>;
  } & Omit<GameState["world"], "players">;
  competition: GameState["competition"];
  business: GameState["business"];
  user: GameState["user"];
};

type GameStateV3 = {
  meta: {
    saveId: string;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    rngSeed: number;
    rngState?: number;
  };
  world: {
    players: Record<string, PlayerV3>;
  } & Omit<GameState["world"], "players">;
  competition: GameState["competition"];
  business: GameState["business"];
  user: GameState["user"];
};

function migrateV1ToV2(state: GameStateV1): GameStateV2 {
  const players: Record<string, PlayerV2> = {};
  for (const [playerId, player] of Object.entries(state.world.players)) {
    const legacy = player as {
      id: string;
      teamId: string | null;
      firstName: string;
      lastName: string;
      position: string;
      age: number;
      ratings?: { overall: number; offense: number; defense: number };
    };
    players[playerId] = {
      id: legacy.id as PlayerId,
      teamId: legacy.teamId as TeamId | null,
      firstName: legacy.firstName,
      lastName: legacy.lastName,
      position: legacy.position as PlayerPosition,
      age: legacy.age,
      ratings: legacy.ratings ?? {
        overall: 70,
        offense: 70,
        defense: 70,
      },
    };
  }

  const games: GameState["competition"]["games"] = {};
  for (const [gameId, game] of Object.entries(state.competition.games)) {
    const legacy = game as {
      id: string;
      seasonId: string;
      date: string;
      homeTeamId: string;
      awayTeamId: string;
      status: "scheduled" | "final";
      homeScore: number | null;
      awayScore: number | null;
      boxScore?: GameState["competition"]["games"][string]["boxScore"];
    };
    games[gameId] = {
      ...legacy,
      id: legacy.id as GameState["competition"]["games"][string]["id"],
      seasonId: legacy.seasonId as GameState["competition"]["games"][string]["seasonId"],
      homeTeamId: legacy.homeTeamId as GameState["competition"]["games"][string]["homeTeamId"],
      awayTeamId: legacy.awayTeamId as GameState["competition"]["games"][string]["awayTeamId"],
      boxScore: legacy.boxScore ?? null,
    };
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 2,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState ?? state.meta.rngSeed,
    },
    world: {
      ...state.world,
      players,
    },
    competition: {
      ...state.competition,
      games,
    },
    business: state.business,
    user: state.user,
  };
}

function migrateV2ToV3(state: GameStateV2): GameStateV3 {
  const players: Record<string, PlayerV3> = {};
  for (const [playerId, player] of Object.entries(state.world.players)) {
    players[playerId] = migratePlayerV2ToV3(player, state.business.contracts);
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 3,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState ?? state.meta.rngSeed,
    },
    world: {
      ...state.world,
      players,
    },
    competition: state.competition,
    business: state.business,
    user: state.user,
  };
}

/**
 * Deterministic v2 → v3 player mapping (no randomness).
 *
 * Legacy ratings.offense → shooting, finishing, passing, ballHandling
 * Legacy ratings.defense → perimeterDefense, interiorDefense, rebounding
 * Legacy ratings.overall → athleticism, basketballIq
 * potential.overall ← ratings.overall
 *
 * Produces the historical 9-attribute v3 shape, not the current domain Player.
 */
function migratePlayerV2ToV3(
  player: PlayerV2,
  contracts: Record<string, Contract>,
): PlayerV3 {
  const { overall, offense, defense } = player.ratings;

  const attributes: PlayerV3Attributes = {
    shooting: offense,
    finishing: offense,
    passing: offense,
    ballHandling: offense,
    perimeterDefense: defense,
    interiorDefense: defense,
    rebounding: defense,
    athleticism: overall,
    basketballIq: overall,
  };

  const potential: PlayerPotential = { overall };
  const personality: PlayerPersonality = {
    workEthic: 50,
    loyalty: 50,
    competitiveness: 50,
    leadership: 50,
    composure: 50,
  };
  const injury: InjuryStatus = { kind: "healthy" };
  const development: DevelopmentState = { stage: "prime" };

  return {
    id: player.id,
    teamId: player.teamId,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    age: player.age,
    heightInches: 78,
    weightPounds: 215,
    attributes,
    potential,
    personality,
    contractId: findUniqueContractId(player.id, contracts),
    injury,
    development,
  };
}

function migrateV3ToV4(state: GameStateV3): GameState {
  const players: Record<string, Player> = {};
  for (const [playerId, player] of Object.entries(state.world.players)) {
    players[playerId] = migratePlayerV3ToV4(player);
  }

  return {
    meta: {
      saveId: state.meta.saveId as GameState["meta"]["saveId"],
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState ?? state.meta.rngSeed,
    },
    world: {
      ...state.world,
      players,
    },
    competition: state.competition,
    business: state.business,
    user: state.user,
  };
}

/**
 * Deterministic v3 → v4 player mapping (no randomness, no external state).
 *
 * shooting → midRange, threePoint, freeThrow
 * athleticism → athleticism, speed, strength, stamina
 * perimeterDefense → perimeterDefense, steal
 * interiorDefense → interiorDefense, block
 * basketballIq → basketballIq, offensiveIq, defensiveIq, consistency
 * finishing, passing, ballHandling, rebounding → same-named fields
 */
function migratePlayerV3ToV4(player: PlayerV3): Player {
  const v3 = player.attributes;

  const attributes: PlayerAttributes = {
    speed: v3.athleticism,
    strength: v3.athleticism,
    athleticism: v3.athleticism,
    stamina: v3.athleticism,
    finishing: v3.finishing,
    midRange: v3.shooting,
    threePoint: v3.shooting,
    freeThrow: v3.shooting,
    ballHandling: v3.ballHandling,
    passing: v3.passing,
    perimeterDefense: v3.perimeterDefense,
    interiorDefense: v3.interiorDefense,
    steal: v3.perimeterDefense,
    block: v3.interiorDefense,
    rebounding: v3.rebounding,
    basketballIq: v3.basketballIq,
    offensiveIq: v3.basketballIq,
    defensiveIq: v3.basketballIq,
    consistency: v3.basketballIq,
  };

  return {
    id: player.id,
    teamId: player.teamId,
    firstName: player.firstName,
    lastName: player.lastName,
    age: player.age,
    heightInches: player.heightInches,
    weightPounds: player.weightPounds,
    position: player.position,
    attributes,
    potential: { ...player.potential },
    personality: { ...player.personality },
    contractId: player.contractId,
    injury: { ...player.injury },
    development: { ...player.development },
  };
}

function findUniqueContractId(
  playerId: PlayerId,
  contracts: Record<string, Contract>,
): ContractId | null {
  const matches = Object.values(contracts).filter(
    (contract) => contract.playerId === playerId,
  );
  if (matches.length === 1) {
    return matches[0]!.id;
  }
  return null;
}
