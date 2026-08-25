/**
 * Thin compatibility shim — prefer management-policy.ts.
 * @deprecated Use buildManagementPolicy / evaluateManagementAction.
 */

import type { GameSettings } from "@/domain/game-settings";
import {
  buildManagementPolicy,
  canAiExecute,
  evaluateManagementAction,
} from "@/systems/simulation/management-policy";
import type { ManagementActionId } from "@/systems/simulation/management-actions";

/** @deprecated Legacy domain keys mapped to representative actions. */
export type LegacyAssistDomain =
  | "freeAgency"
  | "draft"
  | "contracts"
  | "rosterFilling"
  | "rotations"
  | "staffHiring"
  | "trades"
  | "injuryReplacement";

const DOMAIN_TO_ACTION: Record<LegacyAssistDomain, ManagementActionId> = {
  freeAgency: "SIGN_EMERGENCY_FA",
  draft: "DRAFT_PICK",
  contracts: "EXTEND_MINIMUM_CONTRACT",
  rosterFilling: "MAINTAIN_MIN_ROSTER",
  rotations: "FIX_INVALID_ROTATION",
  staffHiring: "HIRE_REQUIRED_COACH",
  trades: "EXECUTE_TRADE",
  injuryReplacement: "SIGN_INJURY_REPLACEMENT",
};

export type ResolvedAiAssistMode = "off" | "smart" | "full";

/**
 * @deprecated Prefer evaluateManagementAction with a concrete action id.
 */
export function resolveDomainAssistMode(
  settings: GameSettings,
  domain: LegacyAssistDomain,
): ResolvedAiAssistMode {
  const policy = buildManagementPolicy(settings);
  const actionId = DOMAIN_TO_ACTION[domain];
  const decision = evaluateManagementAction(settings, actionId);
  if (decision.outcome === "DENY_CONTINUE" || decision.outcome === "DENY_BLOCK") {
    return "off";
  }
  const phaseMode = policy.phases[decision.phase];
  if (phaseMode === "full") {
    return "full";
  }
  if (phaseMode === "off") {
    return "off";
  }
  return "smart";
}

/**
 * @deprecated Prefer canAiExecute / evaluateManagementAction.
 */
export function isAiAssistEnabledForDomain(
  settings: GameSettings,
  domain: LegacyAssistDomain,
): boolean {
  return canAiExecute(settings, DOMAIN_TO_ACTION[domain]);
}
