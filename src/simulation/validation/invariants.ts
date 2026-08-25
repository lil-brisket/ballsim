import type { GamePlayerStats } from "@/domain/entities/game";
import type { GameResult } from "@/domain/entities/game-result";
import type { GameTeamStats } from "@/domain/entities/game-result";
import {
  checkNonNegativeBoxScoreFields,
  checkPlayerTeamAggregation,
  checkShootingStatInvariants,
} from "@/domain/entities/game-stat-invariants";
import type {
  GameSnapshot,
  InvariantFailure,
  TeamGameSnapshot,
  TeamSide,
} from "@/simulation/validation/types";

function pctMatches(
  made: number,
  attempted: number,
  pct: number | null,
): boolean {
  if (attempted === 0) {
    return pct === null;
  }
  if (pct === null) {
    return false;
  }
  return Math.abs(pct - made / attempted) < 1e-9;
}

function checkTeamInvariants(
  gameId: string,
  side: TeamSide,
  team: TeamGameSnapshot,
  scoreSide: number,
  failures: InvariantFailure[],
): void {
  const fail = (rule: string, detail: string) => {
    failures.push({ gameId, side, rule, detail });
  };

  for (const failure of checkShootingStatInvariants(side, team)) {
    fail(failure.rule, failure.detail.replace(`${side}: `, ""));
  }

  for (const failure of checkNonNegativeBoxScoreFields(side, team)) {
    fail(failure.rule, failure.detail.replace(`${side}: `, ""));
  }

  if (
    !pctMatches(
      team.fieldGoalsMade,
      team.fieldGoalsAttempted,
      team.fieldGoalPct,
    )
  ) {
    fail("FG_PCT", `FG% inconsistent with FGM/FGA`);
  }
  if (
    !pctMatches(
      team.threePointersMade,
      team.threePointersAttempted,
      team.threePointPct,
    )
  ) {
    fail("3PT_PCT", `3PT% inconsistent with 3PM/3PA`);
  }
  if (
    !pctMatches(
      team.freeThrowsMade,
      team.freeThrowsAttempted,
      team.freeThrowPct,
    )
  ) {
    fail("FT_PCT", `FT% inconsistent with FTM/FTA`);
  }

  if (team.points !== scoreSide) {
    fail(
      "POINTS_EQ_SCORE",
      `team points ${team.points} !== score.${side} ${scoreSide}`,
    );
  }

  if (
    !Number.isFinite(team.possessions) ||
    team.possessions <= 0 ||
    !Number.isInteger(team.possessions)
  ) {
    fail(
      "POSSESSIONS_POSITIVE",
      `possessions must be a positive integer, got ${team.possessions}`,
    );
  }
}

/**
 * Validates mathematical consistency of a GameResult + collected snapshot.
 * Returns failures (empty = pass). Does not throw.
 */
export function checkGameInvariants(
  result: GameResult,
  snapshot: GameSnapshot,
  homePlayerIds: ReadonlySet<string>,
  awayPlayerIds: ReadonlySet<string>,
): InvariantFailure[] {
  const failures: InvariantFailure[] = [];

  checkTeamInvariants(
    snapshot.gameId,
    "home",
    snapshot.home,
    snapshot.homeScore,
    failures,
  );
  checkTeamInvariants(
    snapshot.gameId,
    "away",
    snapshot.away,
    snapshot.awayScore,
    failures,
  );

  const periodSum = result.periodScores.reduce(
    (acc, period) => ({
      home: acc.home + period.home,
      away: acc.away + period.away,
    }),
    { home: 0, away: 0 },
  );
  if (
    periodSum.home !== result.score.home ||
    periodSum.away !== result.score.away
  ) {
    failures.push({
      gameId: snapshot.gameId,
      rule: "PERIOD_SCORES_SUM",
      detail: `periodScores sum ${JSON.stringify(periodSum)} !== score ${JSON.stringify(result.score)}`,
    });
  }

  if (result.score.home === result.score.away) {
    failures.push({
      gameId: snapshot.gameId,
      rule: "NO_TIE",
      detail: `final score tied ${result.score.home}-${result.score.away}`,
    });
  }

  const homeRows = result.playerStats.filter((row) =>
    homePlayerIds.has(row.playerId),
  );
  const awayRows = result.playerStats.filter((row) =>
    awayPlayerIds.has(row.playerId),
  );
  for (const failure of checkPlayerTeamAggregation(
    "home",
    result.teamStats.home,
    homeRows,
  )) {
    failures.push({
      gameId: snapshot.gameId,
      side: "home",
      rule: failure.rule,
      detail: failure.detail.replace("home: ", ""),
    });
  }
  for (const failure of checkPlayerTeamAggregation(
    "away",
    result.teamStats.away,
    awayRows,
  )) {
    failures.push({
      gameId: snapshot.gameId,
      side: "away",
      rule: failure.rule,
      detail: failure.detail.replace("away: ", ""),
    });
  }

  return failures;
}

/**
 * Pure team-snapshot invariant check for unit tests (no GameResult required).
 */
export function checkTeamSnapshotInvariants(
  team: TeamGameSnapshot,
  scoreSide: number,
): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  checkTeamInvariants("synthetic", team.side, team, scoreSide, failures);
  return failures;
}

/** Re-export for callers that previously imported aggregation from this module. */
export type { GameTeamStats, GamePlayerStats };
