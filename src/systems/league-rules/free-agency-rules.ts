import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { readActivePhaseId } from "@/systems/league-rules/phase-ids";
import type { RuleViolation } from "@/systems/league-rules/types";

/**
 * Free agency is phase-gated.
 * settings.offseason.freeAgency.durationDays is cosmetic / UI estimate only —
 * it does NOT determine FA availability (it sets how fast asks fall, see
 * free-agent-market.ts).
 */
export function isFreeAgencyOpen(state: GameState): boolean {
  return readActivePhaseId(state) === "offseason.free_agency";
}

/**
 * After free agency closes, teams can still sign free agents during
 * preseason and the regular season (not the playoffs).
 */
export function isInSeasonSigningOpen(state: GameState): boolean {
  const phaseId = readActivePhaseId(state);
  return phaseId === "preseason.preparation" || phaseId === "regular";
}

/** Free agents can be signed now: in free agency or during the season. */
export function canSignFreeAgents(state: GameState): boolean {
  return isFreeAgencyOpen(state) || isInSeasonSigningOpen(state);
}

export function checkFreeAgencySigning(
  state: GameState,
  playerId: PlayerId,
): { allowed: boolean; violations: RuleViolation[] } {
  const violations: RuleViolation[] = [];

  if (!canSignFreeAgents(state)) {
    violations.push({
      code: "FA_NOT_OPEN",
      message:
        "Free agents can be signed during free agency and the regular season.",
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
    rfa.seasonYear === state.competition.season.year &&
    rfa.hasQualifyingOffer &&
    (rfa.resolution === "pending_rfa" || rfa.resolution === "pending_match")
  ) {
    violations.push({
      code: "RFA_REQUIRES_OFFER_SHEET",
      message: "RFA signing requires the restricted free-agency process.",
      tier: "hard_lock",
      action: "sign_free_agent",
    });
  }

  return { allowed: violations.length === 0, violations };
}

/**
 * Standing offers are answered day by day during free agency only; during
 * the season a team signs a free agent directly.
 */
export function checkFreeAgencyOffer(
  state: GameState,
  playerId: PlayerId,
): { allowed: boolean; violations: RuleViolation[] } {
  const signing = checkFreeAgencySigning(state, playerId);
  if (isFreeAgencyOpen(state) || !isInSeasonSigningOpen(state)) {
    return signing;
  }
  const violations: RuleViolation[] = [
    {
      code: "FA_NOT_OPEN",
      message: "During the season, sign free agents directly.",
      tier: "phase_lock",
      action: "sign_free_agent",
    },
    ...signing.violations,
  ];
  return { allowed: false, violations };
}
