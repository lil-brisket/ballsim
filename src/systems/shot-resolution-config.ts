/**
 * Tunable coefficients for the v1 shot-resolution formula.
 *
 * For v1, all two-point attempts use the mean of finishing and midRange.
 * Shot-location-specific two-point types (rim vs jumper) are out of scope;
 * elite finishing therefore lifts every 2PT attempt, including jumpers.
 *
 * baselineProbability offsets rating/99 so a typical usage-weighted shooter
 * lands near ~50% 2PT / ~35% 3PT instead of mapping ratings to make chance 1:1.
 */

export const SHOT_RESOLUTION_CONFIG = {
  minProbability: 0.08,
  maxProbability: 0.7,
  baselineProbability: -0.2,
  twoPointAdjustment: 0.06,
  threePointAdjustment: -0.08,
  defensiveImpact: 0.22,
  fatigueImpact: 0.12,
} as const;

export const SHOT_TYPES = ["two_point", "three_point"] as const;

export type ShotType = (typeof SHOT_TYPES)[number];
