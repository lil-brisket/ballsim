import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { readActivePhaseId } from "@/systems/league-rules/phase-ids";
import type { RuleViolation } from "@/systems/league-rules/types";

/**
 * Free agency is phase-gated.
 * settings.offseason.freeAgency.durationDays is cosmetic / UI estimate only —
 * it does NOT determine FA availability.
 */
export function isFreeAgencyOpen(state: GameState): boolean {
  return readActivePhaseId(state) === "offseason.free_agency";
}

export function checkFreeAgencySigning(
  state: GameState,
  playerId: PlayerId,
): { allowed: boolean; violations: RuleViolation[] } {
  const violations: RuleViolation[] = [];

  if (!isFreeAgencyOpen(state)) {
    violations.push({
      code: "FA_NOT_OPEN",
      message: "Free agency is not open yet.",
      tier: "phase_lock",
      action: "sign_free_agent",
    });
  }

  const player = state.world.players[playerId];
  if (player === undefined) {
    violations.push({
      code: "PLAYER_NOT_FOUND",
      message: `Player "${playerId}" does not exist.`,
      tier: "hard_lock",
      action: "sign_free_agent",
    });
    return { allowed: false, violations };
  }

  if (player.retired === true) {
    violations.push({
      code: "PLAYER_RETIRED",
      message: "Retired players cannot be signed.",
      tier: "hard_lock",
      action: "sign_free_agent",
    });
  }

  const rfa = state.business.rfaStatuses?.[playerId];
  if (
    rfa !== undefined &&
    rfa.hasQualifyingOffer &&
    (rfa.resolution === "pending_rfa" || rfa.resolution === "pending_match")
  ) {
    violations.push({
      code: "RFA_REQUIRES_OFFER_SHEET",
      message:
        "RFA signing requires the restricted free-agency process.",
      tier: "hard_lock",
      action: "sign_free_agent",
    });
  }

  return { allowed: violations.length === 0, violations };
}

export function checkFreeAgencyOffer(
  state: GameState,
  playerId: PlayerId,
): { allowed: boolean; violations: RuleViolation[] } {
  return checkFreeAgencySigning(state, playerId);
}
