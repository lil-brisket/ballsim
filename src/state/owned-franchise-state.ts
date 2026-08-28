/**
 * Factory for OwnedFranchiseState — used by create-initial-state, migration, takeover.
 */

import { DEFAULT_DELEGATED_ASSISTANCE } from "@/domain/ai-management-delegation";
import {
  DEFAULT_AI_MANAGEMENT_PRESET,
  type AiAssistancePhases,
  type AiManagementPreset,
} from "@/domain/ai-management-presets";
import { createDefaultOwnershipConfidence } from "@/domain/entities/ownership-confidence";
import { defaultOwnerPatience } from "@/systems/owner-philosophy-config";
import {
  EMPTY_AI_ASSIST_STATE,
  type OwnedFranchiseState,
} from "@/state/game-state";

export type CreateOwnedFranchiseStateInput = {
  seasonYear: number;
  currentDate: string;
  ownerPatience?: number;
  citySelectionConfirmed?: boolean;
  franchiseIdentityConfirmed?: boolean;
  aiAssistance?: AiAssistancePhases;
  managementPreset?: AiManagementPreset;
};

export function createDefaultOwnedFranchiseState(
  input: CreateOwnedFranchiseStateInput,
): OwnedFranchiseState {
  return {
    ownerPatience: input.ownerPatience ?? defaultOwnerPatience(),
    ownershipConfidence: createDefaultOwnershipConfidence(input.currentDate),
    objectives: [],
    narrative: { situations: [], snapshots: [], cooldowns: {} },
    notifications: [],
    eventLog: [],
    appliedGameplayConsequenceKeys: {},
    explicitDecisions: {},
    phaseSkips: [],
    aiAssistance: input.aiAssistance
      ? { ...input.aiAssistance }
      : { ...DEFAULT_DELEGATED_ASSISTANCE },
    managementPreset:
      input.managementPreset ?? DEFAULT_AI_MANAGEMENT_PRESET,
    aiAssistState: {
      resolvedNeeds: {},
      seasonCounters: { ...EMPTY_AI_ASSIST_STATE.seasonCounters },
    },
    citySelectionConfirmed: input.citySelectionConfirmed ?? false,
    franchiseIdentityConfirmed: input.franchiseIdentityConfirmed ?? false,
    ownerStartSeasonYear: input.seasonYear,
  };
}
