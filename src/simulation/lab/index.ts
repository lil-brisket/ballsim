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

export { ENGINE_VERSION } from "@/simulation/lab/engine-version";
export { readEngineIdentity } from "@/simulation/lab/engine-identity";
export { formatReproCommand } from "@/simulation/lab/repro";
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
export { runLabGamesAsync } from "@/simulation/lab/run-lab-games-async";
export {
  LabRunInterruptedError,
  type LabRunInterruptReason,
} from "@/simulation/lab/interrupted-error";
export {
  LAB_CHECKPOINT_FILENAME,
  loadLabCheckpoint,
  writeLabCheckpoint,
  labCheckpointPath,
  type LabRunCheckpoint,
} from "@/simulation/lab/checkpoint";
export {
  LAB_DEFAULT_JOBS,
  LAB_DEFAULT_CHUNK_SIZE,
  chunkIndexes,
  remainingGameIndexes,
} from "@/simulation/lab/chunk-indexes";
export {
  runLabSeason,
  type RunLabSeasonOptions,
  type LongitudinalPoint,
  type LabSeasonResult,
} from "@/simulation/lab/run-lab-season";
export {
  runLabGamesFromManifest,
  runLabSeasonFromManifest,
  runLabScheduleFromManifest,
} from "@/simulation/lab/run-from-manifest";
export {
  compareEngineVersions,
  compareLabManifests,
  compareLabPayloads,
  loadLabManifest,
  DEFAULT_LAB_RESULTS_ROOT,
  type LabRunManifest,
  type LabResolvedConfig,
  type LabPersistOptions,
} from "@/simulation/lab/manifest";
export {
  buildGameModeSeedList,
  labGameSeed,
  labRosterSeed,
  type LabSeedListEntry,
} from "@/simulation/lab/lab-seeds";
export {
  OWNER_CAREER_SCENARIO_ID,
  SCHEDULE_SCENARIO_ID,
  scenarioVersionFor,
  compareScenarioVersions,
} from "@/simulation/lab/scenario-version";
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
export {
  checkInvariants,
  type LabInvariantState,
} from "@/simulation/lab/check-invariants";
export {
  replayLabGame,
  type LabReplayResult,
} from "@/simulation/lab/replay-lab-game";
export {
  diffEventLogs,
  parseEventNdjson,
} from "@/simulation/lab/event-log-diff";
export {
  writeGameFailureArtifacts,
  type LabGameFailureRecord,
} from "@/simulation/lab/failure-artifacts";
export {
  meanCi95,
  gamesNeededForEffectSize,
  powerEstimatesForKeyMetrics,
  Z_95,
  type LabPowerEstimate,
} from "@/simulation/lab/confidence";
export {
  appendGameNdjsonRow,
  parseGamesNdjson,
  labGamesNdjsonPath,
  LAB_GAMES_NDJSON_FILENAME,
  type LabGameNdjsonRow,
} from "@/simulation/lab/games-ndjson";
export {
  runLabSweep,
  loadSweepSpace,
  parseSweepSpace,
  sampleSweepSpace,
  latinHypercubeUnits,
  sobolUnits,
  spearmanRho,
  rankSensitivity,
  formatSweepReport,
  LAB_DEFAULT_SWEEP_SPACE,
  LAB_DEFAULT_SWEEP_SAMPLES,
  isLabSweepSampler,
  type LabSweepSampler,
  type LabSweepSpace,
  type SweepResult,
} from "@/simulation/lab/sweep";
export {
  ksTwoSample,
  ksVerdict,
  LAB_DEFAULT_KS_ALPHA,
} from "@/simulation/lab/ks";
export {
  CALIBRATION_BANDS,
  evaluateCalibration,
} from "@/simulation/lab/calibration";
export {
  loadLabGoldenBaseline,
  writeLabGoldenBaseline,
  compareLabGoldenBaseline,
  buildLabGoldenBaseline,
  type LabGoldenBaseline,
} from "@/simulation/lab/golden-baseline";
export {
  parseLabArgv,
  parseLabFileConfig,
  loadLabConfigFile,
  mergeLabConfig,
  LAB_CLI_DEFAULTS,
  LAB_CLI_USAGE,
  type LabFileConfig,
  type LabCliState,
} from "@/simulation/lab/lab-config";
export {
  listLabScenarios,
  formatLabScenarioList,
  type LabScenarioListing,
} from "@/simulation/lab/list-scenarios";
export {
  previewLabGamesRun,
  previewLabSeasonRun,
  previewLabScheduleRun,
  formatDryRunPreview,
  LAB_DRY_RUN_SEED_PREVIEW,
  type LabDryRunPreview,
} from "@/simulation/lab/dry-run";
export {
  loadLabRunIndex,
  appendLabIndexEntry,
  labIndexPath,
  LAB_INDEX_FILENAME,
  type LabIndexEntry,
  type LabRunIndex,
} from "@/simulation/lab/run-index";
export { pruneLabRuns, assertLabKeep } from "@/simulation/lab/retention";
