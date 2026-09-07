/**
 * Authoritative offseason / relocation eligibility for Owner Mode navigation.
 * All contextual nav, hub visibility, page guards, and relocation UI must use these helpers.
 */

import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { assessRelocation } from "@/state/relocation-assessment";

/** True when the franchise is in the offseason decision window. */
export function isOffseasonPeriod(state: GameState): boolean {
  return state.competition.season.phase === "offseason";
}

/**
 * Relocation is an offseason-only franchise decision.
 * Requires both offseason phase and an assessment that can start or is in progress.
 */
export function isRelocationAccessible(
  state: GameState,
  teamId?: TeamId,
): boolean {
  if (!isOffseasonPeriod(state)) {
    return false;
  }
  const assessment = assessRelocation(state, teamId);
  return assessment.canStart || assessment.status === "in_progress";
}
