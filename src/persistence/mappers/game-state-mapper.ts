import { z } from "zod";
import type { Contract } from "@/domain/entities/contract";
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
import type { GameState } from "@/state/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { calculateStandings } from "@/systems/standings";

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
    return migrateV12ToV13(
      migrateV11ToV12(
        migrateV10ToV11(
          migrateV9ToV10(
            migrateV8ToV9(
              migrateV7ToV8(
                migrateV6ToV7(
                  migrateV5ToV6(
                    migrateV4ToV5(
                      migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(parsed as GameStateV1))),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  if (envelope.meta.schemaVersion === 2) {
    return migrateV12ToV13(
      migrateV11ToV12(
        migrateV10ToV11(
          migrateV9ToV10(
            migrateV8ToV9(
              migrateV7ToV8(
                migrateV6ToV7(
                  migrateV5ToV6(
                    migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(parsed as GameStateV2))),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  if (envelope.meta.schemaVersion === 3) {
    return migrateV12ToV13(
      migrateV11ToV12(
        migrateV10ToV11(
          migrateV9ToV10(
            migrateV8ToV9(
              migrateV7ToV8(
                migrateV6ToV7(
                  migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(parsed as GameStateV3))),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  if (envelope.meta.schemaVersion === 4) {
    return migrateV12ToV13(
      migrateV11ToV12(
        migrateV10ToV11(
          migrateV9ToV10(
            migrateV8ToV9(
              migrateV7ToV8(
                migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(parsed as GameStateV4))),
              ),
            ),
          ),
        ),
      ),
    );
  }

  if (envelope.meta.schemaVersion === 5) {
    return migrateV12ToV13(
      migrateV11ToV12(
        migrateV10ToV11(
          migrateV9ToV10(
            migrateV8ToV9(
              migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(parsed as GameStateV5))),
            ),
          ),
        ),
      ),
    );
  }

  if (envelope.meta.schemaVersion === 6) {
    return migrateV12ToV13(
      migrateV11ToV12(
        migrateV10ToV11(
          migrateV9ToV10(
            migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(parsed as GameStateV6))),
          ),
        ),
      ),
    );
  }

  if (envelope.meta.schemaVersion === 7) {
    return migrateV12ToV13(
      migrateV11ToV12(
        migrateV10ToV11(
          migrateV9ToV10(migrateV8ToV9(migrateV7ToV8(parsed as GameStateV7))),
        ),
      ),
    );
  }

  if (envelope.meta.schemaVersion === 8) {
    return migrateV12ToV13(
      migrateV11ToV12(
        migrateV10ToV11(migrateV9ToV10(migrateV8ToV9(parsed as GameStateV8))),
      ),
    );
  }

  if (envelope.meta.schemaVersion === 9) {
    return migrateV12ToV13(
      migrateV11ToV12(
        migrateV10ToV11(migrateV9ToV10(parsed as GameStateV9)),
      ),
    );
  }

  if (envelope.meta.schemaVersion === 10) {
    return migrateV12ToV13(
      migrateV11ToV12(migrateV10ToV11(parsed as GameStateV10)),
    );
  }

  if (envelope.meta.schemaVersion === 11) {
    return migrateV12ToV13(migrateV11ToV12(parsed as GameStateV11));
  }

  if (envelope.meta.schemaVersion === 12) {
    return migrateV12ToV13(parsed as GameStateV12);
  }

  if (envelope.meta.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported GameState schemaVersion ${envelope.meta.schemaVersion}; expected ${GAME_STATE_SCHEMA_VERSION}.`,
    );
  }

  const state = parsed as GameState;
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 13.");
  }

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
  business: GameState["business"];
  user: GameState["user"];
};

type GameStateV6 = Omit<GameState, "meta" | "world" | "competition"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 6 };
  world: Omit<GameState["world"], "players" | "teams"> & {
    players: Record<string, Player>;
    teams: Record<string, TeamV6>;
  };
  competition: CompetitionWithLegacyGames;
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
  competition: CompetitionWithLegacyGames;
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
  competition: CompetitionWithLegacyGames;
  business: GameState["business"];
  user: GameState["user"];
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
  business: GameState["business"];
  user: GameState["user"];
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
  business: GameState["business"];
  user: GameState["user"];
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

type CompetitionV12 = Omit<GameState["competition"], "standings"> & {
  standings: StandingsV12;
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
  business: GameState["business"];
  user: GameState["user"];
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
  business: GameState["business"];
  user: GameState["user"];
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
  business: GameState["business"];
  user: GameState["user"];
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
  business: GameState["business"];
  user: GameState["user"];
};

type GameStateV12 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 12;
    rngState: number;
  };
  world: GameState["world"];
  competition: CompetitionV12;
  business: GameState["business"];
  user: GameState["user"];
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
function migrateV12ToV13(state: GameStateV12): GameState {
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
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState,
    },
    world: state.world,
    competition: {
      ...state.competition,
      standings: { byTeamId },
    },
    business: state.business,
    user: state.user,
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
