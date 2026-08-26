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
import { createEmptyTeamFinanceBooks, normalizeTeamFinanceBooks } from "@/domain/entities/finances";
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
import { createDefaultOwnershipConfidence } from "@/domain/entities/ownership-confidence";
import { createPhaseEBusinessDefaults } from "@/state/phase-e-defaults";
import { deriveDefaultTeamBranding } from "@/systems/team-branding-generation";
import { resolvePaletteIdFromBranding } from "@/domain/entities/team-branding";
import { paletteLogoKey } from "@/domain/team-identity";
import type { TeamBranding } from "@/domain/entities/team-branding";
import type { TeamId as BrandTeamId } from "@/domain/ids";
import { reconstructGameSettingsFromState } from "@/state/reconstruct-game-settings";
import { generateAxesForExistingProfile } from "@/systems/franchise-identity-generation";
import {
  DEFAULT_GAME_SETTINGS,
  DEFAULT_TRADE_DEADLINE_RULE,
  isTradeDeadlineRule,
  legacyManagementModeToPreset,
  applyPreset,
  resolveAssistancePhasesLegacy,
  type AiManagementMode,
  type AiAssistanceDomains,
  type AiAssistancePhases,
  type AiManagementPreset,
  type GameSettings,
} from "@/domain/game-settings";
import { EMPTY_AI_ASSIST_STATE } from "@/state/game-state";
import {
  isAiProfile,
  type AiProfile,
  type FranchiseOps,
} from "@/domain/entities/franchise-ops";
import type { StaffRole, StaffStrength, StaffWeakness } from "@/domain/entities/staff";
import { asStaffId } from "@/domain/ids";
import type {
  OwnerObjective,
  OwnerObjectiveCategory,
  OwnerObjectiveLifecycle,
  OwnerObjectiveRole,
  OwnerObjectiveType,
} from "@/domain/entities/owner-objective";
import { DEFAULT_OWNER_PHILOSOPHY } from "@/domain/entities/owner-philosophy";
import { defaultOwnerPatience } from "@/systems/owner-philosophy-config";

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
  23: (state) => migrateV23ToV24(state as GameStateV23),
  24: (state) => migrateV24ToV25(state as GameStateV24),
  25: (state) => migrateV25ToV26(state as GameStateV25),
  26: (state) => migrateV26ToV27(state as GameStateV26),
  27: (state) => migrateV27ToV28(state as GameStateV27),
  28: (state) => migrateV28ToV29(state as GameStateV28),
  29: (state) => migrateV29ToV30(state as GameStateV29),
  30: (state) => migrateV30ToV31(state as GameStateV30),
  31: (state) => migrateV31ToV32(state as GameStateV31),
  32: (state) => migrateV32ToV33(state as GameStateV32),
  33: (state) => migrateV33ToV34(state as GameStateV33),
  34: (state) => migrateV34ToV35(state as GameStateV34),
  35: (state) => migrateV35ToV36(state as GameStateV35),
  36: (state) => migrateV36ToV37(state as GameStateV36),
  37: (state) => migrateV37ToV38(state as GameStateV37),
  38: (state) => migrateV38ToV39(state as GameStateV38),
  39: (state) => migrateV39ToV40(state as GameStateV39),
  40: (state) => migrateV40ToV41(state as GameStateV40),
  41: (state) => migrateV41ToV42(state as GameStateV41),
};

/**
 * Parse → migrate (v1–current) → validate → return GameState.
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

type GameStateV6 = Omit<GameState, "meta" | "settings" | "world" | "competition" | "business" | "user"> & {
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
  const teams = Object.fromEntries(
    Object.entries(state.world.teams).map(([id, team]) => [
      id,
      {
        ...team,
        playStyle: { ...team.playStyle },
        coachingPhilosophy: { ...DEFAULT_COACHING_PHILOSOPHY },
      },
    ]),
  ) as GameState["world"]["teams"];

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
  business: GameStateV23["business"];
  user: UserSliceV21;
};

/** Schema v21 before owner gameplay notifications / objective status. */
type GameStateV21 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 21;
    rngState: number;
  };
  world: GameStateV23["world"];
  competition: GameState["competition"];
  business: GameStateV23["business"];
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
          booksByMonth: {},
          cashLedgerByMonth: {},
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
        regularSeasonStartDate:
          (state.competition.season as { regularSeasonStartDate?: string | null })
            .regularSeasonStartDate ?? null,
        offseasonStageEnteredDate:
          (state.competition.season as {
            offseasonStageEnteredDate?: string | null;
          }).offseasonStageEnteredDate ?? null,
        freeAgencyExtendedUntil:
          (state.competition.season as {
            freeAgencyExtendedUntil?: string | null;
          }).freeAgencyExtendedUntil ?? null,
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
      objectives: objectives as UserSlicePreV26["objectives"],
      notifications: [],
      appliedGameplayConsequenceKeys: {},
    },
  };
}

/**
 * Deterministic v22 → v23: add empty user.eventLog for Owner activity history.
 * Emits literal schemaVersion 23. No RNG.
 */
function migrateV22ToV23(state: GameStateV22): GameStateV23 {
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
  world: GameStateV23["world"];
  competition: GameState["competition"];
  business: GameStateV23["business"];
  user: {
    controlledTeamId: GameState["user"]["controlledTeamId"];
    mode: GameState["user"]["mode"];
    objectives: UserSlicePreV26["objectives"];
    notifications: GameState["user"]["notifications"];
    appliedGameplayConsequenceKeys: GameState["user"]["appliedGameplayConsequenceKeys"];
  };
};

