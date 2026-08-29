import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import { averageAttrs, clamp } from "@/systems/staff-effects/shared";

/**
 * Medical staff effects — data/attributes exist now.
 * No simulated injury impact until the injury engine exists.
 * These helpers return neutral 1.0 / 0 until wired.
 */
export function medicalPreventionMultiplier(
  _state: GameState,
  _teamId: TeamId,
): number {
  // Intentionally no-op until injury occurrence pipeline exists.
  return 1;
}

export function medicalRecoveryMultiplier(
  _state: GameState,
  _teamId: TeamId,
): number {
  return 1;
}

/** UI helper: expose medical effectiveness from attributes without claiming sim impact. */
export function medicalEffectivenessScore(
  state: GameState,
  teamId: TeamId,
): number | null {
  const medical = findTeamStaffByRole(state, teamId, "medical");
  if (!medical) return null;
  const attrs = medical.attributes as Record<string, number>;
  return Math.round(
    clamp(
      averageAttrs(attrs, [
        "injuryPrevention",
        "injuryDiagnosis",
        "rehabilitation",
        "recovery",
        "conditioning",
      ]),
      1,
      99,
    ),
  );
}
