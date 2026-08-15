import { z } from "zod";
import type { Game } from "@/domain/entities/game";
import type {
  DevelopmentState,
  InjuryStatus,
  Player,
  PlayerAttributes,
  PlayerPersonality,
  PlayerPosition,
  PlayerPotential,
} from "@/domain/entities/player";
import type { PlayerArchetype } from "@/domain/entities/player-archetype";
import type { PlayerNationality } from "@/domain/entities/player-nationality";
import type { Team, TeamPlayStyle } from "@/domain/entities/team";
import { NEUTRAL_TEAM_PLAY_STYLE } from "@/domain/entities/team";
import { createEmptyTeamFinanceBooks } from "@/domain/entities/finances";
import type { TeamFinances } from "@/domain/entities/finances";
import { DEFAULT_COACHING_PHILOSOPHY } from "@/domain/coaching/coaching-philosophy";
import type {
  ArenaId,
  ConferenceId,
  ContractId,
  DivisionId,
  GameId,
  PlayerId,
  SeasonId,
  StaffId,
  TeamId,
} from "@/domain/ids";
import { asArenaId } from "@/domain/ids";
import { addCalendarDays } from "@/domain/calendar-date";
import type { GameState } from "@/state/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { calculateStandings } from "@/systems/standings";
import { validateGameState } from "@/persistence/validate-game-state";
import { generateDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import type { OffseasonStage, SeasonPhase } from "@/domain/entities/season";

const gameStateEnvelopeSchema = z.object({
  meta: z.object({
    saveId: z.string().min(1),
    schemaVersion: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    rngSeed: z.number().int(),
    rngState: z.number().int().optional(),
  }),
  world: z
    .object({
      calendar: z.unknown(),
      league: z.unknown(),
      conferences: z.unknown(),
      divisions: z.unknown(),
      teams: z.unknown(),
      players: z.unknown(),
      coaches: z.unknown(),
      staff: z.unknown(),
    })
    .passthrough(),
  competition: z
    .object({
      season: z.unknown(),
      schedule: z.unknown(),
      games: z.unknown(),
      standings: z.unknown(),
    })
    .passthrough(),
  business: z
    .object({
      contracts: z.unknown(),
      finances: z.unknown(),
    })
    .passthrough(),
  user: z
    .object({
      controlledTeamId: z.unknown(),
      mode: z.unknown(),
    })
    .passthrough(),
});

/** JSON.stringify only. Does not validate or mutate state. */
export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * One-step upgrades keyed by the source schema version.
 * Current version is never keyed here — no nonexistent N→N+1 step.
 */
const MIGRATE_ONE_STEP: Record<number, (state: unknown) => unknown> = {
  1: (state) => migrateV1ToV2(state as GameStateV1),
  2: (state) => migrateV2ToV3(state as GameStateV2),
  3: (state) => migrateV3ToV4(state as GameStateV3),
  4: (state) => migrateV4ToV5(state as GameStateV4),
  5: (state) => migrateV5ToV6(state as GameStateV5),
  6: (state) => migrateV6ToV7(state as GameStateV6),
  7: (state) => migrateV7ToV8(state as GameStateV7),
  8: (state) => migrateV8ToV9(state as GameStateV8),
  9: (state) => migrateV9ToV10(state as GameStateV9),
  10: (state) => migrateV10ToV11(state as GameStateV10),
  11: (state) => migrateV11ToV12(state as GameStateV11),
  12: (state) => migrateV12ToV13(state as GameStateV12),
  13: (state) => migrateV13ToV14(state as GameStateV13),
  14: (state) => migrateV14ToV15(state as GameStateV14),
  15: (state) => migrateV15ToV16(state as GameStateV15),
  16: (state) => migrateV16ToV17(state as GameStateV16),
  17: (state) => migrateV17ToV18(state as GameStateV17),
  18: (state) => migrateV18ToV19(state as GameStateV18),
  19: (state) => migrateV19ToV20(state as GameStateV19),
  20: (state) => migrateV20ToV21(state as GameStateV20),
  21: (state) => migrateV21ToV22(state as GameStateV21),
  22: (state) => migrateV22ToV23(state as GameStateV22),
};

/**
 * Parse → migrate (v1–v22 → current) → validate → return GameState.
 * Does not call serializeGameState.
 */
export function deserializeGameState(stateJson: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stateJson);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Malformed GameState JSON: ${detail}`);
  }

  let envelope: z.infer<typeof gameStateEnvelopeSchema>;
  try {
    envelope = gameStateEnvelopeSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid GameState envelope: ${error.issues.map((issue) => issue.message).join("; ")}`,
      );
    }
    throw error;
  }

  let version = envelope.meta.schemaVersion;

  if (version > GAME_STATE_SCHEMA_VERSION) {
    throw new Error(
      `Save schema version ${version} is newer than the supported version ${GAME_STATE_SCHEMA_VERSION}.\nThis save was created by a newer version of the game.`,
    );
  }

  if (version < 1) {
    throw new Error(
      `Unsupported GameState schemaVersion ${version}; expected a version between 1 and ${GAME_STATE_SCHEMA_VERSION}.`,
    );
  }

  let state: unknown = parsed;
  while (version < GAME_STATE_SCHEMA_VERSION) {
    const migrateStep = MIGRATE_ONE_STEP[version];
    if (!migrateStep) {
      throw new Error(
        `Unsupported GameState schemaVersion ${version}; expected a version between 1 and ${GAME_STATE_SCHEMA_VERSION}.`,
      );
    }
    state = migrateStep(state);
    version += 1;
  }

  validateGameState(state);
  return state;
}

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
type TeamV11 = {
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

type WorldWithTeamV10 = Omit<GameState["world"], "teams"> & {
  teams: Record<string, TeamV10>;
};

type GameStateV7 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 7 };
  world: WorldWithTeamV10;
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

