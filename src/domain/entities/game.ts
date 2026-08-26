import { parseCalendarDate } from "@/domain/calendar-date";
import type { TeamBranding } from "@/domain/entities/team-branding";
import type { GameId, PlayerId, SeasonId, TeamId } from "@/domain/ids";

export type GameStatus = "scheduled" | "in_progress" | "final";

export const GAME_STATUSES: readonly GameStatus[] = [
  "scheduled",
  "in_progress",
  "final",
];

export type GameCompetitionType = "regular_season" | "playoffs";

export const GAME_COMPETITION_TYPES: readonly GameCompetitionType[] = [
  "regular_season",
  "playoffs",
];

export type GameScore = {
  home: number;
  away: number;
};

export type GameEventType =
  | "shot_made"
  | "shot_missed"
  | "free_throw"
  | "rebound"
  | "assist"
  | "steal"
  | "block"
  | "turnover"
  | "foul"
  | "substitution";

export const GAME_EVENT_TYPES: readonly GameEventType[] = [
  "shot_made",
  "shot_missed",
  "free_throw",
  "rebound",
  "assist",
  "steal",
  "block",
  "turnover",
  "foul",
  "substitution",
];

export type GameEvent = {
  sequence: number;
  type: GameEventType;
  playerId: PlayerId | null;
  teamId: TeamId | null;
};

/** Team display identity captured when a game is finalized. */
export type GameTeamSnapshot = {
  teamId: TeamId;
  city: string;
  name: string;
  abbreviation: string;
  branding: TeamBranding;
};

export type GamePlayerStats = {
  playerId: PlayerId;
  /**
   * Roster team at tip-off. Null only for pre-v35 legacy rows or
   * scheduled/in-progress games before finalization.
   */
  teamId: TeamId | null;
  /** Player first name at tip-off. Null for legacy / pre-finalization. */
  firstName: string | null;
  /** Player last name at tip-off. Null for legacy / pre-finalization. */
  lastName: string | null;
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
  /** Meaningful on-ball offensive involvement; at most one credit per possession. */
  touches: number;
};

export type Game = {
  id: GameId;
  seasonId: SeasonId;
  date: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  /** Set at creation; single source of truth for regular season vs playoffs. */
  competitionType: GameCompetitionType;
  status: GameStatus;
  score: GameScore;
  /** Points scored per completed period (not cumulative). Empty while scheduled. */
  periodScores: GameScore[];
  events: GameEvent[];
  playerStats: GamePlayerStats[];
  /** Populated at finalization; null while scheduled/in_progress or legacy. */
  homeTeamSnapshot: GameTeamSnapshot | null;
  /** Populated at finalization; null while scheduled/in_progress or legacy. */
  awayTeamSnapshot: GameTeamSnapshot | null;
};

/** Unvalidated construction payload for {@link createGame}. */
export type GameInput = {
  id: GameId;
  seasonId: SeasonId;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  date: string;
  competitionType: GameCompetitionType;
  score: GameScore;
  status: GameStatus;
  periodScores: GameScore[];
  events: GameEvent[];
  playerStats: GamePlayerStats[];
  homeTeamSnapshot: GameTeamSnapshot | null;
  awayTeamSnapshot: GameTeamSnapshot | null;
};

/**
 * Validates input and returns a new plain Game.
 * Does not mutate input. Rejects invalid values (no clamping or normalization).
 */