type GameStateV23 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 23;
    rngState: number;
  };
  world: {
    calendar: {
      currentDate: string;
      lastSimulatedDate: string | null;
      lastSimulatedWeekId: string | null;
    };
    league: GameState["world"]["league"];
    conferences: GameState["world"]["conferences"];
    divisions: GameState["world"]["divisions"];
    teams: GameState["world"]["teams"];
    players: GameState["world"]["players"];
    coaches: GameState["world"]["coaches"];
    staff: GameState["world"]["staff"];
    draftPicks: GameState["world"]["draftPicks"];
    drafts: GameState["world"]["drafts"];
    scheduledEvents: GameState["world"]["scheduledEvents"];
  };
  competition: GameState["competition"];
  business: {
    contracts: GameState["business"]["contracts"];
    finances: GameState["business"]["finances"];
    freeAgency: GameState["business"]["freeAgency"];
    tradeBlocks: GameState["business"]["tradeBlocks"];
  };
  user: UserSlicePreV26;
};

/**
 * Deterministic v23 → v24: Phase E franchise business slices + calendar month id.
 * Emits literal schemaVersion 24. No RNG.
 */
function migrateV23ToV24(state: GameStateV23): GameStateV24 {
  const teamIds = Object.keys(state.world.teams) as TeamId[];
  const phaseE = createPhaseEBusinessDefaults(teamIds);

  // Upgrade legacy staff role "other" → "assistant_coach" and fill missing attrs.
  // Orphan teamIds (common when fixtures strip teams) become unemployed.
  const staff: GameState["world"]["staff"] = {};
  for (const [id, raw] of Object.entries(state.world.staff)) {
    const s = raw as Record<string, unknown>;
    const role =
      s.role === "other" || s.role === undefined
        ? "assistant_coach"
        : (s.role as StaffRole);
    let teamId = (s.teamId as TeamId | null) ?? null;
    if (teamId !== null && !(teamId in state.world.teams)) {
      teamId = null;
    }
    staff[id] = {
      id: asStaffId(String(s.id ?? id)),
      teamId,
      firstName: String(s.firstName ?? "Unknown"),
      lastName: String(s.lastName ?? "Staff"),
      role,
      quality: typeof s.quality === "number" ? s.quality : 50,
      experience: typeof s.experience === "number" ? s.experience : 5,
      strengths: Array.isArray(s.strengths)
        ? (s.strengths as StaffStrength[])
        : [],
      weaknesses: Array.isArray(s.weaknesses)
        ? (s.weaknesses as StaffWeakness[])
        : [],
    };
  }

  const teams: GameState["world"]["teams"] = {};
  for (const [teamId, team] of Object.entries(state.world.teams)) {
    teams[teamId] = {
      ...team,
      staff: team.staff.filter((staffId) => {
        const member = staff[staffId];
        return member !== undefined && member.teamId === teamId;
      }),
    };
  }

  // Drop orphan coaches whose teamId is missing.
  const coaches: GameState["world"]["coaches"] = {};
  for (const [coachId, coach] of Object.entries(state.world.coaches)) {
    if (coach.teamId !== null && !(coach.teamId in state.world.teams)) {
      coaches[coachId] = { ...coach, teamId: null };
    } else {
      coaches[coachId] = coach;
    }
  }

  return {
    meta: {
      ...state.meta,
      schemaVersion: 24,
    },
    world: {
      ...state.world,
      calendar: {
        ...state.world.calendar,
        lastSimulatedMonthId: null,
      },
      teams,
      staff,
      coaches,
    },
    competition: state.competition,
    business: {
      ...state.business,
      ...phaseE,
    },
    user: state.user,
  };
}

type UserSlicePreV26 = {
  controlledTeamId: GameState["user"]["controlledTeamId"];
  mode: GameState["user"]["mode"];
  objectives: Array<
    Omit<
      OwnerObjective,
      "category" | "lifecycle" | "role" | "horizonYears" | "baseline"
    > & {
      category?: OwnerObjectiveCategory;
      lifecycle?: OwnerObjectiveLifecycle;
      role?: OwnerObjectiveRole;
      horizonYears?: number;
      baseline?: number;
    }
  >;
  notifications: GameState["user"]["notifications"];
  eventLog: GameState["user"]["eventLog"];
  appliedGameplayConsequenceKeys: GameState["user"]["appliedGameplayConsequenceKeys"];
};

type GameStateV24 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 24;
    rngState: number;
  };
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: UserSlicePreV26;
};

type GameStateV25 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 25;
    rngState: number;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: UserSlicePreV26;
};

/**
 * Deterministic v24 → v25: add top-level GameSettings reconstructed from league.
 * Does not overwrite old CBL careers with Standard 30/82/16.
 * Emits literal schemaVersion 25. No RNG.
 */
function migrateV24ToV25(state: GameStateV24): GameStateV25 {
  const settings = reconstructGameSettingsFromState(state);
  return {
    meta: {
      ...state.meta,
      schemaVersion: 25,
    },
    settings,
    world: state.world,
    competition: state.competition,
    business: state.business,
    user: state.user,
  };
}