type GameStateV6 = Omit<GameState, "meta" | "world" | "competition" | "business" | "user"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 6 };
  world: Omit<GameState["world"], "players" | "teams"> & {
    players: Record<string, Player>;
    teams: Record<string, TeamV6>;
  };
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
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
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
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
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
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
  competition: CompetitionWithLegacyGames;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

type GameStateV4 = {
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

type GameStateV5 = {
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

function migrateV3ToV4(state: GameStateV3): GameStateV4 {
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
function migrateV4ToV5(state: GameStateV4): GameStateV5 {
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
function migrateV5ToV6(state: GameStateV5): GameStateV6 {
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
  return {
    ...player,
    attributes: { ...player.attributes },
    potential: { ...player.potential },
    personality: { ...player.personality },
    injury: { ...player.injury },
    development: { ...player.development },
    nationality: LEGACY_PLAYER_NATIONALITY,
  };
}

/**
 * Deterministic v6 → v7: preserve all team identity fields; add relationship
 * placeholders. conferenceId comes from the team's division. Does not consume
 * RNG or alter rngState.
 */
function migrateV6ToV7(state: GameStateV6): GameStateV7 {
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
function migrateV7ToV8(state: GameStateV7): GameStateV8 {
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

/** Schema v8–v12 standings before expanded TeamStanding fields. */
type TeamStandingV12 = {
  teamId: TeamId;
  wins: number;
  losses: number;
};

type StandingsV12 = {
  byTeamId: Record<string, TeamStandingV12>;
};

type CompetitionV12 = {
  season: GameState["competition"]["season"];
  schedule: GameState["competition"]["schedule"];
  games: Record<string, Game>;
  standings: StandingsV12;
};

/** Schema ≤15 contracts before startYear / salaryByYear / options. */
type ContractV15 = {
  id: ContractId;
  playerId: PlayerId;
  teamId: TeamId;
  salaryPerYear: number;
  yearsRemaining: number;
};

/** Schema ≤14 finances before revenue/expenses. */
type TeamFinancesV14 = {
  teamId: TeamId;
  cash: number;
  payroll: number;
};

/** Schema 15–19 finances before period books (scalar revenue/expenses). */
type TeamFinancesV15ThroughV19 = {
  teamId: TeamId;
  cash: number;
  revenue: number;
  expenses: number;
  payroll: number;
};

type BusinessSliceV14 = {
  contracts: Record<string, ContractV15>;
  finances: Record<string, TeamFinancesV14>;
};

type BusinessSliceV15 = {
  contracts: Record<string, ContractV15>;
  finances: Record<string, TeamFinancesV15ThroughV19>;
};

/** Schema 16 business before freeAgency offers. */
type BusinessSliceV16 = {
  contracts: GameState["business"]["contracts"];
  finances: Record<string, TeamFinancesV15ThroughV19>;
};

/** Schema ≤14 user slice before owner objectives. */
type UserSliceV14 = {
  controlledTeamId: TeamId;
  mode: GameState["user"]["mode"];
};

/** Schema v8 game shape before periodScores and extended box-score fields. */
type GameV8 = {
  id: GameId;
  seasonId: SeasonId;
  date: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: "scheduled" | "in_progress" | "final";
  score: { home: number; away: number };
  events: Game["events"];
  playerStats: Array<{
    playerId: PlayerId;
    minutes: number;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fouls: number;
  }>;
};

type GameStateV8 = {
  meta: {
    saveId: string;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    rngSeed: number;
    rngState?: number;
  };
  world: WorldWithTeamV10;
  competition: {
    season: GameState["competition"]["season"];
    schedule: GameState["competition"]["schedule"];
    games: Record<string, GameV8>;
    standings: StandingsV12;
  };
  business: BusinessSliceV14;
  user: UserSliceV14;
};

/**
 * Deterministic v8 → v9: add periodScores and extended player stat fields.
 * Does not consume RNG or alter rngState.
 */
function migrateV8ToV9(state: GameStateV8): GameStateV9 {
  const games: Record<string, GameV9> = {};

  for (const [gameId, legacy] of Object.entries(state.competition.games)) {
    games[gameId] = {
      id: legacy.id,
      seasonId: legacy.seasonId,
      date: legacy.date,
      homeTeamId: legacy.homeTeamId,
      awayTeamId: legacy.awayTeamId,
      status: legacy.status,
      score: { ...legacy.score },
      periodScores: [],
      events: legacy.events.map((event) => ({ ...event })),
      playerStats: legacy.playerStats.map((entry) => ({
        playerId: entry.playerId,
        minutes: entry.minutes,
        points: entry.points,
        rebounds: entry.rebounds,
        offensiveRebounds: 0,
        defensiveRebounds: 0,
        assists: entry.assists,
        steals: entry.steals,
        blocks: entry.blocks,
        turnovers: entry.turnovers,
        fouls: entry.fouls,
        fieldGoalsMade: 0,
        fieldGoalsAttempted: 0,
        threePointersMade: 0,
        threePointersAttempted: 0,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
      })),
    };
  }

  return {
    meta: {
      saveId: state.meta.saveId as GameState["meta"]["saveId"],
      schemaVersion: 9,
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

/** Schema v9 game shape before touches on playerStats. */
type GameV9 = {
  id: GameId;
  seasonId: SeasonId;
  date: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: "scheduled" | "in_progress" | "final";
  score: { home: number; away: number };
  periodScores: Game["periodScores"];
  events: Game["events"];
  playerStats: Array<{
    playerId: PlayerId;
    minutes: number;
    points: number;
    rebounds: number;
    offensiveRebounds: number;
    defensiveRebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fouls: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    threePointersMade: number;
    threePointersAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
  }>;
};

type GameStateV9 = {
  meta: {
    saveId: string;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    rngSeed: number;
    rngState?: number;
  };
  world: WorldWithTeamV10;
  competition: {
    season: GameState["competition"]["season"];
    schedule: GameState["competition"]["schedule"];
    games: Record<string, GameV9>;
    standings: StandingsV12;
  };
  business: BusinessSliceV14;
  user: UserSliceV14;
};

/**
 * Deterministic v9 → v10: add touches to player box-score rows.
 * Does not consume RNG or alter rngState.
 */
function migrateV9ToV10(state: GameStateV9): GameStateV10 {
  const games: Record<string, Game> = {};

  for (const [gameId, legacy] of Object.entries(state.competition.games)) {
    games[gameId] = {
      id: legacy.id,
      seasonId: legacy.seasonId,
      date: legacy.date,
      homeTeamId: legacy.homeTeamId,
      awayTeamId: legacy.awayTeamId,
      status: legacy.status,
      score: { ...legacy.score },
      periodScores: legacy.periodScores.map((period) => ({ ...period })),
      events: legacy.events.map((event) => ({ ...event })),
      playerStats: legacy.playerStats.map((entry) => ({
        ...entry,
        touches: 0,
      })),
    };
  }

  return {
    meta: {
      saveId: state.meta.saveId as GameState["meta"]["saveId"],
      schemaVersion: 10,
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

type GameStateV10 = {
  meta: {
    saveId: string;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    rngSeed: number;
    rngState?: number;
  };
  world: WorldWithTeamV10;
  competition: {
    season: GameState["competition"]["season"];
    schedule: GameState["competition"]["schedule"];
    games: Record<string, Game>;
    standings: StandingsV12;
  };
  business: BusinessSliceV14;
  user: UserSliceV14;
};

/**
 * Deterministic v10 → v11: add neutral Team.playStyle.
 * Lossless except for the intended addition — preserves every existing team
 * field value-for-value. Does not reconstruct through createTeam, apply other
 * defaults, consume RNG, or normalize.
 */
function migrateV10ToV11(state: GameStateV10): GameStateV11 {
  const teams: Record<string, TeamV11> = Object.fromEntries(
    Object.entries(state.world.teams).map(([id, team]) => [
      id,
      {
        ...team,
        playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE },
      },
    ]),
  );

  return {
    meta: {
      saveId: state.meta.saveId as GameState["meta"]["saveId"],
      schemaVersion: 11,
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

type WorldWithTeamV11 = Omit<GameState["world"], "teams"> & {
  teams: Record<string, TeamV11>;
};

type GameStateV11 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 11;
    rngState: number;
  };
  world: WorldWithTeamV11;
  competition: CompetitionV12;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

type GameStateV12 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 12;
    rngState: number;
  };
  world: GameState["world"];
  competition: CompetitionV12;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

/**
 * Deterministic v11 → v12: add default Team.coachingPhilosophy.
 * Preserves every existing team field including playStyle value-for-value.
 * Does not reconstruct through createTeam or consume RNG.
 */
function migrateV11ToV12(state: GameStateV11): GameStateV12 {
  const teams: Record<string, Team> = Object.fromEntries(
    Object.entries(state.world.teams).map(([id, team]) => [
      id,
      {
        ...team,
        playStyle: { ...team.playStyle },
        coachingPhilosophy: { ...DEFAULT_COACHING_PHILOSOPHY },
      },
    ]),
  );

  return {
    meta: {
      saveId: state.meta.saveId as GameState["meta"]["saveId"],
      schemaVersion: 12,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
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
 * Deterministic v12 → v13: expand TeamStanding via calculateStandings.
 * Recomputes from the migrated state's teams, games, and schedule.
 */
function migrateV12ToV13(state: GameStateV12): GameStateV13 {
  const entries = calculateStandings(
    Object.values(state.world.teams),
    Object.values(state.competition.games),
    {
      seasonId: state.competition.season.id,
      gameOrderIds: state.competition.schedule.gameIds,
    },
  );

  const byTeamId: GameState["competition"]["standings"]["byTeamId"] = {};
  for (const entry of entries) {
    byTeamId[entry.teamId] = entry;
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 13,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: {
      season: state.competition.season,
      schedule: state.competition.schedule,
      games: state.competition.games,
      standings: { byTeamId },
    },
    business: state.business,
    user: state.user,
  };
}

type GameStateV13 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 13;
    rngState: number;
  };
  world: GameState["world"];
  competition: {
    season: GameState["competition"]["season"];
    schedule: GameState["competition"]["schedule"];
    games: GameState["competition"]["games"];
    standings: GameState["competition"]["standings"];
  };
  business: BusinessSliceV14;
  user: UserSliceV14;
};

type GameStateV14 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 14;
    rngState: number;
  };
  world: GameState["world"];
  competition: GameState["competition"];
  business: BusinessSliceV14;
  user: UserSliceV14;
};

type GameStateV15 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 15;
    rngState: number;
  };
  world: GameState["world"];
  competition: GameState["competition"];
  business: BusinessSliceV15;
  user: UserSliceV21;
};

/** Schema 15–21 user objectives before status/notifications/consequence keys. */
type OwnerObjectiveV21 = {
  id: string;
  type: string;
  description: string;
  completed: boolean;
  target?: number;
  progress?: number;
  seasonYear?: number;
};

type UserSliceV21 = {
  controlledTeamId: TeamId;
  mode: GameState["user"]["mode"];
  objectives: OwnerObjectiveV21[];
};

type GameStateV16 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 16;
    rngState: number;
  };
  world: WorldSliceV17;
  competition: GameState["competition"];
  business: BusinessSliceV16;
  user: UserSliceV21;
};

/** Schema 17 world before draftPicks. */
type WorldSliceV17 = {
  calendar: GameState["world"]["calendar"];
  league: GameState["world"]["league"];
  conferences: GameState["world"]["conferences"];
  divisions: GameState["world"]["divisions"];
  teams: GameState["world"]["teams"];
  players: GameState["world"]["players"];
  coaches: GameState["world"]["coaches"];
  staff: GameState["world"]["staff"];
};

/** Schema 17 business before tradeBlocks. */
type BusinessSliceV17 = {
  contracts: GameState["business"]["contracts"];
  finances: Record<string, TeamFinancesV15ThroughV19>;
  freeAgency: GameState["business"]["freeAgency"];
};

type GameStateV17 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 17;
    rngState: number;
  };
  world: WorldSliceV17;
  competition: GameState["competition"];
  business: BusinessSliceV17;
  user: UserSliceV21;
};

/** Schema 18 world before drafts. */
type WorldSliceV18 = {
  calendar: GameState["world"]["calendar"];
  league: GameState["world"]["league"];
  conferences: GameState["world"]["conferences"];
  divisions: GameState["world"]["divisions"];
  teams: GameState["world"]["teams"];
  players: GameState["world"]["players"];
  coaches: GameState["world"]["coaches"];
  staff: GameState["world"]["staff"];
  draftPicks: GameState["world"]["draftPicks"];
};

/** Schema 18–19 business before booksByYear. */
type BusinessSliceV18 = {
  contracts: GameState["business"]["contracts"];
  finances: Record<string, TeamFinancesV15ThroughV19>;
  freeAgency: GameState["business"]["freeAgency"];
  tradeBlocks: GameState["business"]["tradeBlocks"];
};

type GameStateV18 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 18;
    rngState: number;
  };
  world: WorldSliceV18;
  competition: GameState["competition"];
  business: BusinessSliceV18;
  user: UserSliceV21;
};

type GameStateV19 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 19;
    rngState: number;
  };
  world: {
    calendar: { currentDate: string };
    league: GameState["world"]["league"];
    conferences: GameState["world"]["conferences"];
    divisions: GameState["world"]["divisions"];
    teams: GameState["world"]["teams"];
    players: GameState["world"]["players"];
    coaches: GameState["world"]["coaches"];
    staff: GameState["world"]["staff"];
    draftPicks: GameState["world"]["draftPicks"];
    drafts: GameState["world"]["drafts"];
  };
  competition: {
    season: {
      id: SeasonId;
      year: number;
      phase: string;
    };
    schedule: GameState["competition"]["schedule"];
    games: GameState["competition"]["games"];
    standings: GameState["competition"]["standings"];
    playoffs: GameState["competition"]["playoffs"];
  };
  business: BusinessSliceV18;
  user: UserSliceV21;
};

/** Schema v20 before simulation backbone fields (calendar progress, offseason stage, scheduled events). */
type GameStateV20 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 20;
    rngState: number;
  };
  world: GameStateV19["world"];
  competition: GameStateV19["competition"];
  business: GameState["business"];
  user: UserSliceV21;
};

