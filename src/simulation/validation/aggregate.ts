import type {
  GameSnapshot,
  HomeAwaySplit,
  MetricSummary,
  PooledShooting,
  ValidationAggregates,
} from "@/simulation/validation/types";

function sortedCopy(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function summarizeMetric(values: readonly number[]): MetricSummary {
  if (values.length === 0) {
    return { n: 0, mean: 0, median: 0, min: 0, max: 0, stdev: 0 };
  }
  const n = values.length;
  let sum = 0;
  let min = values[0]!;
  let max = values[0]!;
  for (const value of values) {
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const mean = sum / n;
  let varianceSum = 0;
  for (const value of values) {
    const delta = value - mean;
    varianceSum += delta * delta;
  }
  const stdev = Math.sqrt(varianceSum / n);
  const sorted = sortedCopy(values);
  const mid = Math.floor(n / 2);
  const median =
    n % 2 === 1
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return { n, mean, median, min, max, stdev };
}

function summarizeNullable(
  values: readonly (number | null)[],
): MetricSummary {
  return summarizeMetric(
    values.filter((value): value is number => value !== null),
  );
}

function pooledPct(made: number, attempted: number): number | null {
  if (attempted === 0) {
    return null;
  }
  return made / attempted;
}

/**
 * Aggregates game/team-grain snapshots. Percentages average per-team-game
 * rates (skipping zero-attempt); pooled shooting is reported separately.
 */
export function aggregateSnapshots(
  snapshots: readonly GameSnapshot[],
  seed: number | string,
): ValidationAggregates {
  const teamPoints: number[] = [];
  const possessionsPerTeam: number[] = [];
  const pointsPerPossession: number[] = [];
  const fieldGoalPct: Array<number | null> = [];
  const threePointPct: Array<number | null> = [];
  const freeThrowPct: Array<number | null> = [];
  const offensiveRebounds: number[] = [];
  const defensiveRebounds: number[] = [];
  const totalRebounds: number[] = [];
  const assists: number[] = [];
  const turnovers: number[] = [];
  const fouls: number[] = [];
  const freeThrowAttempts: number[] = [];
  const assistToFgmRatio: number[] = [];

  const gameTotals: number[] = [];
  const absoluteDifferentials: number[] = [];

  const homePoints: number[] = [];
  const awayPoints: number[] = [];
  const homeFg: Array<number | null> = [];
  const awayFg: Array<number | null> = [];
  const home3: Array<number | null> = [];
  const away3: Array<number | null> = [];
  const homeTo: number[] = [];
  const awayTo: number[] = [];

  let homeWins = 0;
  let awayWins = 0;

  let pooledFgm = 0;
  let pooledFga = 0;
  let pooled3pm = 0;
  let pooled3pa = 0;
  let pooledFtm = 0;
  let pooledFta = 0;

  for (const game of snapshots) {
    gameTotals.push(game.totalScore);
    absoluteDifferentials.push(game.absoluteDifferential);
    if (game.winner === "home") {
      homeWins += 1;
    } else {
      awayWins += 1;
    }

    for (const team of [game.home, game.away]) {
      teamPoints.push(team.points);
      possessionsPerTeam.push(team.possessions);
      if (team.pointsPerPossession !== null) {
        pointsPerPossession.push(team.pointsPerPossession);
      }
      fieldGoalPct.push(team.fieldGoalPct);
      threePointPct.push(team.threePointPct);
      freeThrowPct.push(team.freeThrowPct);
      offensiveRebounds.push(team.offensiveRebounds);
      defensiveRebounds.push(team.defensiveRebounds);
      totalRebounds.push(team.rebounds);
      assists.push(team.assists);
      turnovers.push(team.turnovers);
      fouls.push(team.fouls);
      freeThrowAttempts.push(team.freeThrowsAttempted);
      if (team.fieldGoalsMade > 0) {
        assistToFgmRatio.push(team.assists / team.fieldGoalsMade);
      }

      pooledFgm += team.fieldGoalsMade;
      pooledFga += team.fieldGoalsAttempted;
      pooled3pm += team.threePointersMade;
      pooled3pa += team.threePointersAttempted;
      pooledFtm += team.freeThrowsMade;
      pooledFta += team.freeThrowsAttempted;
    }

    homePoints.push(game.home.points);
    awayPoints.push(game.away.points);
    homeFg.push(game.home.fieldGoalPct);
    awayFg.push(game.away.fieldGoalPct);
    home3.push(game.home.threePointPct);
    away3.push(game.away.threePointPct);
    homeTo.push(game.home.turnovers);
    awayTo.push(game.away.turnovers);
  }

  const gamesSimulated = snapshots.length;
  const homeAway: HomeAwaySplit = {
    homeWinRate: gamesSimulated === 0 ? 0 : homeWins / gamesSimulated,
    homeWins,
    awayWins,
    homePoints: summarizeMetric(homePoints),
    awayPoints: summarizeMetric(awayPoints),
    homeFieldGoalPct: summarizeNullable(homeFg),
    awayFieldGoalPct: summarizeNullable(awayFg),
    homeThreePointPct: summarizeNullable(home3),
    awayThreePointPct: summarizeNullable(away3),
    homeTurnovers: summarizeMetric(homeTo),
    awayTurnovers: summarizeMetric(awayTo),
  };

  const pooledShooting: PooledShooting = {
    fieldGoalsMade: pooledFgm,
    fieldGoalsAttempted: pooledFga,
    fieldGoalPct: pooledPct(pooledFgm, pooledFga),
    threePointersMade: pooled3pm,
    threePointersAttempted: pooled3pa,
    threePointPct: pooledPct(pooled3pm, pooled3pa),
    freeThrowsMade: pooledFtm,
    freeThrowsAttempted: pooledFta,
    freeThrowPct: pooledPct(pooledFtm, pooledFta),
  };

  return {
    gamesSimulated,
    seed,
    teamPoints: summarizeMetric(teamPoints),
    gameTotals: summarizeMetric(gameTotals),
    absoluteDifferentials: summarizeMetric(absoluteDifferentials),
    possessionsPerTeam: summarizeMetric(possessionsPerTeam),
    pointsPerPossession: summarizeMetric(pointsPerPossession),
    fieldGoalPct: summarizeNullable(fieldGoalPct),
    threePointPct: summarizeNullable(threePointPct),
    freeThrowPct: summarizeNullable(freeThrowPct),
    offensiveRebounds: summarizeMetric(offensiveRebounds),
    defensiveRebounds: summarizeMetric(defensiveRebounds),
    totalRebounds: summarizeMetric(totalRebounds),
    assists: summarizeMetric(assists),
    turnovers: summarizeMetric(turnovers),
    fouls: summarizeMetric(fouls),
    freeThrowAttempts: summarizeMetric(freeThrowAttempts),
    assistToFgmRatio: summarizeMetric(assistToFgmRatio),
    pooledShooting,
    homeAway,
  };
}