export function createGame(input: GameInput): Game {
  assertNonEmptyId(input.id, "id");
  assertNonEmptyId(input.seasonId, "seasonId");
  assertNonEmptyId(input.homeTeamId, "homeTeamId");
  assertNonEmptyId(input.awayTeamId, "awayTeamId");
  if (input.homeTeamId === input.awayTeamId) {
    throw new Error("Game homeTeamId and awayTeamId must be different.");
  }
  assertDate(input.date);
  assertCompetitionType(input.competitionType);
  assertStatus(input.status);
  assertScore(input.score);
  assertPeriodScores(input.periodScores);
  assertEvents(input.events);
  assertPlayerStats(input.playerStats);
  assertTeamSnapshot(input.homeTeamSnapshot, "homeTeamSnapshot");
  assertTeamSnapshot(input.awayTeamSnapshot, "awayTeamSnapshot");
  if (
    input.homeTeamSnapshot != null &&
    input.homeTeamSnapshot.teamId !== input.homeTeamId
  ) {
    throw new Error(
      "Game homeTeamSnapshot.teamId must equal homeTeamId.",
    );
  }
  if (
    input.awayTeamSnapshot != null &&
    input.awayTeamSnapshot.teamId !== input.awayTeamId
  ) {
    throw new Error(
      "Game awayTeamSnapshot.teamId must equal awayTeamId.",
    );
  }

  return {
    id: input.id,
    seasonId: input.seasonId,
    date: input.date,
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    competitionType: input.competitionType,
    status: input.status,
    score: { ...input.score },
    periodScores: input.periodScores.map((period) => ({ ...period })),
    events: input.events.map((event) => ({ ...event })),
    playerStats: input.playerStats.map((stats) => ({ ...stats })),
    homeTeamSnapshot: input.homeTeamSnapshot
      ? { ...input.homeTeamSnapshot }
      : null,
    awayTeamSnapshot: input.awayTeamSnapshot
      ? { ...input.awayTeamSnapshot }
      : null,
  };
}

/** Zeroed box-score row for a player (DNP or pre-tip). */
export function createEmptyGamePlayerStats(playerId: PlayerId): GamePlayerStats {
  return {
    playerId,
    teamId: null,
    firstName: null,
    lastName: null,
    minutes: 0,
    points: 0,
    rebounds: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    touches: 0,
  };
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Game ${field} must be a non-empty string.`);
  }
}

function assertOptionalId(value: string | null, field: string): void {
  if (value === null) {
    return;
  }
  assertNonEmptyId(value, field);
}

function assertDate(value: string): void {
  if (typeof value !== "string") {
    throw new Error("Game date must be a string.");
  }
  try {
    parseCalendarDate(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Game date is invalid: ${message}`);
  }
}

function assertCompetitionType(value: string): void {
  if (!GAME_COMPETITION_TYPES.includes(value as GameCompetitionType)) {
    throw new Error(
      `Game competitionType must be one of ${GAME_COMPETITION_TYPES.join(", ")}.`,
    );
  }
}