/** Schema v21 before owner gameplay notifications / objective status. */
type GameStateV21 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 21;
    rngState: number;
  };
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: UserSliceV21;
};

/**
 * Deterministic v13 → v14: add empty playoff tournament under competition.
 */
function migrateV13ToV14(state: GameStateV13): GameStateV14 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 13.");
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 14,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: {
      season: state.competition.season,
      schedule: state.competition.schedule,
      games: state.competition.games,
      standings: state.competition.standings,
      playoffs: createEmptyPlayoffTournament(),
    },
    business: state.business,
    user: state.user,
  };
}

/**
 * Deterministic v14 → v15: add empty owner objectives and finance revenue/expenses.
 * Emits literal schemaVersion 15 (not GAME_STATE_SCHEMA_VERSION).
 */
function migrateV14ToV15(state: GameStateV14): GameStateV15 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 14.");
  }

  const finances: Record<string, TeamFinancesV15ThroughV19> = Object.fromEntries(
    Object.entries(state.business.finances).map(([teamId, finance]) => [
      teamId,
      {
        teamId: finance.teamId,
        cash: finance.cash,
        revenue: 0,
        expenses: 0,
        payroll: finance.payroll,
      },
    ]),
  );

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 15,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: {
      contracts: state.business.contracts,
      finances,
    },
    user: {
      controlledTeamId: state.user.controlledTeamId,
      mode: state.user.mode,
      objectives: [],
    },
  };
}

