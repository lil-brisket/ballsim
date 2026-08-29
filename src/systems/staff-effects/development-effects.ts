import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import {
  TRAINER_DEV_MULT_MAX,
  TRAINER_DEV_MULT_MIN,
  TRAINER_DEV_PER_QUALITY_POINT,
} from "@/systems/staff-config";
import {
  averageAttrs,
  clamp,
  diminishAbove,
  overallToMultiplier,
} from "@/systems/staff-effects/shared";

/**
 * Hierarchical player-development staff modifier.
 * Trainer = primary, HC = secondary, AC = supporting.
 * Combined with diminishing returns — not a simple sum.
 */
export function combinedStaffDevelopmentMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  const trainer = findTeamStaffByRole(state, teamId, "trainer");
  const hc = findTeamStaffByRole(state, teamId, "head_coach");
  const ac = findTeamStaffByRole(state, teamId, "assistant_coach");

  let trainerPrimary = 1;
  if (trainer) {
    const attrs = trainer.attributes as Record<string, number>;
    const score = diminishAbove(
      averageAttrs(attrs, [
        "playerDevelopment",
        "skillDevelopment",
        "potentialDevelopment",
      ]),
      85,
    );
    trainerPrimary = overallToMultiplier(
      score,
      TRAINER_DEV_PER_QUALITY_POINT,
      TRAINER_DEV_MULT_MIN,
      TRAINER_DEV_MULT_MAX,
    );
  }

  let hcSecondary = 0;
  if (hc) {
    const attrs = hc.attributes as Record<string, number>;
    const score = averageAttrs(attrs, ["playerDevelopment", "leadership"]);
    hcSecondary = clamp((score - 50) * 0.002, -0.06, 0.08);
  }

  let acSupporting = 0;
  if (ac) {
    const attrs = ac.attributes as Record<string, number>;
    const score = averageAttrs(attrs, ["playerDevelopment", "gamePreparation"]);
    acSupporting = clamp((score - 50) * 0.0015, -0.04, 0.05);
  }

  const combined = trainerPrimary * (1 + hcSecondary) * (1 + acSupporting);
  return clamp(combined, 0.85, 1.2);
}

/** @deprecated Prefer combinedStaffDevelopmentMultiplier — kept for regression callers. */
export function trainerDevelopmentMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  return combinedStaffDevelopmentMultiplier(state, teamId);
}
