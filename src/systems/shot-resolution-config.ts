/**
 * Tunable coefficients for the v1 shot-resolution formula.
 *
 * For v1, all two-point attempts use the mean of finishing and midRange.
 * Shot-location-specific two-point types (rim vs jumper) are out of scope;
 * elite finishing therefore lifts every 2PT attempt, including jumpers.
 */

export const SHOT_RESOLUTION_CONFIG = {
  minProbability: 0.08,
  maxProbability: 0.85,
  twoPointAdjustment: 0.06,
  threePointAdjustment: -0.08,
  defensiveImpact: 0.22,
  fatigueImpact: 0.12,
} as const;

export const SHOT_TYPES = ["two_point", "three_point"] as const;

export type ShotType = (typeof SHOT_TYPES)[number];
