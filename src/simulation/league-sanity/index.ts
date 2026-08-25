export type {
  LeagueSanityConfig,
  LeagueSanityReportMetadata,
  LeagueSanityTeamSeasonSnapshot,
  LeagueSanityWarning,
  TenureMetrics,
} from "@/simulation/league-sanity/types";

export {
  DEFAULT_SANITY_RELATIONSHIPS,
  SANITY_WARNING_THRESHOLDS,
} from "@/simulation/league-sanity/config";

export { collectLeagueSanitySnapshots } from "@/simulation/league-sanity/collect";

export {
  runLeagueCareer,
  runLeagueSanityBatch,
  type LeagueCareerResult,
  type RunLeagueCareerOptions,
  type RunLeagueSanityBatchOptions,
} from "@/simulation/league-sanity/run-league-career";

export {
  aggregateLeagueSanitySnapshots,
  type LeagueSanityAggregates,
  type TenureAggregate,
} from "@/simulation/league-sanity/aggregate";

export {
  computeLeagueSanityCorrelations,
  type RelationshipResult,
} from "@/simulation/league-sanity/correlations";

export {
  evaluateCausalChains,
  type CausalChainCheck,
} from "@/simulation/league-sanity/causal-chains";

export { evaluateSanityWarnings } from "@/simulation/league-sanity/warnings";

export {
  buildLeagueSanityReport,
  formatLeagueSanityReport,
  type BuildLeagueSanityReportOptions,
  type LeagueSanityReport,
} from "@/simulation/league-sanity/report";

export {
  compareLeagueSanityReports,
  type SanityCompareResult,
  type SanityDiffRow,
} from "@/simulation/league-sanity/compare";
