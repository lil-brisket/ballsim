import type { Rng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  canAdvancePhase,
  getActivePhaseId,
  type LeaguePhaseId,
} from "@/systems/phase-engine";
import { advanceLeaguePhase } from "@/systems/simulation/offseason-lifecycle";

const USER_MANAGED_PHASES: ReadonlySet<LeaguePhaseId> = new Set([
  "offseason.roster_decisions",
  "offseason.draft_preparation",
  "offseason.draft",
  "offseason.free_agency",
  "offseason.staff_development",
  "preseason.preparation",
]);

/**
 * For automated harnesses: advance a user-controlled phase when nothing required remains.
 * Returns null when the phase cannot / should not auto-advance.
 */
export function tryAdvanceUserManagedPhase(
  state: GameState,
  rng: Rng,
): GameState | null {
  const phaseId = getActivePhaseId(state);
  if (!USER_MANAGED_PHASES.has(phaseId)) {
    return null;
  }
  if (!canAdvancePhase(state)) {
    return null;
  }
  try {
    return advanceLeaguePhase(state, rng).state;
  } catch {
    return null;
  }
}
