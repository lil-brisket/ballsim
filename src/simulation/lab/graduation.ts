import type { MetricSummary } from "@/simulation/validation/types";

export type GraduationStatus = "monitor" | "warning-eligible" | "blocked";

export type GraduationInput = {
  baselineMedian: number;
  nightlyValues: readonly number[];
  /** Minimum nightly runs required. Plan: 5. */
  minRuns?: number;
  /** MAD multiplier. Plan: 3. */
  madMultiplier?: number;
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    return 0;
  }
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function mad(values: readonly number[], center: number): number {
  const deviations = values.map((value) => Math.abs(value - center));
  return median(deviations);
}

/**
 * A metric may move from monitor-only to WARNING once a committed baseline
 * exists and at least N nightly runs fall inside ±k×MAD of the baseline median.
 * HARD promotion is not performed here — that requires a design-identity rationale.
 */
export function evaluateGraduation(input: GraduationInput): {
  status: GraduationStatus;
  insideBand: number;
  bandLow: number;
  bandHigh: number;
} {
  const minRuns = input.minRuns ?? 5;
  const k = input.madMultiplier ?? 3;
  if (input.nightlyValues.length < minRuns) {
    return {
      status: "monitor",
      insideBand: 0,
      bandLow: input.baselineMedian,
      bandHigh: input.baselineMedian,
    };
  }
  const spread = mad(input.nightlyValues, input.baselineMedian);
  const width = Math.max(spread * k, Number.EPSILON);
  const bandLow = input.baselineMedian - width;
  const bandHigh = input.baselineMedian + width;
  const insideBand = input.nightlyValues.filter(
    (value) => value >= bandLow && value <= bandHigh,
  ).length;
  return {
    status: insideBand >= minRuns ? "warning-eligible" : "blocked",
    insideBand,
    bandLow,
    bandHigh,
  };
}

export function metricMedian(summary: MetricSummary): number {
  return summary.median;
}
