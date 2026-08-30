/**
 * Public exports for the rotation / substitution system.
 */

export { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";
export {
  ROLE_TEMPLATES,
  inferRoleFromLegacy,
  philosophyMinuteSkew,
  applyTemplateToMinutes,
} from "@/systems/rotation/rotation-role-templates";
export {
  validateRotationFeasibility,
  availablePlayerMinutesForGame,
  hasHardFeasibilityIssues,
  formatFeasibilityBanner,
} from "@/systems/rotation/rotation-feasibility";
export type {
  RotationFeasibilityResult,
  RotationFeasibilityIssue,
} from "@/systems/rotation/rotation-feasibility";
export { buildRotationPlan, isPlayerInActivePool } from "@/systems/rotation/rotation-planner";
export type {
  RotationPlan,
  StaggerWindow,
  OvertimeRotationContext,
} from "@/systems/rotation/rotation-planner";
export {
  evaluateSubstitutions,
  defaultSlotsForLineup,
  buildRotationMap,
} from "@/systems/rotation/substitution-engine";
export type {
  SubstitutionCheckpoint,
  SubstitutionDecision,
  SubstitutionEngineResult,
  SubstitutionEngineInput,
} from "@/systems/rotation/substitution-engine";
export {
  validateLineup,
  scoreLineupViability,
  preferredPositionsFor,
  allPositionsFor,
  playerCanCoverSlot,
} from "@/systems/rotation/lineup-validation";
export {
  computeFatigue,
  restReducesFatigue,
  isFatiguedForSubstitution,
} from "@/systems/rotation/rotation-fatigue";
export {
  foulTroubleLevel,
  foulTroubleSitScore,
  isFouledOut,
} from "@/systems/rotation/rotation-foul-trouble";
export type { FoulTroubleLevel } from "@/systems/rotation/rotation-foul-trouble";
export {
  buildRotationGameContext,
  isInRotationWindow,
} from "@/systems/rotation/rotation-game-context";
export type {
  RotationGameContext,
  GameSituation,
} from "@/systems/rotation/rotation-game-context";
export {
  minutesDeficit,
  effectiveMaximum,
  minuteBalanceInScore,
  minuteBalanceOutScore,
} from "@/systems/rotation/minute-balancing";
export {
  buildMinuteExplanations,
  reasonLabel,
} from "@/systems/rotation/rotation-explanations";
export type { MinuteExplanationReason } from "@/systems/rotation/rotation-explanations";
export {
  createEmptyRotationTrace,
  appendTraceEntry,
  formatTraceEntry,
  formatTraceClock,
} from "@/systems/rotation/rotation-trace";
export type {
  RotationTraceEntry,
  RotationTraceReason,
} from "@/systems/rotation/rotation-trace";
export {
  expectedTeamPlayerSeconds,
  validateTeamSecondsOnCourt,
  assertTeamSecondsOnCourt,
} from "@/systems/rotation/rotation-invariants";
export type { MinuteAccountingFailure } from "@/systems/rotation/rotation-invariants";
export { migrateLegacyRotationEntry } from "@/systems/rotation/migrate-rotation-entry";
export type { LegacyRotationEntryV46 } from "@/systems/rotation/migrate-rotation-entry";
export {
  initializeRotationForSim,
  runSubstitutionCheckpoint,
  maybeRunRotationWindow,
  finalizeRotationExplanations,
  handleMidGameInjury,
} from "@/systems/rotation/sim-bridge";
export { deriveRotationConstraints, rederiveRotationEntry } from "@/systems/rotation/derive-rotation-constraints";
export { analyzeRotationHealth, desiredRotationSizeForTeam } from "@/systems/rotation/rotation-health";
export { redistributeRotationForInjuries, redistributeLiveMinutesAfterInjury } from "@/systems/rotation/rotation-injury-response";
export { projectRotationByQuarter } from "@/systems/rotation/rotation-quarter-projection";
