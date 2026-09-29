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
  type LongitudinalPoint,
  type LabSeasonResult,
} from "@/simulation/lab/run-lab-season";
export {
  LAB_LEAGUE_PRESETS,
  isLabLeaguePreset,
  settingsForLabPreset,
  labPresetScheduleLabel,
  type LabLeaguePreset,
} from "@/simulation/lab/lab-league-preset";
export {
  LAB_DEFAULT_SCHEDULE_MAX_DAYS,
  runLabSchedule,
  type LabScheduleUntil,
  type LabScheduleResult,
  type RunLabScheduleOptions,
} from "@/simulation/lab/run-lab-schedule";
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
export {
  LAB_MAX_GAMES,
  LAB_MAX_SCHEDULE_DAYS,
  LAB_MAX_SEASONS_CBL,
  LAB_MAX_SEASONS_STANDARD,
} from "@/simulation/lab/lab-limits";
export { createLabScheduledGame } from "@/simulation/lab/create-lab-game";