/**
 * Deterministic v15 → v16: expand contracts to startYear/endYear/salaryByYear.
 * v15 has no options; migrated contracts never include teamOption or playerOption.
 * Emits literal schemaVersion 16.
 */
function migrateV15ToV16(state: GameStateV15): GameStateV16 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 15.");
  }

  const startYear = state.competition.season.year;
  const contracts: GameState["business"]["contracts"] = {};

  for (const [contractId, legacy] of Object.entries(state.business.contracts)) {
    const yearsRemaining =
      typeof legacy.yearsRemaining === "number" &&
      Number.isInteger(legacy.yearsRemaining) &&
      legacy.yearsRemaining >= 1
        ? legacy.yearsRemaining
        : 1;
    const endYear = startYear + yearsRemaining - 1;
    const salaryByYear: Record<string, number> = {};
    for (let year = startYear; year <= endYear; year += 1) {
      salaryByYear[String(year)] = legacy.salaryPerYear;
    }
    contracts[contractId] = {
      id: legacy.id,
      playerId: legacy.playerId,
      teamId: legacy.teamId,
      startYear,
      endYear,
      salaryByYear,
    };
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 16,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: {
      contracts,
      finances: state.business.finances,
    },
    user: state.user,
  };
}

/**
 * Deterministic v16 → v17: add empty freeAgency offers under business.
 * Emits literal schemaVersion 17.
 */
