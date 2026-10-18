/**
 * Tunable coefficients for the v1 shot-resolution formula.
 *
 * For v1, all two-point attempts use the mean of finishing and midRange.
 * Shot-location-specific two-point types (rim vs jumper) are out of scope;
 * elite finishing therefore lifts every 2PT attempt, including jumpers.
 *
 * baselineProbability offsets rating/99 so a typical usage-weighted shooter
 * lands near ~50% 2PT / ~35% 3PT instead of mapping ratings to make chance 1:1.
 *
 * Shooting ability has diminishing returns above `abilityKnee`: each rating
 * point there counts `abilityKneeSlope` of a point. Without it a 97-rated
 * scorer shot ~59% from the field and averaged ~49 PPG (#90).
 */

export const SHOT_RESOLUTION_CONFIG = {
  abilityKnee: 75,
  abilityKneeSlope: 0.5,
  minProbability: 0.08,
  maxProbability: 0.7,
  baselineProbability: -0.18,
  twoPointAdjustment: 0.06,
  threePointAdjustment: -0.095,
  defensiveImpact: 0.22,
  fatigueImpact: 0.12,
  /**
   * Make-probability bonus on the home team's field-goal attempts. Sized for
   * an NBA-like home edge (~+2.5 points, ~56% home wins between equal teams).
   */
  homeCourtAdvantage: 0.016,
} as const;

/**
 * Block chance on a missed shot, credited to the contesting defender:
 *
 *   p = maxProbability[shotType] * t^exponent,
 *   t = clamp((block - floorRating) / (99 - floorRating), 0, 1)
 *
 * Tuned so about 10% of missed field goals are blocked (NBA ~10%), nearly all
 * of them on two-pointers, and elite rim protectors average 2-3 per game.
 */
export const BLOCK_RESOLUTION_CONFIG = {
  floorRating: 35,
  exponent: 1.2,
  maxProbability: { two_point: 0.32, three_point: 0.05 },
} as const;

export const SHOT_TYPES = ["two_point", "three_point"] as const;

export type ShotType = (typeof SHOT_TYPES)[number];
