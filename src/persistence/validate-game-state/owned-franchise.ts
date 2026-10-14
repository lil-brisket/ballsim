import {
  OWNER_PATIENCE_MIN,
  OWNER_PATIENCE_MAX,
} from "@/domain/entities/owner-philosophy";
import type { OwnershipConfidenceState } from "@/domain/entities/ownership-confidence";
import { parseCalendarDate } from "@/domain/calendar-date";
import {
  isAiManagementPreset,
  MANAGEMENT_PHASE_KEYS,
} from "@/domain/ai-management-presets";
import {
  assertNumber,
  assertNonEmptyString,
} from "@/persistence/validate-game-state/primitives";
import {
  validateOwnershipConfidence,
  validateOwnerObjectives,
  validateOwnerNotifications,
} from "@/persistence/validate-game-state/ownership";
import { validateEventLog } from "@/persistence/validate-game-state/competition";
import { validateNarrativeState } from "@/persistence/validate-game-state/narrative";

export function validateOwnedFranchiseState(
  value: unknown,
  path: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const franchise = value as Record<string, unknown>;

  assertNumber(franchise.ownerStartSeasonYear, `${path}.ownerStartSeasonYear`);
  if (
    !Number.isFinite(franchise.ownerStartSeasonYear as number) ||
    !Number.isInteger(franchise.ownerStartSeasonYear as number)
  ) {
    failFn(`${path}.ownerStartSeasonYear must be a finite integer.`);
  }
  assertNumber(franchise.ownerPatience, `${path}.ownerPatience`);
  if (
    !Number.isInteger(franchise.ownerPatience as number) ||
    (franchise.ownerPatience as number) < OWNER_PATIENCE_MIN ||
    (franchise.ownerPatience as number) > OWNER_PATIENCE_MAX
  ) {
    failFn(
      `${path}.ownerPatience must be an integer between ${OWNER_PATIENCE_MIN} and ${OWNER_PATIENCE_MAX}.`,
    );
  }
  if (
    franchise.ownershipConfidence == null ||
    typeof franchise.ownershipConfidence !== "object"
  ) {
    failFn(`${path}.ownershipConfidence is required.`);
  }
  validateOwnershipConfidence(
    franchise.ownershipConfidence as OwnershipConfidenceState,
  );

  if (!Array.isArray(franchise.objectives)) {
    failFn(`${path}.objectives must be an array.`);
  }
  validateOwnerObjectives(franchise.objectives);

  if (!Array.isArray(franchise.notifications)) {
    failFn(`${path}.notifications must be an array.`);
  }
  validateOwnerNotifications(franchise.notifications);

  if (!Array.isArray(franchise.eventLog)) {
    failFn(`${path}.eventLog must be an array.`);
  }
  validateEventLog(franchise.eventLog);

  if (
    franchise.mediaFeed == null ||
    typeof franchise.mediaFeed !== "object" ||
    Array.isArray(franchise.mediaFeed)
  ) {
    failFn(`${path}.mediaFeed must be an object.`);
  }
  if (!Array.isArray((franchise.mediaFeed as { items?: unknown }).items)) {
    failFn(`${path}.mediaFeed.items must be an array.`);
  }

  if (
    franchise.socialFeed == null ||
    typeof franchise.socialFeed !== "object" ||
    Array.isArray(franchise.socialFeed)
  ) {
    failFn(`${path}.socialFeed must be an object.`);
  }
  if (!Array.isArray((franchise.socialFeed as { posts?: unknown }).posts)) {
    failFn(`${path}.socialFeed.posts must be an array.`);
  }

  if (
    franchise.mediaReadState == null ||
    typeof franchise.mediaReadState !== "object" ||
    Array.isArray(franchise.mediaReadState)
  ) {
    failFn(`${path}.mediaReadState must be a record.`);
  }

  if (
    franchise.appliedGameplayConsequenceKeys == null ||
    typeof franchise.appliedGameplayConsequenceKeys !== "object" ||
    Array.isArray(franchise.appliedGameplayConsequenceKeys)
  ) {
    failFn(`${path}.appliedGameplayConsequenceKeys must be a record.`);
  }
  for (const [key, val] of Object.entries(
    franchise.appliedGameplayConsequenceKeys as Record<string, unknown>,
  )) {
    if (key.trim().length === 0) {
      failFn(`${path}.appliedGameplayConsequenceKeys keys must be non-empty.`);
    }
    if (val !== true) {
      failFn(`${path}.appliedGameplayConsequenceKeys["${key}"] must be true.`);
    }
  }

  if (
    franchise.explicitDecisions == null ||
    typeof franchise.explicitDecisions !== "object" ||
    Array.isArray(franchise.explicitDecisions)
  ) {
    failFn(`${path}.explicitDecisions must be a record.`);
  }
  for (const [key, val] of Object.entries(
    franchise.explicitDecisions as Record<string, unknown>,
  )) {
    if (key.trim().length === 0) {
      failFn(`${path}.explicitDecisions keys must be non-empty.`);
    }
    if (val !== true) {
      failFn(`${path}.explicitDecisions["${key}"] must be true.`);
    }
  }

  if (!Array.isArray(franchise.phaseSkips)) {
    failFn(`${path}.phaseSkips must be an array.`);
  }
  for (
    let index = 0;
    index < (franchise.phaseSkips as unknown[]).length;
    index += 1
  ) {
    const entry = (franchise.phaseSkips as unknown[])[index];
    const skipPath = `${path}.phaseSkips[${index}]`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      failFn(`${skipPath} must be an object.`);
      continue;
    }
    const skip = entry as Record<string, unknown>;
    assertNonEmptyString(skip.phaseKey, `${skipPath}.phaseKey`);
    assertNonEmptyString(skip.skippedOn, `${skipPath}.skippedOn`);
    parseCalendarDate(skip.skippedOn as string);
    assertNonEmptyString(skip.reason, `${skipPath}.reason`);
  }

  if (
    franchise.aiAssistState == null ||
    typeof franchise.aiAssistState !== "object" ||
    Array.isArray(franchise.aiAssistState)
  ) {
    failFn(`${path}.aiAssistState must be an object.`);
  } else {
    const assist = franchise.aiAssistState as Record<string, unknown>;
    if (
      assist.resolvedNeeds == null ||
      typeof assist.resolvedNeeds !== "object" ||
      Array.isArray(assist.resolvedNeeds)
    ) {
      failFn(`${path}.aiAssistState.resolvedNeeds must be a record.`);
    }
    if (
      assist.seasonCounters == null ||
      typeof assist.seasonCounters !== "object" ||
      Array.isArray(assist.seasonCounters)
    ) {
      failFn(`${path}.aiAssistState.seasonCounters must be an object.`);
    } else {
      const counters = assist.seasonCounters as Record<string, unknown>;
      assertNumber(
        counters.seasonYear,
        `${path}.aiAssistState.seasonCounters.seasonYear`,
      );
      assertNumber(
        counters.decisions,
        `${path}.aiAssistState.seasonCounters.decisions`,
      );
      assertNumber(
        counters.rosterMoves,
        `${path}.aiAssistState.seasonCounters.rosterMoves`,
      );
      assertNumber(
        counters.freeAgentSignings,
        `${path}.aiAssistState.seasonCounters.freeAgentSignings`,
      );
    }
  }

  if (
    typeof franchise.managementPreset !== "string" ||
    !isAiManagementPreset(franchise.managementPreset)
  ) {
    failFn(`${path}.managementPreset must be a valid AI management preset.`);
  }
  if (
    franchise.aiAssistance == null ||
    typeof franchise.aiAssistance !== "object" ||
    Array.isArray(franchise.aiAssistance)
  ) {
    failFn(`${path}.aiAssistance must be an object.`);
  } else {
    const assistance = franchise.aiAssistance as Record<string, unknown>;
    for (const key of MANAGEMENT_PHASE_KEYS) {
      if (!(key in assistance)) {
        failFn(`${path}.aiAssistance.${key} is required.`);
      }
    }
  }

  if (franchise.narrative == null) {
    failFn(`${path}.narrative is required.`);
  }
  validateNarrativeState(franchise.narrative);

  if (typeof franchise.citySelectionConfirmed !== "boolean") {
    failFn(`${path}.citySelectionConfirmed must be a boolean.`);
  }
  if (typeof franchise.franchiseIdentityConfirmed !== "boolean") {
    failFn(`${path}.franchiseIdentityConfirmed must be a boolean.`);
  }
}
