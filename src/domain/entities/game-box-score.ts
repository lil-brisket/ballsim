import type { Game, GamePlayerStats } from "@/domain/entities/game";
import { aggregateTeamStats } from "@/domain/entities/game-result";
import {
  checkNonNegativeBoxScoreFields,
  checkPlayerPointsEqualScore,
  checkPlayerTeamAggregation,
  checkShootingStatInvariants,
  type StatInvariantFailure,
} from "@/domain/entities/game-stat-invariants";

/**
 * Validates a finalized Game's box score for statistical consistency.
 * Returns failures (empty = pass). Does not throw.
 *
 * Requires playerStats.teamId to be set (new authoritative games).
 * Legacy rows with null teamId skip team-partition checks that need it.
 */
export function validateCompletedGameBoxScore(
  game: Game,
): StatInvariantFailure[] {
  const failures: StatInvariantFailure[] = [];

  if (game.status !== "final") {
    failures.push({
      rule: "STATUS_FINAL",
      detail: `expected status "final", got "${game.status}"`,
    });
    return failures;
  }

  if (game.score.home < 0 || game.score.away < 0) {
    failures.push({
      rule: "SCORE_NONNEG",
      detail: `score ${JSON.stringify(game.score)}`,
    });
  }

  if (game.score.home === game.score.away) {
    failures.push({
      rule: "NO_TIE",
      detail: `final score tied ${game.score.home}-${game.score.away}`,
    });
  }

  const seenPlayerIds = new Set<string>();
  for (const row of game.playerStats) {
    if (seenPlayerIds.has(row.playerId)) {
      failures.push({
        rule: "DUPLICATE_PLAYER",
        detail: `player ${row.playerId} appears more than once`,
      });
    }
    seenPlayerIds.add(row.playerId);

    failures.push(
      ...checkNonNegativeBoxScoreFields(`player ${row.playerId}`, {
        points: row.points,
        minutes: row.minutes,
        fieldGoalsMade: row.fieldGoalsMade,
        fieldGoalsAttempted: row.fieldGoalsAttempted,
        threePointersMade: row.threePointersMade,
        threePointersAttempted: row.threePointersAttempted,
        freeThrowsMade: row.freeThrowsMade,
        freeThrowsAttempted: row.freeThrowsAttempted,
        offensiveRebounds: row.offensiveRebounds,
        defensiveRebounds: row.defensiveRebounds,
        rebounds: row.rebounds,
        assists: row.assists,
        turnovers: row.turnovers,
        fouls: row.fouls,
      }),
      ...checkShootingStatInvariants(`player ${row.playerId}`, row),
    );

    if (
      row.teamId != null &&
      row.teamId !== game.homeTeamId &&
      row.teamId !== game.awayTeamId
    ) {
      failures.push({
        rule: "PLAYER_TEAM_MATCHUP",
        detail: `player ${row.playerId} teamId ${row.teamId} is not home or away`,
      });
    }
  }

  const { homeRows, awayRows, hasAuthoritativeTeams } = partitionPlayerStats(
    game,
  );

  if (hasAuthoritativeTeams) {
    const homeTeam = aggregateTeamStats(game.homeTeamId, homeRows);
    const awayTeam = aggregateTeamStats(game.awayTeamId, awayRows);

    failures.push(
      ...checkShootingStatInvariants("home", homeTeam),
      ...checkShootingStatInvariants("away", awayTeam),
      ...checkNonNegativeBoxScoreFields("home", homeTeam),
      ...checkNonNegativeBoxScoreFields("away", awayTeam),
      ...checkPlayerTeamAggregation("home", homeTeam, homeRows),
      ...checkPlayerTeamAggregation("away", awayTeam, awayRows),
      ...checkPlayerPointsEqualScore("home", homeRows, game.score.home),
      ...checkPlayerPointsEqualScore("away", awayRows, game.score.away),
    );
  }

  return failures;
}

/**
 * Throws if {@link validateCompletedGameBoxScore} reports failures.
 * Matches createGame's strict entity-validation style.
 */
export function assertCompletedGameBoxScore(game: Game): void {
  const failures = validateCompletedGameBoxScore(game);
  if (failures.length === 0) {
    return;
  }
  const summary = failures
    .map((failure) => `${failure.rule}: ${failure.detail}`)
    .join("; ");
  throw new Error(
    `Completed game ${game.id} failed box-score validation: ${summary}`,
  );
}

function partitionPlayerStats(game: Game): {
  homeRows: GamePlayerStats[];
  awayRows: GamePlayerStats[];
  hasAuthoritativeTeams: boolean;
} {
  const withTeam = game.playerStats.filter((row) => row.teamId != null);
  if (withTeam.length === 0) {
    return { homeRows: [], awayRows: [], hasAuthoritativeTeams: false };
  }
  if (withTeam.length !== game.playerStats.length) {
    return { homeRows: [], awayRows: [], hasAuthoritativeTeams: false };
  }
  const homeRows = game.playerStats.filter(
    (row) => row.teamId === game.homeTeamId,
  );
  const awayRows = game.playerStats.filter(
    (row) => row.teamId === game.awayTeamId,
  );
  return { homeRows, awayRows, hasAuthoritativeTeams: true };
}
