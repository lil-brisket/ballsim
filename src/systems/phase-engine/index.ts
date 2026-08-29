export type {
  ActionPriority,
  AdvanceMode,
  AiPhaseRoutine,
  CompetitionPhaseState,
  DismissUntil,
  DismissedRecommendation,
  FranchisePhaseState,
  LeaguePhaseId,
  PhaseAdvancePreview,
  PhaseAdvanceSummary,
  PhaseAttentionSummary,
  PhaseFocus,
  PhaseStage,
  PhaseTask,
  ResolvedPhase,
} from "@/systems/phase-engine/phase-types";

export {
  LEAGUE_PHASE_IDS,
} from "@/systems/phase-engine/phase-types";

export {
  PHASE_DEFINITIONS,
  OFFSEASON_SEQUENCE,
  getPhaseDefinition,
  isLeaguePhaseId,
} from "@/systems/phase-engine/phase-definitions";
export type { PhaseDefinition } from "@/systems/phase-engine/phase-definitions";

export {
  getActivePhaseId,
  getCompetitionPhaseState,
  resolveCurrentPhase,
  isInLeaguePhase,
  isInAnyLeaguePhase,
  leaguePhaseIdFromLegacy,
  legacyOffseasonStageFromPhase,
  seasonPhaseFromLeaguePhase,
} from "@/systems/phase-engine/resolve-current-phase";

export {
  analyzeTeamPhaseContext,
} from "@/systems/phase-engine/team-context";
export type {
  TeamPhaseContext,
  PositionalStrength,
} from "@/systems/phase-engine/team-context";

export { evaluatePhaseFocus } from "@/systems/phase-engine/evaluate-phase-focus";

export {
  evaluatePhaseTasks,
  evaluatePhaseTasksForOwnedTeams,
  countPriority,
} from "@/systems/phase-engine/evaluate-phase-tasks";

export {
  setActivePhase,
  previewAdvance,
  canAdvancePhase,
  advancePhase,
  enterPhase,
} from "@/systems/phase-engine/phase-transitions";
export type { AdvancePhaseResult } from "@/systems/phase-engine/phase-transitions";

export {
  aiRoutinesForActivePhase,
  shouldRunAiRoutine,
  isFreeAgencyAiPhase,
  isDraftAiPhase,
  isTradeAiPhase,
  isStaffAiPhase,
  isScoutAiPhase,
  isContractAiPhase,
} from "@/systems/phase-engine/phase-ai-behavior";

export { tryAdvanceUserManagedPhase } from "@/systems/phase-engine/harness-advance";
