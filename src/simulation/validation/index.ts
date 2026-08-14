export type {
  CheckResult,
  CorrelationResult,
  GameSnapshot,
  InvariantFailure,
  MatchupDiagnosticResult,
  MetricSummary,
  TeamGameSnapshot,
  ValidationAggregates,
  ValidationRunResult,
  ValidationVerdict,
} from "@/simulation/validation/types";

export { collectGameSnapshot } from "@/simulation/validation/collect-game-stats";
export { aggregateSnapshots, summarizeMetric } from "@/simulation/validation/aggregate";
export {
  checkGameInvariants,
  checkTeamSnapshotInvariants,
} from "@/simulation/validation/invariants";
export {
  combineVerdicts,
  evaluatePlausibility,
} from "@/simulation/validation/plausibility";
export { computeValidationChecksum } from "@/simulation/validation/checksum";
export {
  evaluatePlayerCorrelations,
  pearsonCorrelation,
} from "@/simulation/validation/correlations";
export { formatValidationReport } from "@/simulation/validation/report";
export { buildMatchupRosters } from "@/simulation/validation/matchup-rosters";
export {
  generateValidationRosters,
  runMatchupDiagnostic,
  runSimulationValidation,
  type RunValidationOptions,
} from "@/simulation/validation/run-validation";
