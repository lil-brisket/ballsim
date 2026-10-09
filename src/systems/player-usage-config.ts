/**
 * Tunable constants for offensive usage scoring and role multipliers.
 * Does not change shot/pass/rebound/foul resolution formulas or actionBaseWeights.
 */

import type { OffensiveRole } from "@/domain/entities/offensive-role";

/** Applied once when producing usageScore from the raw attribute mix. */
export const USAGE_SCORE_FLOOR = 1;

export const PLAYER_USAGE_CONFIG = {
  usageScoreFloor: USAGE_SCORE_FLOOR,
  /** Weights for usageScore mix; must sum to 1 conceptually. */
  usageScoreMix: {
    scoring: 0.4,
    creation: 0.3,
    ballHandling: 0.15,
    offensiveIq: 0.15,
  },
  /**
   * Role multipliers concentrate touches on the primary without beating
   * attributes: a 90-rated role_player still out-weights a 50-rated primary.
   */
  roleMultipliers: {
    primary_creator: 1.75,
    secondary_creator: 1.4,
    scorer: 1.22,
    role_player: 1.0,
    low_usage: 0.52,
    bench: 0.4,
  } satisfies Record<OffensiveRole, number>,
  /**
   * Extra star exponent for box-score scoring weights only.
   * Possession sim already has usageScore × scoring in shot weight.
   */
  boxScoreScoringExponent: 1.2,
} as const;

export type PlayerUsageConfig = {
  usageScoreFloor: number;
  usageScoreMix: {
    scoring: number;
    creation: number;
    ballHandling: number;
    offensiveIq: number;
  };
  roleMultipliers: Record<OffensiveRole, number>;
  boxScoreScoringExponent: number;
};

export function mergePlayerUsageConfig(
  overrides?: Partial<{
    usageScoreFloor: number;
    usageScoreMix: Partial<PlayerUsageConfig["usageScoreMix"]>;
    roleMultipliers: Partial<Record<OffensiveRole, number>>;
    boxScoreScoringExponent: number;
  }>,
): PlayerUsageConfig {
  if (overrides == null) {
    return {
      usageScoreFloor: PLAYER_USAGE_CONFIG.usageScoreFloor,
      usageScoreMix: { ...PLAYER_USAGE_CONFIG.usageScoreMix },
      roleMultipliers: { ...PLAYER_USAGE_CONFIG.roleMultipliers },
      boxScoreScoringExponent: PLAYER_USAGE_CONFIG.boxScoreScoringExponent,
    };
  }
  return {
    usageScoreFloor:
      overrides.usageScoreFloor ?? PLAYER_USAGE_CONFIG.usageScoreFloor,
    usageScoreMix: {
      ...PLAYER_USAGE_CONFIG.usageScoreMix,
      ...overrides.usageScoreMix,
    },
    roleMultipliers: {
      ...PLAYER_USAGE_CONFIG.roleMultipliers,
      ...overrides.roleMultipliers,
    },
    boxScoreScoringExponent:
      overrides.boxScoreScoringExponent ??
      PLAYER_USAGE_CONFIG.boxScoreScoringExponent,
  };
}
