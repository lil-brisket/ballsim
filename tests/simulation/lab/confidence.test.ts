import { describe, expect, it } from "vitest";
import {
  gamesNeededForEffectSize,
  meanCi95,
  Z_95,
  Z_POWER_80,
} from "@/simulation/lab/confidence";
import { summarizeMetric } from "@/simulation/validation/aggregate";
import { computeValidationChecksum } from "@/simulation/validation/checksum";
import type { ValidationAggregates } from "@/simulation/validation/types";

describe("meanCi95", () => {
  it("returns the Wald interval for known [1, 2, 3]", () => {
    const summary = summarizeMetric([1, 2, 3]);
    expect(summary.n).toBe(3);
    expect(summary.mean).toBe(2);
    const expectedSe = summary.stdev / Math.sqrt(2);
    const expected = meanCi95(summary.mean, summary.stdev, summary.n);
    expect(expected).not.toBeNull();
    expect(summary.ci95Low).toBeCloseTo(2 - Z_95 * expectedSe, 12);
    expect(summary.ci95High).toBeCloseTo(2 + Z_95 * expectedSe, 12);
    expect(summary.ci95Low).toBe(expected!.low);
    expect(summary.ci95High).toBe(expected!.high);
  });

  it("returns null when n < 2", () => {
    expect(meanCi95(10, 1, 1)).toBeNull();
    expect(meanCi95(10, 1, 0)).toBeNull();
    expect(summarizeMetric([4]).ci95Low).toBeNull();
    expect(summarizeMetric([4]).ci95High).toBeNull();
    expect(summarizeMetric([]).ci95Low).toBeNull();
  });

  it("returns null for non-finite inputs", () => {
    expect(meanCi95(Number.NaN, 1, 4)).toBeNull();
    expect(meanCi95(1, Number.POSITIVE_INFINITY, 4)).toBeNull();
  });
});

describe("gamesNeededForEffectSize", () => {
  const zSum = Z_95 + Z_POWER_80;

  it("matches ceil((z_α/2 + z_β)^2 / d^2) for one-sample d=0.5", () => {
    const expected = Math.ceil((zSum * zSum) / (0.5 * 0.5));
    expect(gamesNeededForEffectSize(0.5, { twoSample: false })).toBe(expected);
    expect(expected).toBe(32);
  });

  it("doubles the one-sample n for two-sample d=0.2 (default)", () => {
    const oneSample = Math.ceil((zSum * zSum) / (0.2 * 0.2));
    const twoSample = Math.ceil((2 * (zSum * zSum)) / (0.2 * 0.2));
    expect(gamesNeededForEffectSize(0.2, { twoSample: false })).toBe(oneSample);
    expect(gamesNeededForEffectSize(0.2)).toBe(twoSample);
    expect(twoSample).toBe(393);
  });

  it("rejects non-positive d and unsupported alpha/power", () => {
    expect(() => gamesNeededForEffectSize(0)).toThrow(/positive finite/);
    expect(() => gamesNeededForEffectSize(-0.2)).toThrow(/positive finite/);
    expect(() => gamesNeededForEffectSize(0.3, { alpha: 0.01 })).toThrow(
      /alpha=0.05/,
    );
  });
});

describe("checksum ignores CI fields", () => {
  it("does not change when ci95 bounds are rewritten", () => {
    const summary = summarizeMetric([10, 12, 14, 16]);
    const aggregates = stubAggregates(summary);
    const base = computeValidationChecksum({
      seed: 1,
      gamesSimulated: 2,
      aggregates,
      invariantFailureCount: 0,
      plausibilityChecks: [],
      correlations: [],
      overallVerdict: "PASS",
    });
    const mutated = structuredClone(aggregates);
    mutated.teamPoints.ci95Low = 0;
    mutated.teamPoints.ci95High = 999;
    mutated.gameTotals.ci95Low = -1;
    mutated.gameTotals.ci95High = -1;
    const again = computeValidationChecksum({
      seed: 1,
      gamesSimulated: 2,
      aggregates: mutated,
      invariantFailureCount: 0,
      plausibilityChecks: [],
      correlations: [],
      overallVerdict: "PASS",
    });
    expect(again).toBe(base);
  });
});

function stubAggregates(
  summary: ReturnType<typeof summarizeMetric>,
): ValidationAggregates {
  const zero = summarizeMetric([]);
  return {
    gamesSimulated: 2,
    seed: 1,
    teamPoints: summary,
    gameTotals: summary,
    absoluteDifferentials: zero,
    possessionsPerTeam: zero,
    pointsPerPossession: zero,
    fieldGoalPct: zero,
    threePointPct: zero,
    freeThrowPct: zero,
    offensiveRebounds: zero,
    defensiveRebounds: zero,
    totalRebounds: zero,
    assists: zero,
    turnovers: zero,
    fouls: zero,
    freeThrowAttempts: zero,
    assistToFgmRatio: zero,
    pooledShooting: {
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      fieldGoalPct: null,
      threePointersMade: 0,
      threePointersAttempted: 0,
      threePointPct: null,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      freeThrowPct: null,
    },
    homeAway: {
      homeWinRate: 0,
      homeWins: 0,
      awayWins: 0,
      homePoints: zero,
      awayPoints: zero,
      homeFieldGoalPct: zero,
      awayFieldGoalPct: zero,
      homeThreePointPct: zero,
      awayThreePointPct: zero,
      homeTurnovers: zero,
      awayTurnovers: zero,
    },
  };
}
