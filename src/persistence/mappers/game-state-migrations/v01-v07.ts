import {
  type GameId,
  type SeasonId,
  type TeamId,
  type PlayerId,
  type ContractId,
  type DivisionId,
  type ConferenceId,
  type StaffId,
  type ArenaId,
  asArenaId,
} from "@/domain/ids";
import {
  type PlayerPosition,
  type PlayerPotential,
  type PlayerPersonality,
  type InjuryStatus,
  type DevelopmentState,
  type PlayerAttributes,
  type Player,
  migrateLegacyInjuryStatus,
  defaultDurabilityForAge,
} from "@/domain/entities/player";
import type { PlayerArchetype } from "@/domain/entities/player-archetype";
import type { TeamPlayStyle } from "@/domain/entities/team";
import type { GameState } from "@/state/game-state";
import type { PlayerNationality } from "@/domain/entities/player-nationality";
import type {
  BusinessSliceV14,
  UserSliceV14,
  ContractV15,
  GameStateV8,
  GameV8,
} from "@/persistence/mappers/game-state-migrations/v08-v12";
import { findUniqueContractId } from "@/persistence/mappers/game-state-migrations/shared";

/** Schema v7 game shape before score/events/playerStats. */
type GameV7 = {
  id: GameId;
  seasonId: SeasonId;
  date: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: "scheduled" | "final";
  homeScore: number | null;
  awayScore: number | null;
  boxScore:
    | {
        playerId: PlayerId;
        minutes: number;
        points: number;
        rebounds: number;
        assists: number;
        steals?: number;
        blocks?: number;
        turnovers?: number;
        fouls?: number;
      }[]
    | null;
};

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

/** Schema v4 player: 19 attributes, no archetype. */
type PlayerV4 = {
  id: PlayerId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  position: PlayerPosition;
  attributes: PlayerAttributes;
  potential: PlayerPotential;
  personality: PlayerPersonality;
  contractId: ContractId | null;
  injury: InjuryStatus;
  development: DevelopmentState;
};

/** Schema v5 player: has archetype, no nationality. */
type PlayerV5 = {
  id: PlayerId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  position: PlayerPosition;
  archetype: PlayerArchetype;
  attributes: PlayerAttributes;
  potential: PlayerPotential;
  personality: PlayerPersonality;
  contractId: ContractId | null;
  injury: InjuryStatus;
  development: DevelopmentState;
};

type TeamV6 = {
  id: TeamId;
  divisionId: DivisionId;
  city: string;
  name: string;
  abbreviation: string;
};

/** Explicit v7–v10 team shape before Team.playStyle. Do not derive from current Team. */
type TeamV10 = {
  id: TeamId;
  name: string;
  city: string;
  abbreviation: string;
  conferenceId: ConferenceId;
  divisionId: DivisionId;
  roster: PlayerId[];
  staff: StaffId[];
  finances: Record<never, never>;
  arenaId: ArenaId;
  reputation: number;
};

/** Explicit v11 team shape before Team.coachingPhilosophy. Do not derive from current Team. */
export type TeamV11 = {
  id: TeamId;
  name: string;
  city: string;
  abbreviation: string;
  conferenceId: ConferenceId;
  divisionId: DivisionId;
  roster: PlayerId[];
  staff: StaffId[];
  finances: Record<never, never>;
  arenaId: ArenaId;
  reputation: number;
  playStyle: TeamPlayStyle;
};

type CompetitionWithLegacyGames = Omit<GameState["competition"], "games"> & {
  games: Record<string, GameV7>;
};

export type WorldWithTeamV10 = Omit<GameState["world"], "teams"> & {
  teams: Record<string, TeamV10>;
};

export type GameStateV7 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 7 };
  world: WorldWithTeamV10;
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

export type GameStateV6 = Omit<
  GameState,
  "meta" | "settings" | "world" | "competition" | "business" | "user"
> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 6 };
  world: Omit<GameState["world"], "players" | "teams"> & {
    players: Record<string, Player>;
    teams: Record<string, TeamV6>;
  };
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

