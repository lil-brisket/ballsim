export { transitionPhase, isValidPhaseTransition, VALID_PHASE_TRANSITIONS } from "@/systems/simulation/phase-machine";
export { runDailyPipeline } from "@/systems/simulation/daily-pipeline";
export {
  runWeeklyPipeline,
  completedWeekIdForSimulatedDate,
} from "@/systems/simulation/weekly-pipeline";
export {
  runMonthlyPipeline,
  completedMonthIdForSimulatedDate,
} from "@/systems/simulation/monthly-pipeline";
export { runOwnerGameplay } from "@/systems/simulation/owner-gameplay";
export {
  scheduleEvent,
  processScheduledEvents,
  registerScheduledEventHandler,
  getScheduledEventHandler,
} from "@/systems/simulation/scheduled-events";
export {
  processSeasonLifecycle,
  isRegularSeasonComplete,
  enterOffseasonFromPostseason,
} from "@/systems/simulation/season-lifecycle";
export {
  processOffseasonLifecycle,
  advanceOffseasonStage,
  initializeNewSeason,
} from "@/systems/simulation/offseason-lifecycle";
export { advanceSimulation } from "@/systems/simulation/advance-simulation";
export { SEASON_LIFECYCLE_CONFIG } from "@/systems/simulation/season-lifecycle-config";
export {
  getCalendarContext,
  lifecycleIdentity,
  areTradesOpen,
  resolveTradeDeadlineDate,
} from "@/systems/simulation/calendar-context";
export type {
  CalendarContext,
  SeasonSegment,
  PlayoffRaceStatus,
  OffseasonPriorityKey,
} from "@/systems/simulation/calendar-context";
export { CALENDAR_CONTEXT_CONFIG } from "@/systems/simulation/calendar-context-config";
export {
  resolveSimulationPhase,
  resolveSimulationPhaseKey,
} from "@/systems/simulation/simulation-phase";
export type {
  SimulationPhaseContext,
  SimulationPhaseKey,
} from "@/systems/simulation/simulation-phase";
export {
  resolveDomainAssistMode,
  isAiAssistEnabledForDomain,
} from "@/systems/simulation/ai-assist-settings";
export type { ResolvedAiAssistMode } from "@/systems/simulation/ai-assist-settings";
export {
  validateContinuityBoundary,
  assertContinuityBoundary,
} from "@/systems/simulation/continuity-validation";
export type { ContinuityValidationResult } from "@/systems/simulation/continuity-validation";
export { computePhaseResponsibility } from "@/systems/simulation/phase-responsibility";
export type {
  PhaseResponsibility,
  UnresolvedDecision,
} from "@/systems/simulation/phase-responsibility";
export { runAiContinuity } from "@/systems/simulation/ai-continuity";
export type { RunAiContinuityOptions } from "@/systems/simulation/ai-continuity";
export type {
  AdvanceSimulationResult,
  AdvanceSimulationOptions,
  SimulationProgress,
} from "@/systems/simulation/types";
export {
  createSimulationProfiler,
  formatGameCostModel,
  formatSeasonProfiler,
  averageGameCost,
} from "@/systems/simulation/simulation-profiler";
export type {
  GameSimCostModel,
  SeasonProfilerBuckets,
  SimulationProfiler,
} from "@/systems/simulation/simulation-profiler";
export type { OwnerGameplayResult } from "@/systems/simulation/owner-gameplay";