function legacyObjectiveMeta(type: OwnerObjectiveType): {
  category: OwnerObjectiveCategory;
  lifecycle: OwnerObjectiveLifecycle;
  role: OwnerObjectiveRole;
} {
  switch (type) {
    case "make_playoffs":
    case "minimum_win_total":
    case "playoff_round":
    case "win_championship":
    case "playoff_seed":
      return {
        category: "competitive",
        lifecycle: "seasonal",
        role:
          type === "make_playoffs" || type === "minimum_win_total"
            ? "primary"
            : "secondary",
      };
    case "improve_finances":
    case "payroll_limit":
    case "revenue_target":
    case "positive_cash":
      return {
        category: "financial",
        lifecycle: "seasonal",
        role: type === "payroll_limit" ? "secondary" : "primary",
      };
    case "develop_young_players":
    case "roster_direction":
      return {
        category: "strategic",
        lifecycle: "seasonal",
        role: "secondary",
      };
    case "attendance":
    case "fan_sentiment":
    case "awareness":
    case "reputation":
    case "arena_level":
      return {
        category: "franchise",
        lifecycle: "seasonal",
        role: "secondary",
      };
    case "franchise_value":
    case "championship_count":
    case "playoff_count":
      return {
        category: "long_term",
        lifecycle: "career",
        role: "long_term",
      };
  }
}

/**
 * Deterministic v25 → v26: owner philosophy + patience; backfill objective
 * category/lifecycle/role. Does not regenerate seasonal objectives.
 * Emits literal schemaVersion 26. No RNG.
 */
function migrateV25ToV26(state: GameStateV25): GameStateV26 {
  const objectives = state.user.objectives.map((objective) => {
    const meta = legacyObjectiveMeta(objective.type);
    return {
      id: objective.id,
      type: objective.type,
      description: objective.description,
      status: objective.status,
      seasonYear: objective.seasonYear,
      consequenceApplied: objective.consequenceApplied,
      category: objective.category ?? meta.category,
      lifecycle: objective.lifecycle ?? meta.lifecycle,
      role: objective.role ?? meta.role,
      ...(objective.target !== undefined ? { target: objective.target } : {}),
      ...(objective.progress !== undefined
        ? { progress: objective.progress }
        : {}),
      ...(objective.horizonYears !== undefined
        ? { horizonYears: objective.horizonYears }
        : {}),
      ...(objective.baseline !== undefined
        ? { baseline: objective.baseline }
        : {}),
    } satisfies OwnerObjective;
  });

  return {
    meta: {
      ...state.meta,
      schemaVersion: 26,
    },
    settings: state.settings,
    world: state.world,
    competition: state.competition,
    business: state.business,
    user: {
      controlledTeamId: state.user.controlledTeamId,
      mode: state.user.mode,
      ownerPhilosophy: DEFAULT_OWNER_PHILOSOPHY,
      ownerPatience: defaultOwnerPatience(DEFAULT_OWNER_PHILOSOPHY),
      objectives,
      notifications: state.user.notifications,
      eventLog: state.user.eventLog,
      appliedGameplayConsequenceKeys:
        state.user.appliedGameplayConsequenceKeys,
    },
  } as GameStateV26;
}

/** Schema v26 before franchise ownership axes on FranchiseOps. */
type GameStateV26 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 26;
    rngState: number;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: GameState["user"];
};

/**
 * Deterministic v26 → v27: add spendingTolerance / patience / riskTolerance
 * on every FranchiseOps. Keeps existing aiProfile; fills axes from seed+teamId.
 * Allows "rebuild" in the type system for new saves only (does not rewrite
 * legacy profiles). Emits literal schemaVersion 27. No RNG stream consumption.
 */
function migrateV26ToV27(state: GameStateV26): GameStateV27 {
  const franchiseOps: Record<string, FranchiseOps> = {};
  for (const [teamId, ops] of Object.entries(state.business.franchiseOps)) {
    const raw = ops as FranchiseOps & {
      spendingTolerance?: number;
      patience?: number;
      riskTolerance?: number;
      premiumTicketPrice?: number;
    };
    const profile: AiProfile = isAiProfile(raw.aiProfile)
      ? raw.aiProfile
      : "conservative";
    const axes = generateAxesForExistingProfile({
      rngSeed: state.meta.rngSeed,
      teamId,
      aiProfile: profile,
    });
    franchiseOps[teamId] = {
      ...raw,
      aiProfile: profile,
      spendingTolerance:
        typeof raw.spendingTolerance === "number"
          ? raw.spendingTolerance
          : axes.spendingTolerance,
      patience:
        typeof raw.patience === "number" ? raw.patience : axes.patience,
      riskTolerance:
        typeof raw.riskTolerance === "number"
          ? raw.riskTolerance
          : axes.riskTolerance,
      premiumTicketPrice:
        typeof raw.premiumTicketPrice === "number"
          ? raw.premiumTicketPrice
          : 180,
    };
  }

  return {
    meta: {
      ...state.meta,
      schemaVersion: 27,
    },
    settings: state.settings,
    world: state.world,
    competition: state.competition,
    business: {
      ...state.business,
      franchiseOps,
    },
    user: state.user,
  };
}

/** Schema v27 before chart-of-accounts expansion / booksByMonth. */
type GameStateV27 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 27;
    rngState: number;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: GameState["user"];
};


/**
 * Deterministic v27 → v28: expand finance categories, add booksByMonth and
 * cashLedgerByMonth, ensure premiumTicketPrice on FranchiseOps.
 * Does not rewrite historical "other" lumping. Emits schemaVersion 28.
 */