export type GameStateV1 = {
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
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

export type GameStateV2 = {
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
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

export type GameStateV3 = {
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
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

export type GameStateV4 = {
  meta: {
    saveId: string;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    rngSeed: number;
    rngState?: number;
  };
  world: {
    players: Record<string, PlayerV4>;
  } & Omit<GameState["world"], "players">;
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

export type GameStateV5 = {
  meta: {
    saveId: string;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    rngSeed: number;
    rngState?: number;
  };
  world: {
    players: Record<string, PlayerV5>;
  } & Omit<GameState["world"], "players">;
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

const ARCHETYPE_FROM_POSITION: Record<PlayerPosition, PlayerArchetype> = {
  PG: "floor_general",
  SG: "scoring_guard",
  SF: "three_and_d_wing",
  PF: "two_way_forward",
  C: "rim_protector",
};

/**
 * Legacy compatibility: all pre-nationality players receive "USA".
 * Fixed mapping only — migration never uses RNG.
 */
const LEGACY_PLAYER_NATIONALITY: PlayerNationality = "USA";

export function migrateV1ToV2(state: GameStateV1): GameStateV2 {
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

  const games: Record<string, GameV7> = {};
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
      boxScore?: GameV7["boxScore"];
    };
    games[gameId] = {
      ...legacy,
      id: legacy.id as GameId,
      seasonId: legacy.seasonId as SeasonId,
      homeTeamId: legacy.homeTeamId as TeamId,
      awayTeamId: legacy.awayTeamId as TeamId,
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

export function migrateV2ToV3(state: GameStateV2): GameStateV3 {
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
  contracts: Record<string, ContractV15>,
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

export function migrateV3ToV4(state: GameStateV3): GameStateV4 {
  const players: Record<string, PlayerV4> = {};
  for (const [playerId, player] of Object.entries(state.world.players)) {
    players[playerId] = migratePlayerV3ToV4(player);
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 4,
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
function migratePlayerV3ToV4(player: PlayerV3): PlayerV4 {
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

/**
 * Deterministic v4 → v5: preserve all player data; only add archetype from position.
 * Does not consume RNG or alter rngState.
 */
export function migrateV4ToV5(state: GameStateV4): GameStateV5 {
  const players: Record<string, PlayerV5> = {};
  for (const [playerId, player] of Object.entries(state.world.players)) {
    players[playerId] = migratePlayerV4ToV5(player);
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 5,
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

function migratePlayerV4ToV5(player: PlayerV4): PlayerV5 {
  return {
    ...player,
    attributes: { ...player.attributes },
    potential: { ...player.potential },
    personality: { ...player.personality },
    injury: { ...player.injury },
    development: { ...player.development },
    archetype: ARCHETYPE_FROM_POSITION[player.position],
  };
}

/**
 * Deterministic v5 → v6: preserve all player data; only add nationality.
 * Legacy compatibility: every pre-nationality player receives "USA".
 * Does not consume RNG or alter rngState.
 */
export function migrateV5ToV6(state: GameStateV5): GameStateV6 {
  const players: Record<string, Player> = {};
  for (const [playerId, player] of Object.entries(state.world.players)) {
    players[playerId] = migratePlayerV5ToV6(player);
  }

  return {
    meta: {
      saveId: state.meta.saveId as GameState["meta"]["saveId"],
      schemaVersion: 6,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState ?? state.meta.rngSeed,
    },
    world: {
      ...state.world,
      players,
      teams: state.world.teams as Record<string, TeamV6>,
    },
    competition: state.competition,
    business: state.business,
    user: state.user,
  };
}

function migratePlayerV5ToV6(player: PlayerV5): Player {
  const migrated = migrateLegacyInjuryStatus(player.injury);
  return {
    ...player,
    attributes: { ...player.attributes },
    potential: { ...player.potential },
    personality: { ...player.personality },
    availability: migrated.availability,
    activeInjuries: migrated.activeInjuries,
    injury: migrated.injury,
    suspension: migrated.suspension,
    physical: { durability: defaultDurabilityForAge(player.age) },
    conditioning: 100,
    injuryHistory: [],
    development: { ...player.development },
    nationality: LEGACY_PLAYER_NATIONALITY,
    // Pre-DL save: normalizeDevelopmentLeagueProfile fills this in a later step.
  } as unknown as Player;
}

/**
 * Deterministic v6 → v7: preserve all team identity fields; add relationship
 * placeholders. conferenceId comes from the team's division. Does not consume
 * RNG or alter rngState.
 */
export function migrateV6ToV7(state: GameStateV6): GameStateV7 {
  const teams: Record<string, TeamV10> = {};

  for (const [teamId, team] of Object.entries(state.world.teams)) {
    const division = state.world.divisions[team.divisionId];
    if (!division) {
      throw new Error(
        `Team ${teamId} references missing division ${team.divisionId}.`,
      );
    }

    teams[teamId] = {
      id: team.id,
      name: team.name,
      city: team.city,
      abbreviation: team.abbreviation,
      conferenceId: division.conferenceId as ConferenceId,
      divisionId: team.divisionId,
      roster: [],
      staff: [],
      finances: {},
      arenaId: asArenaId(`arena_${team.id}`),
      reputation: 50,
    };
  }

  return {
    meta: {
      saveId: state.meta.saveId as GameState["meta"]["saveId"],
      schemaVersion: 7,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState ?? state.meta.rngSeed,
    },
    world: {
      ...state.world,
      teams,
    },
    competition: state.competition,
    business: state.business,
    user: state.user,
  };
}

/**
 * Deterministic v7 → v8: convert nullable home/away scores and boxScore into
 * score, events, and playerStats. Does not consume RNG or alter rngState.
 */
export function migrateV7ToV8(state: GameStateV7): GameStateV8 {
  const games: Record<string, GameV8> = {};

  for (const [gameId, legacy] of Object.entries(state.competition.games)) {
    const boxScore = legacy.boxScore ?? [];
    games[gameId] = {
      id: legacy.id,
      seasonId: legacy.seasonId,
      date: legacy.date,
      homeTeamId: legacy.homeTeamId,
      awayTeamId: legacy.awayTeamId,
      status: legacy.status,
      score: {
        home: legacy.homeScore ?? 0,
        away: legacy.awayScore ?? 0,
      },
      events: [],
      playerStats: boxScore.map((entry) => ({
        playerId: entry.playerId,
        minutes: entry.minutes,
        points: entry.points,
        rebounds: entry.rebounds,
        assists: entry.assists,
        steals: entry.steals ?? 0,
        blocks: entry.blocks ?? 0,
        turnovers: entry.turnovers ?? 0,
        fouls: entry.fouls ?? 0,
      })),
    };
  }

  return {
    meta: {
      saveId: state.meta.saveId as GameState["meta"]["saveId"],
      schemaVersion: 8,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState ?? state.meta.rngSeed,
    },
    world: state.world,
    competition: {
      ...state.competition,
      games,
    },
    business: state.business,
    user: state.user,
  };
}
