export type {
  CompetitiveTier,
  CorrelationPair,
  HistogramBin,
  MetricSummary,
  MetricSummaryWithPercentiles,
  RelationshipExpectation,
} from "@/simulation/analytics/types";

export {
  championshipConcentration,
  distributionHistogram,
  herfindahlHirschmanIndex,
  meanYoYInflation,
  percentile,
  summarizeMetric,
  summarizeWithPercentiles,
} from "@/simulation/analytics/summarize";

export {
  evaluateRelationship,
  laggedPearson,
  makeCorrelationPair,
  pearsonCorrelation,
} from "@/simulation/analytics/correlations";

export {
  assignCompetitiveTier,
  computeCompetitiveMobility,
  computeValueMobility,
} from "@/simulation/analytics/mobility";
export type {
  CompetitiveMobilityReport,
  TierTransition,
  ValueMobilityReport,
} from "@/simulation/analytics/mobility";

export {
  fnv1aHex,
  hashPayload,
  round6,
  stableStringify,
} from "@/simulation/analytics/hash";