function migrateV27ToV28(state: GameStateV27): GameStateV28 {
  const finances: Record<string, TeamFinances> = {};
  for (const [teamId, finance] of Object.entries(state.business.finances)) {
    const booksByYear: TeamFinances["booksByYear"] = {};
    for (const [yearKey, books] of Object.entries(finance.booksByYear ?? {})) {
      booksByYear[yearKey] = normalizeTeamFinanceBooks(
        books as Parameters<typeof normalizeTeamFinanceBooks>[0],
      );
    }
    const booksByMonth: TeamFinances["booksByMonth"] = {};
    const rawMonths =
      (finance as TeamFinances & { booksByMonth?: TeamFinances["booksByMonth"] })
        .booksByMonth ?? {};
    for (const [monthKey, books] of Object.entries(rawMonths)) {
      booksByMonth[monthKey] = normalizeTeamFinanceBooks(
        books as Parameters<typeof normalizeTeamFinanceBooks>[0],
      );
    }
    finances[teamId] = {
      teamId: finance.teamId,
      cash: finance.cash,
      payroll: finance.payroll,
      booksByYear,
      booksByMonth,
      cashLedgerByMonth:
        (finance as TeamFinances).cashLedgerByMonth ?? {},
    };
  }

  const franchiseOps: Record<string, FranchiseOps> = {};
  for (const [teamId, ops] of Object.entries(state.business.franchiseOps)) {
    const raw = ops as FranchiseOps & { premiumTicketPrice?: number };
    franchiseOps[teamId] = {
      ...raw,
      premiumTicketPrice:
        typeof raw.premiumTicketPrice === "number"
          ? raw.premiumTicketPrice
          : 180,
    };
  }

  return {
    meta: {
      ...state.meta,
      schemaVersion: 28,
    },
    settings: state.settings as GameStateV28["settings"],
    world: state.world,
    competition: state.competition as GameStateV28["competition"],
    business: {
      ...state.business,
      finances,
      franchiseOps,
    },
    user: state.user,
  };
}

/** Schema v28 before calendar-context season start + trade deadline rule. */
type GameStateV28 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 28;
    rngState: number;
  };
  settings: {
    league: GameSettings["league"];
    /** Present on historical v28 JSON; normalized to injuryFrequency on load. */
    injuriesEnabled?: boolean;
    injuryFrequency?: GameSettings["injuryFrequency"];
    regularSeason: {
      gamesPerTeam: number;
      tradeDeadlineRule?: GameSettings["regularSeason"]["tradeDeadlineRule"];
    };
    playoffs: GameSettings["playoffs"];
    simulation: GameSettings["simulation"];
    ai: GameSettings["ai"];
    financialRules: GameSettings["financialRules"];
    draft: GameSettings["draft"];
    history: GameSettings["history"];
  };
  world: GameState["world"];
  competition: {
    season: {
      id: GameState["competition"]["season"]["id"];
      year: number;
      phase: SeasonPhase;
      offseasonStage: OffseasonStage;
      regularSeasonStartDate?: string | null;
    };
    schedule: GameState["competition"]["schedule"];
    games: GameState["competition"]["games"];
    standings: GameState["competition"]["standings"];
    playoffs: GameState["competition"]["playoffs"];
  };
  business: GameState["business"];
  user: GameState["user"];
};

/**
 * Deterministic v28 → v29: regularSeasonStartDate + tradeDeadlineRule defaults.
 * Emits schemaVersion 29. No RNG.
 */
function migrateV28ToV29(state: GameStateV28): GameStateV29 {
  let regularSeasonStartDate: string | null =
    state.competition.season.regularSeasonStartDate ?? null;
  if (
    regularSeasonStartDate === null &&
    state.competition.season.phase === "regular"
  ) {
    let earliest: string | null = null;
    for (const gameId of state.competition.schedule.gameIds) {
      const game = state.competition.games[gameId];
      if (!game) {
        continue;
      }
      if (earliest === null || game.date < earliest) {
        earliest = game.date;
      }
    }
    regularSeasonStartDate = earliest;
  }

  const tradeDeadlineRule = isTradeDeadlineRule(
    state.settings.regularSeason.tradeDeadlineRule,
  )
    ? state.settings.regularSeason.tradeDeadlineRule
    : DEFAULT_TRADE_DEADLINE_RULE;

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 29,
    },
    settings: {
      ...state.settings,
      ai: {
        difficulty: state.settings.ai.difficulty,
        managementMode:
          (state.settings.ai as { managementMode?: AiManagementMode })
            .managementMode ?? "smart_assist",
        assistance: {
          freeAgency: "inherit",
          draft: "inherit",
          contracts: "inherit",
          rosterFilling: "inherit",
          rotations: "inherit",
          staffHiring: "inherit",
          trades: "inherit",
          injuryReplacement: "inherit",
          ...((state.settings.ai as { assistance?: Partial<AiAssistanceDomains> })
            .assistance ?? {}),
        } as AiAssistanceDomains,
      },
      offseason: {
        freeAgency: {
          durationDays:
            (state.settings as { offseason?: GameSettings["offseason"] }).offseason
              ?.freeAgency.durationDays ?? 30,
          allowExtension:
            (state.settings as { offseason?: GameSettings["offseason"] }).offseason
              ?.freeAgency.allowExtension ?? true,
        },
      },
      regularSeason: {
        gamesPerTeam: state.settings.regularSeason.gamesPerTeam,
        tradeDeadlineRule,
      },
    },
    competition: {
      ...state.competition,
      season: {
        id: state.competition.season.id,
        year: state.competition.season.year,
        phase: state.competition.season.phase,
        offseasonStage: state.competition.season.offseasonStage,
        regularSeasonStartDate,
        offseasonStageEnteredDate:
          (state.competition.season as {
            offseasonStageEnteredDate?: string | null;
          }).offseasonStageEnteredDate ?? null,
        freeAgencyExtendedUntil:
          (state.competition.season as {
            freeAgencyExtendedUntil?: string | null;
          }).freeAgencyExtendedUntil ?? null,
      },
    },
  } as unknown as GameStateV29;
}

