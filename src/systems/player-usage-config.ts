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
   * Modest role multipliers so attributes dominate.
   * A 90-rated role_player must still out-weight a 50-rated primary_creator.
   */
  roleMultipliers: {
    primary_creator: 1.2,
    secondary_creator: 1.1,
    scorer: 1.08,
    role_player: 1.0,
    low_usage: 0.75,
    bench: 0.7,
  } satisfies Record<OffensiveRole, number>,
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
};

export function mergePlayerUsageConfig(
  overrides?: Partial<{
    usageScoreFloor: number;
    usageScoreMix: Partial<PlayerUsageConfig["usageScoreMix"]>;
    roleMultipliers: Partial<Record<OffensiveRole, number>>;
  }>,
): PlayerUsageConfig {
  if (overrides == null) {
    return {
      usageScoreFloor: PLAYER_USAGE_CONFIG.usageScoreFloor,
      usageScoreMix: { ...PLAYER_USAGE_CONFIG.usageScoreMix },
      roleMultipliers: { ...PLAYER_USAGE_CONFIG.roleMultipliers },
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
  };
}