function migrateV16ToV17(state: GameStateV16): GameStateV17 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 16.");
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 17,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: {
      contracts: state.business.contracts,
      finances: state.business.finances,
      freeAgency: {
        offers: {},
      },
    },
    user: state.user,
  };
}

/**
 * Deterministic v17 → v18: add world.draftPicks and business.tradeBlocks.
 * Uses pure generateDraftPicksForSeason (no RNG, no bootstrap).
 * Emits literal schemaVersion 18.
 */
function migrateV17ToV18(state: GameStateV17): GameStateV18 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 17.");
  }

  const teams = Object.values(state.world.teams) as Team[];
  const draftPicks = generateDraftPicksForSeason(
    teams,
    state.competition.season.year,
  );

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 18,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: {
      ...state.world,
      draftPicks,
    },
    competition: state.competition,
    business: {
      contracts: state.business.contracts,
      finances: state.business.finances,
      freeAgency: state.business.freeAgency,
      tradeBlocks: {},
    },
    user: state.user,
  };
}

/**
 * Deterministic v18 → v19: add empty world.drafts.
 * Emits literal schemaVersion 19. No RNG.
 */
function migrateV18ToV19(state: GameStateV18): GameStateV19 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 18.");
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 19,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: {
      ...state.world,
      drafts: {},
    },
    competition: state.competition,
    business: state.business,
    user: state.user,
  };
}