type GameStateV29 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 29;
    rngState: number;
  };
  settings: GameSettings;
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: Omit<GameState["user"], "narrative">;
};

/**
 * Deterministic v29 → v30: empty user.narrative store.
 * Emits schemaVersion 30. No RNG.
 */
function migrateV29ToV30(state: GameStateV29): GameStateV30 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 30,
    },
    user: {
      ...state.user,
      narrative: {
        situations: [],
        snapshots: [],
        cooldowns: {},
      },
    },
  };
}

type GameStateV30 = {
  meta: GameState["meta"];
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: GameState["user"];
};

/**
 * Deterministic v30 → v31: relocation tenure fields + franchise history city/name.
 * Emits schemaVersion 31. No RNG.
 */
function migrateV30ToV31(state: GameStateV30): GameState {
  const year = state.competition.season.year;
  const relocationByTeamId: GameState["business"]["relocationByTeamId"] = {};
  for (const teamId of Object.keys(state.world.teams)) {
    const existing = state.business.relocationByTeamId[teamId];
    const historyLen =
      state.business.franchiseHistory[teamId]?.seasons.length ?? 0;
    const inferredStart = Math.max(1, year - Math.max(0, historyLen - 1));
    relocationByTeamId[teamId] = {
      teamId: teamId as GameState["user"]["controlledTeamId"],
      stage: existing?.stage ?? "none",
      target: existing?.target ?? null,
      cooldownSeasonsRemaining: existing?.cooldownSeasonsRemaining ?? 0,
      fee: existing?.fee ?? 0,
      cityStartSeasonYear:
        existing &&
        typeof (existing as { cityStartSeasonYear?: number }).cityStartSeasonYear ===
          "number" &&
        (existing as { cityStartSeasonYear: number }).cityStartSeasonYear > 0
          ? (existing as { cityStartSeasonYear: number }).cityStartSeasonYear
          : inferredStart,
      lastCompletedRelocationSeasonYear:
        (existing as { lastCompletedRelocationSeasonYear?: number | null })
          ?.lastCompletedRelocationSeasonYear ?? null,
      failedAttemptCooldownSeasonsRemaining:
        (existing as { failedAttemptCooldownSeasonsRemaining?: number })
          ?.failedAttemptCooldownSeasonsRemaining ?? 0,
    };
  }

  const franchiseHistory: GameState["business"]["franchiseHistory"] = {};
  for (const teamId of Object.keys(state.business.franchiseHistory)) {
    const history = state.business.franchiseHistory[teamId]!;
    const team = state.world.teams[teamId];
    franchiseHistory[teamId] = {
      teamId: history.teamId,
      seasons: history.seasons.map((season) => ({
        ...season,
        city:
          typeof (season as { city?: string }).city === "string"
            ? (season as { city: string }).city
            : (team?.city ?? "Unknown"),
        name:
          typeof (season as { name?: string }).name === "string"
            ? (season as { name: string }).name
            : (team?.name ?? "Unknown"),
      })),
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 31,
    },
    business: {
      ...state.business,
      relocationByTeamId,
      franchiseHistory,
    },
  };
}

type GameStateV31 = {
  meta: GameState["meta"];
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: Omit<GameState["user"], "ownershipConfidence">;
};

/**
 * Deterministic v31 → v32: ownerStartSeasonYear, season attendance nulls,
 * finances.attendanceByYear. Emits schemaVersion 32. No RNG.
 */
function migrateV31ToV32(state: GameStateV31): GameStateV32 {
  const seasonYear = state.competition.season.year;
  const rawOwnerStart = (state.user as { ownerStartSeasonYear?: unknown })
    .ownerStartSeasonYear;
  const ownerStartSeasonYear =
    typeof rawOwnerStart === "number" &&
    Number.isFinite(rawOwnerStart) &&
    Number.isInteger(rawOwnerStart)
      ? rawOwnerStart
      : seasonYear;

  const finances: GameState["business"]["finances"] = {};
  for (const [teamId, finance] of Object.entries(state.business.finances)) {
    const attendanceByYear =
      finance &&
      typeof finance === "object" &&
      "attendanceByYear" in finance &&
      finance.attendanceByYear != null &&
      typeof finance.attendanceByYear === "object" &&
      !Array.isArray(finance.attendanceByYear)
        ? (finance.attendanceByYear as Record<string, number>)
        : {};
    finances[teamId] = {
      ...finance,
      attendanceByYear,
    };
  }

  const franchiseHistory: GameState["business"]["franchiseHistory"] = {};
  for (const [teamId, history] of Object.entries(
    state.business.franchiseHistory,
  )) {
    franchiseHistory[teamId] = {
      teamId: history.teamId,
      seasons: history.seasons.map((season) => {
        const rawAttendance = (season as { attendance?: unknown }).attendance;
        const attendance =
          rawAttendance === null
            ? null
            : typeof rawAttendance === "number" && Number.isFinite(rawAttendance)
              ? rawAttendance
              : null;
        return {
          ...season,
          attendance,
        };
      }),
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 32,
    },
    business: {
      ...state.business,
      finances,
      franchiseHistory,
    },
    user: {
      ...state.user,
      ownerStartSeasonYear,
    },
  };
}

