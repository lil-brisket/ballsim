import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import {
  SCOUT_NOISE_REDUCTION_PER_QUALITY_POINT,
  SCOUT_NOISE_SCALE_MAX,
  SCOUT_NOISE_SCALE_MIN,
} from "@/systems/staff-config";
import { averageAttrs, clamp, diminishAbove } from "@/systems/staff-effects/shared";

/** Scale draft scouting noise (1 = default). Better scout → lower noise. */
export function scoutNoiseScale(state: GameState, teamId: TeamId): number {
  const scout = findTeamStaffByRole(state, teamId, "scout");
  if (!scout) return 1;
  const attrs = scout.attributes as Record<string, number>;
  const accuracy = diminishAbove(
    averageAttrs(attrs, ["scoutingAccuracy", "potentialEvaluation", "playerEvaluation"]),
    85,
  );
  const scale =
    1 - (accuracy - 50) * SCOUT_NOISE_REDUCTION_PER_QUALITY_POINT;
  return clamp(scale, SCOUT_NOISE_SCALE_MIN, SCOUT_NOISE_SCALE_MAX);
}