/**
 * Deterministic v19 → v20: replace scalar revenue/expenses with booksByYear.
 * Non-zero legacy revenue maps to other; non-zero expenses map to operations.
 * Zero values are discarded. Emits literal schemaVersion 20. No RNG.
 */
function migrateV19ToV20(state: GameStateV19): GameStateV20 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 19.");
  }

  const seasonYear = state.competition.season.year;
  const yearKey = String(seasonYear);

  const finances: Record<string, TeamFinances> = Object.fromEntries(
    Object.entries(state.business.finances).map(([teamId, finance]) => {
      const booksByYear: TeamFinances["booksByYear"] = {};
      const hasRevenue = finance.revenue > 0;
      const hasExpenses = finance.expenses > 0;

      if (hasRevenue || hasExpenses) {
        const books = createEmptyTeamFinanceBooks();
        if (hasRevenue) {
          books.revenue.other = finance.revenue;
        }
        if (hasExpenses) {
          books.expenses.operations = finance.expenses;
        }
        booksByYear[yearKey] = books;
      }

      return [
        teamId,
        {
          teamId: finance.teamId,
          cash: finance.cash,
          payroll: finance.payroll,
          booksByYear,
        },
      ];
    }),
  );

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 20,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: {
      ...state.business,
      finances,
    },
    user: state.user,
  };
}

