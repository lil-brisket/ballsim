import type { GameResult } from "@/domain/entities/game-result";
import type { GameTeamStats } from "@/domain/entities/game-result";
import type {
  GameSnapshot,
  TeamGameSnapshot,
  TeamSide,
} from "@/simulation/validation/types";

function shootingPct(made: number, attempted: number): number | null {
  if (attempted === 0) {
    return null;
  }
  return made / attempted;
}

/** Player ids per side, for rows not yet stamped with a teamId (possession sim). */
export type SnapshotSidePlayerIds = {
  homePlayerIds: ReadonlySet<string>;
  awayPlayerIds: ReadonlySet<string>;
};

function sumPlayerStat(
  result: GameResult,
  teamId: string,
  sideIds: ReadonlySet<string> | undefined,
  key: "steals" | "blocks",
): number {
  return result.playerStats
    .filter((row) =>
      row.teamId === null
        ? sideIds?.has(row.playerId as string) === true
        : row.teamId === teamId,
    )
    .reduce((total, row) => total + row[key], 0);
}

function teamSnapshot(
  side: TeamSide,
  stats: GameTeamStats,
  possessions: number,
  result: GameResult,
  sideIds: ReadonlySet<string> | undefined,
): TeamGameSnapshot {
  return {
    side,
    teamId: stats.teamId,
    points: stats.points,
    fieldGoalsMade: stats.fieldGoalsMade,
    fieldGoalsAttempted: stats.fieldGoalsAttempted,
    threePointersMade: stats.threePointersMade,
    threePointersAttempted: stats.threePointersAttempted,
    freeThrowsMade: stats.freeThrowsMade,
    freeThrowsAttempted: stats.freeThrowsAttempted,
    offensiveRebounds: stats.offensiveRebounds,
    defensiveRebounds: stats.defensiveRebounds,
    rebounds: stats.rebounds,
    assists: stats.assists,
    // Team stats do not carry steals/blocks; sum the player rows.
    steals: sumPlayerStat(result, stats.teamId, sideIds, "steals"),
    blocks: sumPlayerStat(result, stats.teamId, sideIds, "blocks"),
    turnovers: stats.turnovers,
    fouls: stats.fouls,
    possessions,
    fieldGoalPct: shootingPct(stats.fieldGoalsMade, stats.fieldGoalsAttempted),
    threePointPct: shootingPct(
      stats.threePointersMade,
      stats.threePointersAttempted,
    ),
    freeThrowPct: shootingPct(stats.freeThrowsMade, stats.freeThrowsAttempted),
    pointsPerPossession: possessions > 0 ? stats.points / possessions : null,
  };
}

/**
 * Maps an authoritative GameResult into a validation snapshot.
 * Steals and blocks are summed from player rows; pass `sides` when rows may
 * not carry a teamId yet.
 */
export function collectGameSnapshot(
  result: GameResult,
  sides?: SnapshotSidePlayerIds,
): GameSnapshot {
  const differential = result.score.home - result.score.away;
  return {
    gameId: result.gameId,
    homeScore: result.score.home,
    awayScore: result.score.away,
    totalScore: result.score.home + result.score.away,
    scoreDifferential: differential,
    absoluteDifferential: Math.abs(differential),
    winner: result.score.home > result.score.away ? "home" : "away",
    periodCount: result.periodScores.length,
    overtimePeriodCount: result.overtimePeriodCount,
    homePossessions: result.possessionCounts.home,
    awayPossessions: result.possessionCounts.away,
    totalPossessions:
      result.possessionCounts.home + result.possessionCounts.away,
    home: teamSnapshot(
      "home",
      result.teamStats.home,
      result.possessionCounts.home,
      result,
      sides?.homePlayerIds,
    ),
    away: teamSnapshot(
      "away",
      result.teamStats.away,
      result.possessionCounts.away,
      result,
      sides?.awayPlayerIds,
    ),
  };
}
