import type {
  TeamId,
  ContractId,
  PlayerId,
  GameId,
  SeasonId,
} from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import type { Game } from "@/domain/entities/game";
import { NEUTRAL_TEAM_PLAY_STYLE } from "@/persistence/mappers/game-state-migrations/legacy-team-play-style";
import { DEFAULT_COACHING_PHILOSOPHY } from "@/domain/coaching/coaching-philosophy";
import { calculateStandings } from "@/systems/standings";
import type {
  WorldWithTeamV10,
  TeamV11,
} from "@/persistence/mappers/game-state-migrations/v01-v07";
import type { GameStateV13 } from "@/persistence/mappers/game-state-migrations/v13-v23";

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
export type ContractV15 = {
  id: ContractId;
  playerId: PlayerId;
  teamId: TeamId;
  salaryPerYear: number;
  yearsRemaining: number;
};

/** Schema ≤14 finances before revenue/expenses. */
export type TeamFinancesV14 = {
  teamId: TeamId;
  cash: number;
  payroll: number;
};

/** Schema 15–19 finances before period books (scalar revenue/expenses). */
export type TeamFinancesV15ThroughV19 = {
  teamId: TeamId;
  cash: number;
  revenue: number;
  expenses: number;
  payroll: number;
};

export type BusinessSliceV14 = {
  contracts: Record<string, ContractV15>;
  finances: Record<string, TeamFinancesV14>;
};

export type BusinessSliceV15 = {
  contracts: Record<string, ContractV15>;
  finances: Record<string, TeamFinancesV15ThroughV19>;
};

/** Schema 16 business before freeAgency offers. */
export type BusinessSliceV16 = {
  contracts: GameState["business"]["contracts"];
  finances: Record<string, TeamFinancesV15ThroughV19>;
};

/** Schema ≤14 user slice before owner objectives. */
export type UserSliceV14 = {
  controlledTeamId: TeamId;
  mode: GameState["user"]["mode"];
};

/** Schema v8 game shape before periodScores and extended box-score fields. */
export type GameV8 = {
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

export type GameStateV8 = {
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
export function migrateV8ToV9(state: GameStateV8): GameStateV9 {
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

export type GameStateV9 = {
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
export function migrateV9ToV10(state: GameStateV9): GameStateV10 {
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
        started: false,
      })) as Game["playerStats"],
      // competitionType and team snapshots are backfilled by later migrations.
    } as unknown as Game;
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

export type GameStateV10 = {
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
export function migrateV10ToV11(state: GameStateV10): GameStateV11 {
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

export type GameStateV11 = {
  meta: Omit<GameState["meta"], "schemaVersion"> & {
    schemaVersion: 11;
    rngState: number;
  };
  world: WorldWithTeamV11;
  competition: CompetitionV12;
  business: BusinessSliceV14;
  user: UserSliceV14;
};

export type GameStateV12 = {
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
export function migrateV11ToV12(state: GameStateV11): GameStateV12 {
  const teams = Object.fromEntries(
    Object.entries(state.world.teams).map(([id, team]) => [
      id,
      {
        ...team,
        playStyle: { ...team.playStyle },
        coachingPhilosophy: { ...DEFAULT_COACHING_PHILOSOPHY },
      },
    ]),
  ) as unknown as GameState["world"]["teams"];

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
export function migrateV12ToV13(state: GameStateV12): GameStateV13 {
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