/**
 * Deterministic v20 → v21: simulation backbone fields.
 * - calendar.lastSimulatedDate / lastSimulatedWeekId
 * - season.offseasonStage
 * - world.scheduledEvents
 * Emits literal schemaVersion 21. No RNG.
 */
function migrateV20ToV21(state: GameStateV20): GameStateV21 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 20.");
  }

  const currentDate = state.world.calendar.currentDate;
  const lastSimulatedDate = addCalendarDays(currentDate, -1);
  const phase = state.competition.season.phase as SeasonPhase;
  const offseasonStage: OffseasonStage =
    phase === "offseason" ? "season_finalization" : "none";

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 21,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: {
      ...state.world,
      calendar: {
        currentDate,
        lastSimulatedDate,
        lastSimulatedWeekId: null,
      },
      scheduledEvents: {},
    },
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase,
        offseasonStage,
      },
    },
    business: state.business,
    user: state.user,
  };
}

/**
 * Deterministic v21 → v22: owner gameplay fields.
 * - objectives: status / seasonYear / consequenceApplied (drop completed)
 * - user.notifications
 * - user.appliedGameplayConsequenceKeys
 * Emits literal schemaVersion 22. No RNG.
 */
function migrateV21ToV22(state: GameStateV21): GameStateV22 {
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 21.");
  }

  const seasonYear = state.competition.season.year;
  const objectives = state.user.objectives.map((objective) => {
    const { completed, seasonYear: existingSeasonYear, ...rest } = objective;
    const nextSeasonYear =
      typeof existingSeasonYear === "number" && Number.isInteger(existingSeasonYear)
        ? existingSeasonYear
        : seasonYear;
    return {
      id: rest.id,
      type: rest.type,
      description: rest.description,
      status: completed ? ("completed" as const) : ("active" as const),
      seasonYear: nextSeasonYear,
      consequenceApplied: false,
      ...(rest.target !== undefined ? { target: rest.target } : {}),
      ...(rest.progress !== undefined ? { progress: rest.progress } : {}),
    };
  });

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 22,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: state.business,
    user: {
      controlledTeamId: state.user.controlledTeamId,
      mode: state.user.mode,
      objectives: objectives as GameState["user"]["objectives"],
      notifications: [],
      appliedGameplayConsequenceKeys: {},
    },
  };
}

/**
 * Deterministic v22 → v23: add empty user.eventLog for Owner activity history.
 * Emits literal schemaVersion 23. No RNG.
 */
function migrateV22ToV23(state: GameStateV22): GameState {
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 22.");
  }

  return {
    meta: {
      saveId: state.meta.saveId,
      schemaVersion: 23,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: state.competition,
    business: state.business,
    user: {
      ...state.user,
      eventLog: [],
    },
  };
}

type GameStateV22 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 22;
    rngState: number;
  };
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: {
    controlledTeamId: GameState["user"]["controlledTeamId"];
    mode: GameState["user"]["mode"];
    objectives: GameState["user"]["objectives"];
    notifications: GameState["user"]["notifications"];
    appliedGameplayConsequenceKeys: GameState["user"]["appliedGameplayConsequenceKeys"];
  };
};

function findUniqueContractId(
  playerId: PlayerId,
  contracts: Record<string, ContractV15>,
): ContractId | null {
  const matches = Object.values(contracts).filter(
    (contract) => contract.playerId === playerId,
  );
  if (matches.length === 1) {
    return matches[0]!.id;
  }
  return null;
}
