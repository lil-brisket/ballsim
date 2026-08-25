import type { GamePlayerStats } from "@/domain/entities/game";
import type { GameTeamStats } from "@/domain/entities/game-result";

/**
 * Shared statistical invariant failures (rule + detail).
 * Used by simulation validation and completed-game box-score validation.
 */
export type StatInvariantFailure = {
  rule: string;
  detail: string;
};

/** Shooting / rebound identity checks for a single team's totals. */
export function checkShootingStatInvariants(
  label: string,
  stats: {
    points: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    threePointersMade: number;
    threePointersAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    rebounds: number;
    offensiveRebounds: number;
    defensiveRebounds: number;
  },
): StatInvariantFailure[] {
  const failures: StatInvariantFailure[] = [];
  const fail = (rule: string, detail: string) => {
    failures.push({ rule, detail: `${label}: ${detail}` });
  };

  if (stats.fieldGoalsMade > stats.fieldGoalsAttempted) {
    fail(
      "FGM_LE_FGA",
      `FGM ${stats.fieldGoalsMade} > FGA ${stats.fieldGoalsAttempted}`,
    );
  }
  if (stats.threePointersMade > stats.threePointersAttempted) {
    fail(
      "3PM_LE_3PA",
      `3PM ${stats.threePointersMade} > 3PA ${stats.threePointersAttempted}`,
    );
  }
  if (stats.freeThrowsMade > stats.freeThrowsAttempted) {
    fail(
      "FTM_LE_FTA",
      `FTM ${stats.freeThrowsMade} > FTA ${stats.freeThrowsAttempted}`,
    );
  }
  if (stats.threePointersMade > stats.fieldGoalsMade) {
    fail(
      "3PM_LE_FGM",
      `3PM ${stats.threePointersMade} > FGM ${stats.fieldGoalsMade}`,
    );
  }
  if (stats.threePointersAttempted > stats.fieldGoalsAttempted) {
    fail(
      "3PA_LE_FGA",
      `3PA ${stats.threePointersAttempted} > FGA ${stats.fieldGoalsAttempted}`,
    );
  }

  const twoPointFgm = stats.fieldGoalsMade - stats.threePointersMade;
  if (twoPointFgm < 0) {
    fail("TWO_POINT_FGM_NONNEG", `FGM - 3PM = ${twoPointFgm}`);
  }

  if (
    stats.rebounds !==
    stats.offensiveRebounds + stats.defensiveRebounds
  ) {
    fail(
      "REB_SUM",
      `REB ${stats.rebounds} !== OREB ${stats.offensiveRebounds} + DREB ${stats.defensiveRebounds}`,
    );
  }

  const expectedPoints =
    2 * twoPointFgm + 3 * stats.threePointersMade + stats.freeThrowsMade;
  if (stats.points !== expectedPoints) {
    fail(
      "POINTS_IDENTITY",
      `points ${stats.points} !== 2*2PM + 3*3PM + FTM (= ${expectedPoints})`,
    );
  }

  return failures;
}

/** Non-negative integer checks for common box-score numeric fields. */
export function checkNonNegativeBoxScoreFields(
  label: string,
  stats: {
    points: number;
    minutes?: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    threePointersMade: number;
    threePointersAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    offensiveRebounds: number;
    defensiveRebounds: number;
    rebounds: number;
    assists: number;
    turnovers: number;
    fouls: number;
  },
): StatInvariantFailure[] {
  const failures: StatInvariantFailure[] = [];
  const fields: Array<[string, number | undefined]> = [
    ["points", stats.points],
    ["minutes", stats.minutes],
    ["fieldGoalsMade", stats.fieldGoalsMade],
    ["fieldGoalsAttempted", stats.fieldGoalsAttempted],
    ["threePointersMade", stats.threePointersMade],
    ["threePointersAttempted", stats.threePointersAttempted],
    ["freeThrowsMade", stats.freeThrowsMade],
    ["freeThrowsAttempted", stats.freeThrowsAttempted],
    ["offensiveRebounds", stats.offensiveRebounds],
    ["defensiveRebounds", stats.defensiveRebounds],
    ["rebounds", stats.rebounds],
    ["assists", stats.assists],
    ["turnovers", stats.turnovers],
    ["fouls", stats.fouls],
  ];
  for (const [name, value] of fields) {
    if (value === undefined) {
      continue;
    }
    if (!Number.isInteger(value) || value < 0) {
      failures.push({
        rule: "NON_NEGATIVE",
        detail: `${label}: ${name}=${value}`,
      });
    }
  }
  return failures;
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

/** Player box-score rows must sum to team totals for attributable fields. */
export function checkPlayerTeamAggregation(
  label: string,
  team: GameTeamStats,
  playerRows: readonly GamePlayerStats[],
): StatInvariantFailure[] {
  const failures: StatInvariantFailure[] = [];
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
        rule: "PLAYER_SUM_EQ_TEAM",
        detail: `${label}: ${field}: players ${fromPlayers} !== team ${fromTeam}`,
      });
    }
  }
  return failures;
}

/** Player points for a side must equal that side's final score. */
export function checkPlayerPointsEqualScore(
  label: string,
  playerRows: readonly GamePlayerStats[],
  scoreSide: number,
): StatInvariantFailure[] {
  const points = sumPlayerField(playerRows, "points");
  if (points !== scoreSide) {
    return [
      {
        rule: "POINTS_EQ_SCORE",
        detail: `${label}: player points ${points} !== score ${scoreSide}`,
      },
    ];
  }
  return [];
}