type GameStateV32 = {
  meta: GameState["meta"];
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: Omit<GameState["user"], "ownershipConfidence"> & {
    ownershipConfidence?: GameState["user"]["ownershipConfidence"];
  };
};

/**
 * Deterministic v32 → v33: add ownershipConfidence defaults.
 * Emits schemaVersion 33. No RNG.
 */
function migrateV32ToV33(state: GameStateV32): GameStateV33 {
  const date = state.world.calendar.currentDate;
  const existing = state.user.ownershipConfidence;
  const ownershipConfidence =
    existing != null && typeof existing === "object"
      ? existing
      : createDefaultOwnershipConfidence(date);

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 33,
    },
    user: {
      ...state.user,
      ownershipConfidence,
    },
  };
}

type GameStateV33 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 33;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: GameState["user"];
};

/**
 * Deterministic v33 → v34:
 * - foundedSeasonYear on FranchiseOps
 * - expenses / netIncome / payroll / leagueRank on FranchiseSeasonRecord
 * Emits schemaVersion 34. No RNG.
 */
function migrateV33ToV34(state: GameStateV33): GameStateV34 {
  const leagueStart =
    state.user.ownerStartSeasonYear ?? state.competition.season.year;
  const franchiseOps: GameState["business"]["franchiseOps"] = {};
  for (const [teamId, ops] of Object.entries(state.business.franchiseOps)) {
    const raw = ops as FranchiseOps & { foundedSeasonYear?: number };
    const history = state.business.franchiseHistory[teamId];
    const firstYear = history?.seasons[0]?.seasonYear;
    franchiseOps[teamId] = {
      ...raw,
      foundedSeasonYear:
        typeof raw.foundedSeasonYear === "number"
          ? raw.foundedSeasonYear
          : firstYear ?? leagueStart,
    };
  }

  const franchiseHistory: GameState["business"]["franchiseHistory"] = {};
  for (const [teamId, history] of Object.entries(
    state.business.franchiseHistory,
  )) {
    franchiseHistory[teamId] = {
      teamId: history.teamId,
      seasons: history.seasons.map((season) => {
        const raw = season as typeof season & {
          expenses?: number;
          netIncome?: number;
          payroll?: number;
          leagueRank?: number | null;
        };
        return {
          ...season,
          expenses: typeof raw.expenses === "number" ? raw.expenses : 0,
          netIncome: typeof raw.netIncome === "number" ? raw.netIncome : 0,
          payroll: typeof raw.payroll === "number" ? raw.payroll : 0,
          leagueRank:
            raw.leagueRank === null || typeof raw.leagueRank === "number"
              ? raw.leagueRank
              : null,
        };
      }),
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 34,
    },
    business: {
      ...state.business,
      franchiseOps,
      franchiseHistory,
      franchiseReportCache: state.business.franchiseReportCache ?? {},
    },
  };
}

type GameStateV34 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 34;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: Omit<GameState["business"], "gameArchive" | "playerHistory">;
  user: GameState["user"];
};

type GameStateV35 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 35;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: Omit<GameState["business"], "gameArchive" | "playerHistory"> & {
    gameArchive?: GameState["business"]["gameArchive"];
    playerHistory?: GameState["business"]["playerHistory"];
  };
  user: GameState["user"];
};

type GameStateV36 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 36;
  };
  settings: Omit<GameState["settings"], "offseason" | "ai"> & {
    ai: {
      difficulty: GameSettings["ai"]["difficulty"];
      managementMode?: AiManagementMode;
      assistance?: Partial<AiAssistanceDomains>;
    };
    offseason?: GameState["settings"]["offseason"];
  };
  world: GameState["world"];
  competition: {
    season: Omit<
      GameState["competition"]["season"],
      "offseasonStageEnteredDate" | "freeAgencyExtendedUntil"
    > & {
      offseasonStageEnteredDate?: string | null;
      freeAgencyExtendedUntil?: string | null;
    };
    schedule: GameState["competition"]["schedule"];
    games: GameState["competition"]["games"];
    standings: GameState["competition"]["standings"];
    playoffs: GameState["competition"]["playoffs"];
  };
  business: GameState["business"];
  user: Omit<GameState["user"], "explicitDecisions" | "phaseSkips" | "aiAssistState"> & {
    explicitDecisions?: GameState["user"]["explicitDecisions"];
    phaseSkips?: GameState["user"]["phaseSkips"];
    aiAssistState?: GameState["user"]["aiAssistState"];
  };
};

type GameStateV37 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 37;
  };
  settings: Omit<GameState["settings"], "ai"> & {
    ai: {
      difficulty: GameSettings["ai"]["difficulty"];
      managementMode: AiManagementMode;
      assistance: AiAssistanceDomains;
    };
  };
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: Omit<GameState["user"], "aiAssistState"> & {
    aiAssistState?: GameState["user"]["aiAssistState"];
  };
};

