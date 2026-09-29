export type {
  EngineIdentity,
  FormatLabReportOptions,
  InvariantSeverity,
  LabFailure,
  LabFailureContext,
  LabReport,
  LabRotationMode,
  LabScenarioBuilder,
  LabScope,
  RawInvariantFailure,
  SimChannel,
} from "@/simulation/lab/types";

export { formatReproCommand } from "@/simulation/lab/repro";
export { readEngineIdentity } from "@/simulation/lab/engine-identity";
export { toLabFailure } from "@/simulation/lab/map-failure";
export {
  collectRawGameFailures,
  parseThrownInvariantError,
  overtimeHighFailure,
  LAB_OT_PERIODS_HIGH_THRESHOLD,
} from "@/simulation/lab/collect-game-failures";
export { formatLabReport, labExitCode } from "@/simulation/lab/report";
export {
  runLabGames,
  type RunLabGamesOptions,
} from "@/simulation/lab/run-lab-games";
export {
  runLabSeason,
  type RunLabSeasonOptions,
} from "@/simulation/lab/run-lab-season";
export {
  HARD_GAME_RULE_IDS,
  INVARIANT_REGISTRY,
  lookupInvariant,
} from "@/simulation/lab/invariant-registry";
export {
  LAB_SCENARIO_IDS,
  getScenarioBuilder,
  isLabScenarioId,
} from "@/simulation/lab/scenarios";
export { LAB_FINANCIAL_EXTREME_IDS } from "@/simulation/lab/scenarios/financial-extremes";
export { evaluateGraduation } from "@/simulation/lab/graduation";
export {
  loadRegressionCases,
  runRegressionCases,
  defaultRegressionDir,
} from "@/simulation/lab/regression/run-regression-cases";
export { createLabScheduledGame } from "@/simulation/lab/create-lab-game";
