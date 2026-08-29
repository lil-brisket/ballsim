import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import {
  HEAD_COACH_EFFICIENCY_PER_QUALITY_POINT,
  HEAD_COACH_TEMPO_PER_QUALITY_POINT,
} from "@/systems/staff-config";
import { averageAttrs, clamp } from "@/systems/staff-effects/shared";

export type HeadCoachSimModifiers = {
  tempoBonus: number;
  efficiencyBonus: number;
};

export function headCoachSimModifiers(
  state: GameState,
  teamId: TeamId,
): HeadCoachSimModifiers {
  const coach = findTeamStaffByRole(state, teamId, "head_coach");
  if (!coach) {
    return { tempoBonus: 0, efficiencyBonus: 0 };
  }
  const attrs = coach.attributes as Record<string, number>;
  const offense = averageAttrs(attrs, [
    "offensiveStrategy",
    "threePointCoaching",
  ]);
  const defense = averageAttrs(attrs, [
    "defensiveStrategy",
    "interiorReboundingCoaching",
  ]);
  const management = averageAttrs(attrs, ["gameManagement", "adaptability"]);
  return {
    tempoBonus: (offense - 50) * HEAD_COACH_TEMPO_PER_QUALITY_POINT,
    efficiencyBonus:
      ((defense + management) / 2 - 50) *
      HEAD_COACH_EFFICIENCY_PER_QUALITY_POINT,
  };
}

/**
 * Precomputed once per game — do not query staff inside possession resolution.
 */
export type TeamStaffGameContext = {
  offensiveModifier: number;
  defensiveModifier: number;
  gameManagementModifier: number;
  preparationModifier: number;
  adaptabilityModifier: number;
};

export function buildTeamStaffGameContext(
  state: GameState,
  teamId: TeamId,
): TeamStaffGameContext {
  const hc = findTeamStaffByRole(state, teamId, "head_coach");
  const ac = findTeamStaffByRole(state, teamId, "assistant_coach");

  let offensiveModifier = 0;
  let defensiveModifier = 0;
  let gameManagementModifier = 0;
  let adaptabilityModifier = 0;
  let preparationModifier = 0;

  if (hc) {
    const attrs = hc.attributes as Record<string, number>;
    offensiveModifier = clamp(
      (averageAttrs(attrs, ["offensiveStrategy", "threePointCoaching"]) - 50) *
        0.002,
      -0.08,
      0.08,
    );
    defensiveModifier = clamp(
      (averageAttrs(attrs, [
        "defensiveStrategy",
        "interiorReboundingCoaching",
      ]) -
        50) *
        0.002,
      -0.08,
      0.08,
    );
    gameManagementModifier = clamp(
      (attrs.gameManagement - 50) * 0.002,
      -0.06,
      0.06,
    );
    adaptabilityModifier = clamp(
      (attrs.adaptability - 50) * 0.0015,
      -0.05,
      0.05,
    );
  }

  if (ac) {
    const attrs = ac.attributes as Record<string, number>;
    preparationModifier = clamp(
      (averageAttrs(attrs, ["gamePreparation", "offensiveSupport", "defensiveSupport"]) -
        50) *
        0.0015,
      -0.05,
      0.05,
    );
    offensiveModifier = clamp(
      offensiveModifier + (attrs.offensiveSupport - 50) * 0.0008,
      -0.1,
      0.1,
    );
    defensiveModifier = clamp(
      defensiveModifier + (attrs.defensiveSupport - 50) * 0.0008,
      -0.1,
      0.1,
    );
  }

  return {
    offensiveModifier,
    defensiveModifier,
    gameManagementModifier,
    preparationModifier,
    adaptabilityModifier,
  };
}
