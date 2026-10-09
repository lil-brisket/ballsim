/**
 * Tunable coefficients for the v1 free-throw resolution formula.
 *
 * Free throws use Player.attributes.freeThrow only. Field-goal ratings
 * (finishing, midRange, threePoint) and resolveShot remain separate because
 * they apply defender and shot-type adjustments that do not apply at the line.
 *
 * baselineProbability offsets rating/99 so a typical generated shooter
 * (~67–69 FT) lands near 74–76% instead of sitting on the 72% league floor.
 */

export const FREE_THROW_RESOLUTION_CONFIG = {
  minProbability: 0.4,
  maxProbability: 0.98,
  baselineProbability: 0.035,
} as const;
