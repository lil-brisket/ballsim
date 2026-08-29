import { parseCalendarDate } from "@/domain/calendar-date";
import {
  GAME_EVENT_TYPES,
  type GameEvent,
  type GameEventType,
  type GamePlayerStats,
  type GameRotationMeta,
  type GameScore,
} from "@/domain/entities/game";
import type { GameId, SeasonId, TeamId } from "@/domain/ids";

export type GameTeamStats = {
  teamId: TeamId;
  points: number;
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  turnovers: number;
  fouls: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
};

/**
 * Completed offensive possessions per team (not resolution events or
 * changes-of-possession counters). Increment when a team finishes an
 * offensive possession (make that ends the possession, defensive rebound
 * by the opponent, turnover, or free-throw sequence that ends it). Do not
 * count possession starts, and do not double-count multi-step resolutions
 * that keep the same offense (e.g. pass then continue, offensive rebound).
 */
export type PossessionCounts = {
  home: number;
  away: number;
};

/**
 * Self-contained immutable result of a completed game simulation.
 * Sufficient to render a box score without re-running the simulation.
 */
export type GameResult = {
  gameId: GameId;
  seasonId: SeasonId;
  date: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: "final";
  score: GameScore;
  /** Points scored per completed period (not cumulative). */
  periodScores: GameScore[];
  overtimePeriodCount: number;
  /**
   * Completed offensive possessions for home and away.
   * Instrumentation for pace/PPP validation; not persisted on Game.
   */
  possessionCounts: PossessionCounts;
  playerStats: GamePlayerStats[];
  teamStats: { home: GameTeamStats; away: GameTeamStats };
  events: GameEvent[];
  /** Frozen rotation snapshot + trace; null when unavailable. */
  rotationMeta: GameRotationMeta | null;
};

export type GameResultInput = {
  gameId: GameId;
  seasonId: SeasonId;
  date: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: "final";
  score: GameScore;
  periodScores: GameScore[];
  overtimePeriodCount: number;
  possessionCounts: PossessionCounts;
  playerStats: GamePlayerStats[];
  teamStats: { home: GameTeamStats; away: GameTeamStats };
  events: GameEvent[];
  rotationMeta?: GameRotationMeta | null;
};

/**
 * Validates input and returns a new plain GameResult.
 * Does not mutate input. Rejects invalid values (no clamping or normalization).
 */
export function createGameResult(input: GameResultInput): GameResult {
  assertNonEmptyId(input.gameId, "gameId");
  assertNonEmptyId(input.seasonId, "seasonId");
  assertNonEmptyId(input.homeTeamId, "homeTeamId");
  assertNonEmptyId(input.awayTeamId, "awayTeamId");
  if (input.homeTeamId === input.awayTeamId) {
    throw new Error("GameResult homeTeamId and awayTeamId must be different.");
  }
  assertDate(input.date);
  if (input.status !== "final") {
    throw new Error('GameResult status must be "final".');
  }
  assertScore(input.score, "score");
  assertPeriodScores(input.periodScores);
  assertNonNegativeInteger(input.overtimePeriodCount, "overtimePeriodCount");
  assertPossessionCounts(input.possessionCounts);
  assertEvents(input.events);
  assertPlayerStats(input.playerStats);
  assertTeamStats(input.teamStats.home, "teamStats.home");
  assertTeamStats(input.teamStats.away, "teamStats.away");
  if (input.teamStats.home.teamId !== input.homeTeamId) {
    throw new Error("GameResult teamStats.home.teamId must equal homeTeamId.");
  }
  if (input.teamStats.away.teamId !== input.awayTeamId) {
    throw new Error("GameResult teamStats.away.teamId must equal awayTeamId.");
  }

  return {
    gameId: input.gameId,
    seasonId: input.seasonId,
    date: input.date,
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    status: "final",
    score: { ...input.score },
    periodScores: input.periodScores.map((period) => ({ ...period })),
    overtimePeriodCount: input.overtimePeriodCount,
    possessionCounts: {
      home: input.possessionCounts.home,
      away: input.possessionCounts.away,
    },
    playerStats: input.playerStats.map((stats) => ({ ...stats })),
    teamStats: {
      home: { ...input.teamStats.home },
      away: { ...input.teamStats.away },
    },
    events: input.events.map((event) => ({ ...event })),
    rotationMeta: input.rotationMeta ?? null,
  };
}

