import type {
  CheckResult,
  CorrelationResult,
  MetricSummary,
  ValidationAggregates,
  ValidationVerdict,
} from "@/simulation/validation/types";

/**
 * Deterministic checksum over aggregate report inputs/statistics.
 * Excludes timestamps, wall-clock duration, and display formatting.
 */
export function computeValidationChecksum(input: {
  seed: number | string;
  gamesSimulated: number;
  aggregates: ValidationAggregates;
  invariantFailureCount: number;
  plausibilityChecks: readonly CheckResult[];
  correlations: readonly CorrelationResult[];
  overallVerdict: ValidationVerdict;
}): string {
  const payload = {
    seed: input.seed,
    gamesSimulated: input.gamesSimulated,
    aggregates: serializeAggregates(input.aggregates),
    invariantFailureCount: input.invariantFailureCount,
    plausibility: input.plausibilityChecks.map((check) => ({
      name: check.name,
      verdict: check.verdict,
      value: roundNullable(check.value),
    })),
    correlations: input.correlations.map((corr) => ({
      name: corr.name,
      pearsonR: roundNullable(corr.pearsonR),
      sampleSize: corr.sampleSize,
      verdict: corr.verdict,
    })),
    overallVerdict: input.overallVerdict,
  };
  return fnv1aHex(stableStringify(payload));
}

function serializeAggregates(agg: ValidationAggregates): unknown {
  return {
    gamesSimulated: agg.gamesSimulated,
    seed: agg.seed,
    teamPoints: roundSummary(agg.teamPoints),
    gameTotals: roundSummary(agg.gameTotals),
    absoluteDifferentials: roundSummary(agg.absoluteDifferentials),
    possessionsPerTeam: roundSummary(agg.possessionsPerTeam),
    pointsPerPossession: roundSummary(agg.pointsPerPossession),
    fieldGoalPct: roundSummary(agg.fieldGoalPct),
    threePointPct: roundSummary(agg.threePointPct),
    freeThrowPct: roundSummary(agg.freeThrowPct),
    offensiveRebounds: roundSummary(agg.offensiveRebounds),
    defensiveRebounds: roundSummary(agg.defensiveRebounds),
    totalRebounds: roundSummary(agg.totalRebounds),
    assists: roundSummary(agg.assists),
    turnovers: roundSummary(agg.turnovers),
    fouls: roundSummary(agg.fouls),
    freeThrowAttempts: roundSummary(agg.freeThrowAttempts),
    assistToFgmRatio: roundSummary(agg.assistToFgmRatio),
    pooledShooting: {
      fieldGoalsMade: agg.pooledShooting.fieldGoalsMade,
      fieldGoalsAttempted: agg.pooledShooting.fieldGoalsAttempted,
      fieldGoalPct: roundNullable(agg.pooledShooting.fieldGoalPct),
      threePointersMade: agg.pooledShooting.threePointersMade,
      threePointersAttempted: agg.pooledShooting.threePointersAttempted,
      threePointPct: roundNullable(agg.pooledShooting.threePointPct),
      freeThrowsMade: agg.pooledShooting.freeThrowsMade,
      freeThrowsAttempted: agg.pooledShooting.freeThrowsAttempted,
      freeThrowPct: roundNullable(agg.pooledShooting.freeThrowPct),
    },
    homeAway: {
      homeWinRate: roundNullable(agg.homeAway.homeWinRate),
      homeWins: agg.homeAway.homeWins,
      awayWins: agg.homeAway.awayWins,
      homePoints: roundSummary(agg.homeAway.homePoints),
      awayPoints: roundSummary(agg.homeAway.awayPoints),
      homeFieldGoalPct: roundSummary(agg.homeAway.homeFieldGoalPct),
      awayFieldGoalPct: roundSummary(agg.homeAway.awayFieldGoalPct),
      homeThreePointPct: roundSummary(agg.homeAway.homeThreePointPct),
      awayThreePointPct: roundSummary(agg.homeAway.awayThreePointPct),
      homeTurnovers: roundSummary(agg.homeAway.homeTurnovers),
      awayTurnovers: roundSummary(agg.homeAway.awayTurnovers),
    },
  };
}

function roundSummary(summary: MetricSummary): MetricSummary {
  return {
    n: summary.n,
    mean: round6(summary.mean),
    median: round6(summary.median),
    min: round6(summary.min),
    max: round6(summary.max),
    stdev: round6(summary.stdev),
  };
}

function roundNullable(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return round6(value);
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
  );
  return `{${entries
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
    .join(",")}}`;
}

function fnv1aHex(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
