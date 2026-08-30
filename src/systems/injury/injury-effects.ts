/**
 * Centralized injury effects — never mutates base Player.attributes.
 * effectiveAttribute = baseAttribute + injuryModifier
 */

import {
  RATING_MAX,
  RATING_MIN,
  PLAYER_ATTRIBUTE_KEYS,
  type Player,
  type PlayerAttributes,
  type PlayerInjury,
} from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { mostRestrictivePractice } from "@/systems/injury/injury-status";

export type WorkloadRestrictions = {
  recommendedWorkloadMpg: number | null;
  maximumWorkloadMpg: number | null;
  minutesRestriction: number | null;
  practiceRestriction: PlayerInjury["practiceRestriction"];
  reinjuryRisk: number;
  temporaryFrustration: number;
};

export type InjuryEffectsView = {
  attributeDeltas: Partial<Record<keyof PlayerAttributes, number>>;
  workload: WorkloadRestrictions;
  developmentOpportunityFactor: number;
  temporaryFrustration: number;
};

function effectScale(injury: PlayerInjury): number {
  // Effects fade as recovery progresses
  return Math.max(0, 1 - injury.recoveryProgress);
}

export function getAttributeModifiers(
  player: Player,
): Partial<Record<keyof PlayerAttributes, number>> {
  const deltas: Partial<Record<keyof PlayerAttributes, number>> = {};
  for (const injury of player.activeInjuries ?? []) {
    const scale = effectScale(injury);
    for (const effect of injury.temporaryEffects) {
      const next = (deltas[effect.attribute] ?? 0) + effect.delta * scale;
      deltas[effect.attribute] = next;
    }
  }
  return deltas;
}

/** Effective attributes — base + temporary injury modifiers. Does not mutate player. */
export function getEffectiveAttributes(player: Player): PlayerAttributes {
  const modifiers = getAttributeModifiers(player);
  const result = { ...player.attributes };
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const delta = modifiers[key] ?? 0;
    if (delta === 0) continue;
    result[key] = Math.min(
      RATING_MAX,
      Math.max(RATING_MIN, Math.round(result[key] + delta)),
    );
  }
  // Conditioning softens stamina when low
  if (player.conditioning < 80) {
    const staminaPenalty = Math.round((80 - player.conditioning) / 10);
    result.stamina = Math.min(
      RATING_MAX,
      Math.max(RATING_MIN, result.stamina - staminaPenalty),
    );
  }
  return result;
}

export function getWorkloadRestrictions(player: Player): WorkloadRestrictions {
  const injuries = player.activeInjuries ?? [];
  if (injuries.length === 0) {
    return {
      recommendedWorkloadMpg: null,
      maximumWorkloadMpg: null,
      minutesRestriction: null,
      practiceRestriction: "full",
      reinjuryRisk: 0,
      temporaryFrustration: 0,
    };
  }

  let recommended: number | null = null;
  let maximum: number | null = null;
  let minutes: number | null = null;
  let reinjuryRisk = 0;
  let frustration = 0;

  for (const injury of injuries) {
    if (injury.recommendedWorkloadMpg != null) {
      recommended =
        recommended == null
          ? injury.recommendedWorkloadMpg
          : Math.min(recommended, injury.recommendedWorkloadMpg);
    }
    if (injury.maximumWorkloadMpg != null) {
      maximum =
        maximum == null
          ? injury.maximumWorkloadMpg
          : Math.min(maximum, injury.maximumWorkloadMpg);
    }
    if (injury.minutesRestriction != null) {
      minutes =
        minutes == null
          ? injury.minutesRestriction
          : Math.min(minutes, injury.minutesRestriction);
    }
    reinjuryRisk = Math.max(reinjuryRisk, injury.reinjuryRisk);
    frustration = Math.max(frustration, injury.temporaryFrustration);
  }

  return {
    recommendedWorkloadMpg: recommended,
    maximumWorkloadMpg: maximum,
    minutesRestriction: minutes,
    practiceRestriction: mostRestrictivePractice(injuries),
    reinjuryRisk,
    temporaryFrustration: frustration,
  };
}

/**
 * Development opportunity factor — short minor injuries ≈ 1.0;
 * long absences scale down based on severity and practice participation.
 */
export function developmentOpportunityFactor(player: Player): number {
  const injuries = player.activeInjuries ?? [];
  if (injuries.length === 0) {
    return 1;
  }
  let factor = 1;
  for (const injury of injuries) {
    const severityPenalty =
      injury.severity === "minor"
        ? 0.02
        : injury.severity === "moderate"
          ? 0.08
          : injury.severity === "major"
            ? 0.18
            : 0.28;
    const absencePenalty =
      injury.gameRestriction === "out"
        ? 0.12 * (1 - injury.recoveryProgress)
        : 0.04 * (1 - injury.recoveryProgress);
    const practiceBonus =
      injury.practiceRestriction === "rehab"
        ? 0.03
        : injury.practiceRestriction === "modified"
          ? 0.02
          : injury.practiceRestriction === "full"
            ? 0.01
            : 0;
    factor -= severityPenalty + absencePenalty - practiceBonus;
  }
  return Math.max(0.4, Math.min(1, factor));
}

export function getInjuryEffects(player: Player): InjuryEffectsView {
  return {
    attributeDeltas: getAttributeModifiers(player),
    workload: getWorkloadRestrictions(player),
    developmentOpportunityFactor: developmentOpportunityFactor(player),
    temporaryFrustration: getWorkloadRestrictions(player).temporaryFrustration,
  };
}

/**
 * Effective player value for AI lineup evaluation.
 * Uses effective attributes + workload capacity + reinjury penalty.
 */
export function getEffectivePlayerValue(player: Player): number {
  const effective = getEffectiveAttributes(player);
  const baseOverall = calculatePlayerOverall(player.position, effective);
  const workload = getWorkloadRestrictions(player);
  let value = baseOverall;

  if (workload.maximumWorkloadMpg === 0) {
    return 0;
  }
  if (workload.maximumWorkloadMpg != null && workload.maximumWorkloadMpg < 36) {
    value *= 0.7 + 0.3 * (workload.maximumWorkloadMpg / 36);
  }
  if (workload.reinjuryRisk > 0) {
    value *= 1 - workload.reinjuryRisk * 0.25;
  }
  if (player.availability === "out" || player.availability === "suspended") {
    return 0;
  }
  return Math.max(0, value);
}
