import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import {
  SCOUT_NOISE_REDUCTION_PER_QUALITY_POINT,
  SCOUT_NOISE_SCALE_MAX,
  SCOUT_NOISE_SCALE_MIN,
} from "@/systems/staff-config";
import { averageAttrs, clamp, diminishAbove } from "@/systems/staff-effects/shared";

function scoutAttrs(
  state: GameState,
  teamId: TeamId,
): Record<string, number> | null {
  const scout = findTeamStaffByRole(state, teamId, "scout");
  if (!scout) return null;
  return scout.attributes as Record<string, number>;
}

/** Scale draft scouting noise (1 = default). Better scout → lower noise. */
export function scoutNoiseScale(state: GameState, teamId: TeamId): number {
  const attrs = scoutAttrs(state, teamId);
  if (!attrs) return 1;
  const accuracy = diminishAbove(
    averageAttrs(attrs, [
      "scoutingAccuracy",
      "potentialEvaluation",
      "playerEvaluation",
    ]),
    85,
  );
  const scale =
    1 - (accuracy - 50) * SCOUT_NOISE_REDUCTION_PER_QUALITY_POINT;
  return clamp(scale, SCOUT_NOISE_SCALE_MIN, SCOUT_NOISE_SCALE_MAX);
}

/**
 * Quality multiplier for effective exposure and range narrowing.
 * 1.0 at quality 50; higher quality → higher multiplier (more effective exposure).
 */
export function scoutQualityMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  const attrs = scoutAttrs(state, teamId);
  if (!attrs) return 0.85;
  const quality = diminishAbove(
    averageAttrs(attrs, [
      "scoutingAccuracy",
      "potentialEvaluation",
      "playerEvaluation",
    ]),
    85,
  );
  const experienceBonus = (() => {
    const scout = findTeamStaffByRole(state, teamId, "scout");
    if (!scout) return 0;
    return Math.min(0.15, scout.experience / 200);
  })();
  return clamp(0.55 + (quality / 100) * 0.9 + experienceBonus, 0.55, 1.6);
}

/** scoutingSpeed → exposure-per-day multiplier (1 = average). */
export function scoutSpeedMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  const attrs = scoutAttrs(state, teamId);
  if (!attrs) return 0.9;
  const speed = attrs.scoutingSpeed ?? 50;
  return clamp(0.6 + (speed / 100) * 0.8, 0.6, 1.5);
}

/**
 * International scouting skill → reduces international difficulty.
 * 1.0 at 50; higher → better at scouting internationals.
 */
export function scoutInternationalModifier(
  state: GameState,
  teamId: TeamId,
): number {
  const attrs = scoutAttrs(state, teamId);
  if (!attrs) return 0.85;
  const intl = attrs.internationalScouting ?? 50;
  return clamp(0.55 + (intl / 100) * 0.9, 0.55, 1.45);
}