/** Aggregate player-attributable stats for one team. */
export function aggregateTeamStats(
  teamId: TeamId,
  playerStats: readonly GamePlayerStats[],
): GameTeamStats {
  const totals: GameTeamStats = {
    teamId,
    points: 0,
    rebounds: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    turnovers: 0,
    fouls: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
  };
  for (const row of playerStats) {
    totals.points += row.points;
    totals.rebounds += row.rebounds;
    totals.offensiveRebounds += row.offensiveRebounds;
    totals.defensiveRebounds += row.defensiveRebounds;
    totals.assists += row.assists;
    totals.turnovers += row.turnovers;
    totals.fouls += row.fouls;
    totals.fieldGoalsMade += row.fieldGoalsMade;
    totals.fieldGoalsAttempted += row.fieldGoalsAttempted;
    totals.threePointersMade += row.threePointersMade;
    totals.threePointersAttempted += row.threePointersAttempted;
    totals.freeThrowsMade += row.freeThrowsMade;
    totals.freeThrowsAttempted += row.freeThrowsAttempted;
  }
  return totals;
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`GameResult ${field} must be a non-empty string.`);
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
    throw new Error("GameResult date must be a string.");
  }
  try {
    parseCalendarDate(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GameResult date is invalid: ${message}`);
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`GameResult ${field} must be a non-negative integer.`);
  }
}

function assertScore(score: GameScore, fieldPrefix: string): void {
  if (score === null || typeof score !== "object" || Array.isArray(score)) {
    throw new Error(`GameResult ${fieldPrefix} must be an object.`);
  }
  assertNonNegativeInteger(score.home, `${fieldPrefix}.home`);
  assertNonNegativeInteger(score.away, `${fieldPrefix}.away`);
}

function assertPeriodScores(periodScores: unknown): void {
  if (!Array.isArray(periodScores)) {
    throw new Error("GameResult periodScores must be an array.");
  }
  for (let index = 0; index < periodScores.length; index += 1) {
    assertScore(
      periodScores[index] as GameScore,
      `periodScores[${index}]`,
    );
  }
}

function assertPossessionCounts(counts: unknown): void {
  if (counts === null || typeof counts !== "object" || Array.isArray(counts)) {
    throw new Error("GameResult possessionCounts must be an object.");
  }
  const value = counts as PossessionCounts;
  assertNonNegativeInteger(value.home, "possessionCounts.home");
  assertNonNegativeInteger(value.away, "possessionCounts.away");
}

function assertEvents(events: unknown): void {
  if (!Array.isArray(events)) {
    throw new Error("GameResult events must be an array.");
  }
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index] as GameEvent;
    if (event === null || typeof event !== "object" || Array.isArray(event)) {
      throw new Error(`GameResult events[${index}] must be an object.`);
    }
    assertNonNegativeInteger(event.sequence, `events[${index}].sequence`);
    if (!GAME_EVENT_TYPES.includes(event.type as GameEventType)) {
      throw new Error(
        `GameResult events[${index}].type must be one of ${GAME_EVENT_TYPES.join(", ")}.`,
      );
    }
    assertOptionalId(event.playerId, `events[${index}].playerId`);
    assertOptionalId(event.teamId, `events[${index}].teamId`);
  }
}

function assertPlayerStats(playerStats: unknown): void {
  if (!Array.isArray(playerStats)) {
    throw new Error("GameResult playerStats must be an array.");
  }
  for (let index = 0; index < playerStats.length; index += 1) {
    const stats = playerStats[index] as GamePlayerStats;
    if (stats === null || typeof stats !== "object" || Array.isArray(stats)) {
      throw new Error(`GameResult playerStats[${index}] must be an object.`);
    }
    assertNonEmptyId(stats.playerId, `playerStats[${index}].playerId`);
    if (stats.teamId !== null) {
      assertNonEmptyId(stats.teamId, `playerStats[${index}].teamId`);
    }
    if (stats.firstName !== null && typeof stats.firstName !== "string") {
      throw new Error(
        `GameResult playerStats[${index}].firstName must be a string or null.`,
      );
    }
    if (stats.lastName !== null && typeof stats.lastName !== "string") {
      throw new Error(
        `GameResult playerStats[${index}].lastName must be a string or null.`,
      );
    }
    const fields: Array<keyof GamePlayerStats> = [
      "minutes",
      "points",
      "rebounds",
      "offensiveRebounds",
      "defensiveRebounds",
      "assists",
      "steals",
      "blocks",
      "turnovers",
      "fouls",
      "fieldGoalsMade",
      "fieldGoalsAttempted",
      "threePointersMade",
      "threePointersAttempted",
      "freeThrowsMade",
      "freeThrowsAttempted",
      "touches",
    ];
    for (const field of fields) {
      if (field === "playerId") {
        continue;
      }
      assertNonNegativeInteger(
        stats[field] as number,
        `playerStats[${index}].${field}`,
      );
    }
  }
}

function assertTeamStats(stats: GameTeamStats, fieldPrefix: string): void {
  if (stats === null || typeof stats !== "object" || Array.isArray(stats)) {
    throw new Error(`GameResult ${fieldPrefix} must be an object.`);
  }
  assertNonEmptyId(stats.teamId, `${fieldPrefix}.teamId`);
  const fields: Array<keyof GameTeamStats> = [
    "points",
    "rebounds",
    "offensiveRebounds",
    "defensiveRebounds",
    "assists",
    "turnovers",
    "fouls",
    "fieldGoalsMade",
    "fieldGoalsAttempted",
    "threePointersMade",
    "threePointersAttempted",
    "freeThrowsMade",
    "freeThrowsAttempted",
  ];
  for (const field of fields) {
    if (field === "teamId") {
      continue;
    }
    assertNonNegativeInteger(
      stats[field] as number,
      `${fieldPrefix}.${field}`,
    );
  }
}