type GameStateV38 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 38;
  };
  settings: Omit<GameState["settings"], "ai"> & {
    ai: {
      difficulty: GameSettings["ai"]["difficulty"];
      managementPreset: AiManagementPreset;
      assistance: AiAssistancePhases;
    };
  };
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: Omit<
    GameState["user"],
    "pendingOwnerDecisions" | "ownerDecisionHistory" | "citySelectionConfirmed"
  > & {
    pendingOwnerDecisions?: GameState["user"]["pendingOwnerDecisions"];
    ownerDecisionHistory?: GameState["user"]["ownerDecisionHistory"];
  };
};

type GameStateV39 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 39;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: Omit<
    GameState["user"],
    "pendingOwnerDecisions" | "ownerDecisionHistory" | "citySelectionConfirmed"
  > & {
    pendingOwnerDecisions?: GameState["user"]["pendingOwnerDecisions"];
    ownerDecisionHistory?: GameState["user"]["ownerDecisionHistory"];
  };
};

type GameStateV40 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 40;
  };
  settings: GameState["settings"];
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: Omit<GameState["user"], "citySelectionConfirmed"> & {
    citySelectionConfirmed?: boolean;
  };
};

/**
 * Deterministic v34 → v35: box-score historical identity fields on Game.
 * - competitionType inferred from id prefix only (playoff_/playin_ → playoffs)
 * - team snapshots null (do not backfill from live world.teams)
 * - playerStats teamId/firstName/lastName null (do not backfill from current roster)
 * Emits schemaVersion 35. No RNG.
 */
function migrateV34ToV35(state: GameStateV34): GameStateV35 {
  const games: GameState["competition"]["games"] = {};
  for (const [gameId, game] of Object.entries(state.competition.games)) {
    const raw = game as typeof game & {
      competitionType?: string;
      homeTeamSnapshot?: unknown;
      awayTeamSnapshot?: unknown;
      playerStats: Array<
        (typeof game.playerStats)[number] & {
          teamId?: string | null;
          firstName?: string | null;
          lastName?: string | null;
        }
      >;
    };
    const competitionType =
      raw.competitionType === "regular_season" ||
      raw.competitionType === "playoffs"
        ? raw.competitionType
        : gameId.startsWith("playoff_") || gameId.startsWith("playin_")
          ? "playoffs"
          : "regular_season";

    games[gameId] = {
      ...raw,
      competitionType,
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
      playerStats: raw.playerStats.map((row) => ({
        ...row,
        teamId: null,
        firstName: null,
        lastName: null,
      })),
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 35,
    },
    competition: {
      ...state.competition,
      games,
    },
  };
}

/**
 * Deterministic v35 → v36: player history + game archive.
 * Defaults empty; no backfill of prior seasons.
 * Emits schemaVersion 36. No RNG.
 */
function migrateV35ToV36(state: GameStateV35): GameStateV36 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 36,
    },
    business: {
      ...state.business,
      gameArchive: state.business.gameArchive ?? {},
      playerHistory: state.business.playerHistory ?? {},
    },
  } as unknown as GameStateV36;
}

/**
 * Deterministic v36 → v37: offseason stage dates, AI assist settings,
 * free-agency duration settings, explicit decisions / phase skips.
 * Emits schemaVersion 37. No RNG.
 */
function migrateV36ToV37(state: GameStateV36): GameStateV37 {
  const season = state.competition.season;
  const inOffseasonStage =
    season.phase === "offseason" && season.offseasonStage !== "none";
  const offseasonStageEnteredDate =
    season.offseasonStageEnteredDate !== undefined
      ? season.offseasonStageEnteredDate
      : inOffseasonStage
        ? state.world.calendar.currentDate
        : null;

  const previousAi = state.settings.ai;
  const ai = {
    difficulty: previousAi.difficulty,
    managementMode: previousAi.managementMode ?? ("smart_assist" as const),
    assistance: {
      freeAgency: previousAi.assistance?.freeAgency ?? ("inherit" as const),
      draft: previousAi.assistance?.draft ?? ("inherit" as const),
      contracts: previousAi.assistance?.contracts ?? ("inherit" as const),
      rosterFilling: previousAi.assistance?.rosterFilling ?? ("inherit" as const),
      rotations: previousAi.assistance?.rotations ?? ("inherit" as const),
      staffHiring: previousAi.assistance?.staffHiring ?? ("inherit" as const),
      trades: previousAi.assistance?.trades ?? ("inherit" as const),
      injuryReplacement:
        previousAi.assistance?.injuryReplacement ?? ("inherit" as const),
    },
  };

  const offseason = {
    freeAgency: {
      durationDays:
        state.settings.offseason?.freeAgency.durationDays ?? 30,
      allowExtension:
        state.settings.offseason?.freeAgency.allowExtension ?? true,
    },
  };

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 37,
    },
    settings: {
      ...state.settings,
      ai,
      offseason,
    },
    competition: {
      ...state.competition,
      season: {
        ...season,
        offseasonStageEnteredDate,
        freeAgencyExtendedUntil: season.freeAgencyExtendedUntil ?? null,
      },
    },
    user: {
      ...state.user,
      explicitDecisions: state.user.explicitDecisions ?? {},
      phaseSkips: state.user.phaseSkips ?? [],
    },
  };
}

/**
 * Deterministic v37 → v38: phase-based management presets + aiAssistState.
 * Cheap mapping: smart_assist → smart preset. No RNG.
 */
