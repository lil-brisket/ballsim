import type { GamePlayerStats } from "@/domain/entities/game";
import type { GameResult } from "@/domain/entities/game-result";
import type { GameTeamStats } from "@/domain/entities/game-result";
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

  if (team.fieldGoalsMade > team.fieldGoalsAttempted) {
    fail("FGM_LE_FGA", `FGM ${team.fieldGoalsMade} > FGA ${team.fieldGoalsAttempted}`);
  }
  if (team.threePointersMade > team.threePointersAttempted) {
    fail(
      "3PM_LE_3PA",
      `3PM ${team.threePointersMade} > 3PA ${team.threePointersAttempted}`,
    );
  }
  if (team.freeThrowsMade > team.freeThrowsAttempted) {
    fail("FTM_LE_FTA", `FTM ${team.freeThrowsMade} > FTA ${team.freeThrowsAttempted}`);
  }
  if (team.threePointersMade > team.fieldGoalsMade) {
    fail("3PM_LE_FGM", `3PM ${team.threePointersMade} > FGM ${team.fieldGoalsMade}`);
  }
  if (team.threePointersAttempted > team.fieldGoalsAttempted) {
    fail(
      "3PA_LE_FGA",
      `3PA ${team.threePointersAttempted} > FGA ${team.fieldGoalsAttempted}`,
    );
  }

  const twoPointFgm = team.fieldGoalsMade - team.threePointersMade;
  if (twoPointFgm < 0) {
    fail("TWO_POINT_FGM_NONNEG", `FGM - 3PM = ${twoPointFgm}`);
  }

  if (
    team.rebounds !==
    team.offensiveRebounds + team.defensiveRebounds
  ) {
    fail(
      "REB_SUM",
      `REB ${team.rebounds} !== OREB ${team.offensiveRebounds} + DREB ${team.defensiveRebounds}`,
    );
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

  const expectedPoints =
    2 * twoPointFgm + 3 * team.threePointersMade + team.freeThrowsMade;
  if (team.points !== expectedPoints) {
    fail(
      "POINTS_IDENTITY",
      `points ${team.points} !== 2*2PM + 3*3PM + FTM (= ${expectedPoints})`,
    );
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

  const nonNegFields: Array<[string, number]> = [
    ["points", team.points],
    ["fieldGoalsMade", team.fieldGoalsMade],
    ["fieldGoalsAttempted", team.fieldGoalsAttempted],
    ["threePointersMade", team.threePointersMade],
    ["threePointersAttempted", team.threePointersAttempted],
    ["freeThrowsMade", team.freeThrowsMade],
    ["freeThrowsAttempted", team.freeThrowsAttempted],
    ["offensiveRebounds", team.offensiveRebounds],
    ["defensiveRebounds", team.defensiveRebounds],
    ["rebounds", team.rebounds],
    ["assists", team.assists],
    ["turnovers", team.turnovers],
    ["fouls", team.fouls],
  ];
  for (const [name, value] of nonNegFields) {
    if (!Number.isInteger(value) || value < 0) {
      fail("NON_NEGATIVE", `${name}=${value}`);
    }
  }
}

function sumPlayerField(
  rows: readonly GamePlayerStats[],
  field: keyof GamePlayerStats,
): number {
  let total = 0;
  for (const row of rows) {
    const value = row[field];
    if (typeof value === "number") {
      total += value;
    }
  }
  return total;
}

function checkPlayerTeamAggregation(
  gameId: string,
  side: TeamSide,
  team: GameTeamStats,
  playerRows: readonly GamePlayerStats[],
  failures: InvariantFailure[],
): void {
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
    const fromPlayers = sumPlayerField(
      playerRows,
      field as keyof GamePlayerStats,
    );
    const fromTeam = team[field] as number;
    if (fromPlayers !== fromTeam) {
      failures.push({
        gameId,
        side,
        rule: "PLAYER_SUM_EQ_TEAM",
        detail: `${field}: players ${fromPlayers} !== team ${fromTeam}`,
      });
    }
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
  checkPlayerTeamAggregation(
    snapshot.gameId,
    "home",
    result.teamStats.home,
    homeRows,
    failures,
  );
  checkPlayerTeamAggregation(
    snapshot.gameId,
    "away",
    result.teamStats.away,
    awayRows,
    failures,
  );

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