function assertStatus(value: string): void {
  if (!GAME_STATUSES.includes(value as GameStatus)) {
    throw new Error(
      `Game status must be one of ${GAME_STATUSES.join(", ")}.`,
    );
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Game ${field} must be a non-negative integer.`);
  }
}

function assertScore(score: GameScore, fieldPrefix = "score"): void {
  if (score === null || typeof score !== "object" || Array.isArray(score)) {
    throw new Error(`Game ${fieldPrefix} must be an object.`);
  }
  assertNonNegativeInteger(score.home, `${fieldPrefix}.home`);
  assertNonNegativeInteger(score.away, `${fieldPrefix}.away`);
}

function assertPeriodScores(periodScores: unknown): void {
  if (!Array.isArray(periodScores)) {
    throw new Error("Game periodScores must be an array.");
  }
  for (let index = 0; index < periodScores.length; index += 1) {
    assertScore(
      periodScores[index] as GameScore,
      `periodScores[${index}]`,
    );
  }
}

function assertEvents(events: unknown): void {
  if (!Array.isArray(events)) {
    throw new Error("Game events must be an array.");
  }
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index] as GameEvent;
    if (event === null || typeof event !== "object" || Array.isArray(event)) {
      throw new Error(`Game events[${index}] must be an object.`);
    }
    assertNonNegativeInteger(event.sequence, `events[${index}].sequence`);
    if (!GAME_EVENT_TYPES.includes(event.type as GameEventType)) {
      throw new Error(
        `Game events[${index}].type must be one of ${GAME_EVENT_TYPES.join(", ")}.`,
      );
    }
    assertOptionalId(event.playerId, `events[${index}].playerId`);
    assertOptionalId(event.teamId, `events[${index}].teamId`);
  }
}

function assertTeamSnapshot(
  snapshot: GameTeamSnapshot | null,
  field: string,
): void {
  if (snapshot === null) {
    return;
  }
  if (typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error(`Game ${field} must be an object or null.`);
  }
  assertNonEmptyId(snapshot.teamId, `${field}.teamId`);
  if (typeof snapshot.city !== "string" || snapshot.city.length === 0) {
    throw new Error(`Game ${field}.city must be a non-empty string.`);
  }
  if (typeof snapshot.name !== "string" || snapshot.name.length === 0) {
    throw new Error(`Game ${field}.name must be a non-empty string.`);
  }
  if (
    typeof snapshot.abbreviation !== "string" ||
    snapshot.abbreviation.length === 0
  ) {
    throw new Error(`Game ${field}.abbreviation must be a non-empty string.`);
  }
}

function assertPlayerStats(playerStats: unknown): void {
  if (!Array.isArray(playerStats)) {
    throw new Error("Game playerStats must be an array.");
  }
  for (let index = 0; index < playerStats.length; index += 1) {
    const stats = playerStats[index] as GamePlayerStats;
    if (stats === null || typeof stats !== "object" || Array.isArray(stats)) {
      throw new Error(`Game playerStats[${index}] must be an object.`);
    }
    assertNonEmptyId(stats.playerId, `playerStats[${index}].playerId`);
    assertOptionalId(stats.teamId, `playerStats[${index}].teamId`);
    if (stats.firstName !== null && typeof stats.firstName !== "string") {
      throw new Error(
        `Game playerStats[${index}].firstName must be a string or null.`,
      );
    }
    if (stats.lastName !== null && typeof stats.lastName !== "string") {
      throw new Error(
        `Game playerStats[${index}].lastName must be a string or null.`,
      );
    }
    assertNonNegativeInteger(stats.minutes, `playerStats[${index}].minutes`);
    assertNonNegativeInteger(stats.points, `playerStats[${index}].points`);
    assertNonNegativeInteger(stats.rebounds, `playerStats[${index}].rebounds`);
    assertNonNegativeInteger(
      stats.offensiveRebounds,
      `playerStats[${index}].offensiveRebounds`,
    );
    assertNonNegativeInteger(
      stats.defensiveRebounds,
      `playerStats[${index}].defensiveRebounds`,
    );
    assertNonNegativeInteger(stats.assists, `playerStats[${index}].assists`);
    assertNonNegativeInteger(stats.steals, `playerStats[${index}].steals`);
    assertNonNegativeInteger(stats.blocks, `playerStats[${index}].blocks`);
    assertNonNegativeInteger(
      stats.turnovers,
      `playerStats[${index}].turnovers`,
    );
    assertNonNegativeInteger(stats.fouls, `playerStats[${index}].fouls`);
    assertNonNegativeInteger(
      stats.fieldGoalsMade,
      `playerStats[${index}].fieldGoalsMade`,
    );
    assertNonNegativeInteger(
      stats.fieldGoalsAttempted,
      `playerStats[${index}].fieldGoalsAttempted`,
    );
    assertNonNegativeInteger(
      stats.threePointersMade,
      `playerStats[${index}].threePointersMade`,
    );
    assertNonNegativeInteger(
      stats.threePointersAttempted,
      `playerStats[${index}].threePointersAttempted`,
    );
    assertNonNegativeInteger(
      stats.freeThrowsMade,
      `playerStats[${index}].freeThrowsMade`,
    );
    assertNonNegativeInteger(
      stats.freeThrowsAttempted,
      `playerStats[${index}].freeThrowsAttempted`,
    );
    assertNonNegativeInteger(stats.touches, `playerStats[${index}].touches`);
  }
}