function migrateV37ToV38(state: GameStateV37): GameStateV38 {
  const preset = legacyManagementModeToPreset(state.settings.ai.managementMode);
  const assistance = applyPreset(preset);

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 38,
    },
    settings: {
      ...state.settings,
      ai: {
        difficulty: state.settings.ai.difficulty,
        managementPreset: preset,
        assistance,
      },
    },
    user: {
      ...state.user,
      aiAssistState: state.user.aiAssistState ?? {
        resolvedNeeds: {},
        seasonCounters: { ...EMPTY_AI_ASSIST_STATE.seasonCounters },
      },
    },
  };
}

/**
 * Deterministic v38 → v39: make assistance canonical for delegation UI.
 * Preserves exact phase modes (no upgrade to full). Preset kept for audit only.
 */
function migrateV38ToV39(state: GameStateV38): GameStateV39 {
  const assistance = resolveAssistancePhasesLegacy(
    state.settings.ai.managementPreset,
    state.settings.ai.assistance,
  );

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 39,
    },
    settings: {
      ...state.settings,
      ai: {
        difficulty: state.settings.ai.difficulty,
        // Keep last preset name for audit; policy/UI use assistance only.
        managementPreset: state.settings.ai.managementPreset,
        assistance,
      },
    },
  };
}

/**
 * Deterministic v39 → v40: owner decision queue + history for sim interrupts.
 */
function migrateV39ToV40(state: GameStateV39): GameStateV40 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 40,
    },
    user: {
      ...state.user,
      pendingOwnerDecisions: state.user.pendingOwnerDecisions ?? [],
      ownerDecisionHistory: state.user.ownerDecisionHistory ?? [],
    },
  };
}

/**
 * Deterministic v40 → v41: city selection confirmation flag for new-game pick.
 * Existing saves already past team pick are treated as confirmed.
 */
function migrateV40ToV41(state: GameStateV40): GameStateV41 {
  const locked = state.world.calendar.lastSimulatedDate !== null;
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 41,
    },
    user: {
      ...state.user,
      citySelectionConfirmed: state.user.citySelectionConfirmed ?? locked,
    },
  } as GameStateV41;
}

type TeamV41 = {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  branding?: TeamBranding;
  [key: string]: unknown;
};

type GameTeamSnapshotV41 = {
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  branding?: TeamBranding;
};

type GameStateV41 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 41;
  };
  settings: GameState["settings"];
  world: Omit<GameState["world"], "teams"> & {
    teams: Record<string, TeamV41>;
  };
  competition: {
    season: GameState["competition"]["season"];
    schedule: GameState["competition"]["schedule"];
    standings: GameState["competition"]["standings"];
    playoffs: GameState["competition"]["playoffs"];
    games: Record<
      string,
      Omit<
        GameState["competition"]["games"][string],
        "homeTeamSnapshot" | "awayTeamSnapshot"
      > & {
        homeTeamSnapshot: GameTeamSnapshotV41 | null;
        awayTeamSnapshot: GameTeamSnapshotV41 | null;
      }
    >;
  };
  business: GameState["business"];
  user: Omit<GameState["user"], "franchiseIdentityConfirmed"> & {
    citySelectionConfirmed: boolean;
    franchiseIdentityConfirmed?: boolean;
  };
};

/**
 * Deterministic v41 → v42: team branding + franchise identity onboarding flag.
 */
function migrateV41ToV42(state: GameStateV41): GameState {
  const usedPaletteLogoKeys = new Set<string>();
  const teams: GameState["world"]["teams"] = {};
  for (const [teamId, team] of Object.entries(state.world.teams)) {
    let branding = team.branding;
    if (!branding) {
      branding = deriveDefaultTeamBranding(
        teamId,
        String(team.city ?? ""),
        String(team.name ?? ""),
        usedPaletteLogoKeys,
      );
    }
    const paletteId = resolvePaletteIdFromBranding(branding);
    if (paletteId) {
      usedPaletteLogoKeys.add(paletteLogoKey(paletteId, branding.logoId));
    }
    teams[teamId] = {
      ...(team as unknown as GameState["world"]["teams"][string]),
      branding: {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        logoId: branding.logoId,
      },
    };
  }

  const games: GameState["competition"]["games"] = {};
  for (const [gameId, game] of Object.entries(state.competition.games)) {
    games[gameId] = {
      ...game,
      homeTeamSnapshot: backfillSnapshotBranding(game.homeTeamSnapshot, teams),
      awayTeamSnapshot: backfillSnapshotBranding(game.awayTeamSnapshot, teams),
    } as GameState["competition"]["games"][string];
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 42,
    },
    world: {
      ...state.world,
      teams,
    },
    competition: {
      ...state.competition,
      games,
    },
    user: {
      ...state.user,
      franchiseIdentityConfirmed:
        state.user.franchiseIdentityConfirmed ??
        state.user.citySelectionConfirmed === true,
    },
  };
}

function backfillSnapshotBranding(
  snapshot: GameTeamSnapshotV41 | null,
  teams: GameState["world"]["teams"],
): GameState["competition"]["games"][string]["homeTeamSnapshot"] {
  if (snapshot == null) {
    return null;
  }
  const live = teams[snapshot.teamId];
  const branding =
    snapshot.branding ??
    live?.branding ??
    deriveDefaultTeamBranding(snapshot.teamId, snapshot.city, snapshot.name);
  return {
    teamId: snapshot.teamId as BrandTeamId,
    city: snapshot.city,
    name: snapshot.name,
    abbreviation: snapshot.abbreviation,
    branding: {
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      logoId: branding.logoId,
    },
  };
}

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
