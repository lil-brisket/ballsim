/**
 * Shared statistical types for simulation analytics (league sanity + validation).
 */

export type MetricSummary = {
  n: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdev: number;
};

export type MetricSummaryWithPercentiles = MetricSummary & {
  p10: number;
  p25: number;
  p75: number;
  p90: number;
};

export type HistogramBin = {
  /** Inclusive lower bound. */
  low: number;
  /** Exclusive upper bound (inclusive for last bin). */
  high: number;
  count: number;
  share: number;
};

export type CorrelationPair = {
  name: string;
  x: string;
  y: string;
  r: number | null;
  n: number;
  lag: number;
};

export type RelationshipExpectation =
  | { kind: "directional_positive"; minR?: number }
  | { kind: "directional_negative"; maxR?: number }
  | { kind: "weak_positive"; minR?: number; maxR?: number }
  | { kind: "context_dependent"; note: string };

export type CompetitiveTier =
  | "bottom_quartile"
  | "middle"
  | "playoff"
  | "contender"
  | "champion";
