/**
 * Centralized injury domain.
 * Mutations: import from injury-service only.
 * Reads: effects / status / catalog helpers are safe to import.
 */

export {
  processExposureEvent,
  tickDailyRecovery,
  applyAggravation,
  archiveResolvedInjuries,
  applyInjuryToPlayer,
  applyInjuryFromSeverity,
  applySuspension,
  clearInjury,
  clearSuspension,
  getEffectiveAttributes,
  getEffectivePlayerValue,
  getInjuryEffects,
  getWorkloadRestrictions,
  developmentOpportunityFactor,
  resolvePlayerAvailabilityFromState,
  aggregateAvailabilityFromInjuries,
} from "@/systems/injury/injury-service";

export type { ApplyInjuryInput } from "@/systems/injury/injury-service";
export type { InjuryServiceResult } from "@/systems/injury/injury-service";

export {
  INJURY_CATALOG,
  getInjuryDefinition,
  listInjuryDefinitionsForExposure,
  pickSeverity,
  workloadDefaultsForSeverity,
} from "@/systems/injury/injury-catalog";

export {
  createGameAcuteExposure,
  createGameOveruseExposure,
  createPracticeExposure,
  createOffseasonTrainingExposure,
  createOffCourtExposure,
} from "@/systems/injury/injury-exposure";
export type { InjuryExposureEvent } from "@/systems/injury/injury-exposure";

export {
  advanceInjuryRecovery,
  advanceInjuryRecoveryAfterGame,
  tickInjuryDailyRecovery,
  maybeFullyClearInjury,
  buildExpectedReturnWindow,
} from "@/systems/injury/injury-recovery";

export {
  deriveStatusFromInjury,
  mostRestrictivePractice,
} from "@/systems/injury/injury-status";

export { computeInjuryProbability } from "@/systems/injury/injury-occurrence";

export {
  SEVERITY_DEFAULTS,
  advanceAvailabilityFromRecovery,
} from "@/systems/injury/injury-lifecycle";

export {
  computeReturnToPlayBaseline,
  computeReturnToPlayTargetMinutes,
  rankPlayerForAiMinutes,
} from "@/systems/injury/injury-ai-response";

export { processPostGameInjuryExposures } from "@/systems/injury/injury-post-game";
