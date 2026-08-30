import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import { averageAttrs, clamp } from "@/systems/staff-effects/shared";

/**
 * Medical staff effects — read-only multipliers for injury prevention/recovery.
 * Never mutates staff workload, fatigue, morale, or development.
 */
export function medicalPreventionMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  const medical = findTeamStaffByRole(state, teamId, "medical");
  if (!medical) return 1;
  const attrs = medical.attributes as Record<string, number>;
  const score = averageAttrs(attrs, [
    "injuryPrevention",
    "injuryDiagnosis",
    "conditioning",
  ]);
  // Map 1–99 → ~0.85–1.25 (higher = fewer injuries)
  return clamp(0.85 + (score / 99) * 0.4, 0.75, 1.35);
}

export function medicalRecoveryMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  const medical = findTeamStaffByRole(state, teamId, "medical");
  if (!medical) return 1;
  const attrs = medical.attributes as Record<string, number>;
  const score = averageAttrs(attrs, [
    "rehabilitation",
    "recovery",
    "conditioning",
  ]);
  return clamp(0.85 + (score / 99) * 0.4, 0.75, 1.35);
}

/** UI helper: expose medical effectiveness from attributes. */
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
