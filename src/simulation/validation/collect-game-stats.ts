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

function teamSnapshot(
  side: TeamSide,
  stats: GameTeamStats,
  possessions: number,
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
    turnovers: stats.turnovers,
    fouls: stats.fouls,
    possessions,
    fieldGoalPct: shootingPct(
      stats.fieldGoalsMade,
      stats.fieldGoalsAttempted,
    ),
    threePointPct: shootingPct(
      stats.threePointersMade,
      stats.threePointersAttempted,
    ),
    freeThrowPct: shootingPct(
      stats.freeThrowsMade,
      stats.freeThrowsAttempted,
    ),
    pointsPerPossession:
      possessions > 0 ? stats.points / possessions : null,
  };
}

/**
 * Maps an authoritative GameResult into a validation snapshot.
 * Does not invent steals/blocks or other untracked stats.
 */
export function collectGameSnapshot(result: GameResult): GameSnapshot {
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
    ),
    away: teamSnapshot(
      "away",
      result.teamStats.away,
      result.possessionCounts.away,
    ),
  };
}
