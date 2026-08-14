/**
 * Tunable team-foul bonus rules for the v1 foul-resolution system.
 *
 * Thresholds are generic gameplay defaults, not NBA/FIBA rules inlined in the
 * resolver. Callers pass a FoulRules object (or these defaults) into resolveFoul.
 */

export const FOUL_RESOLUTION_CONFIG = {
  bonusThreshold: 5,
  doubleBonusThreshold: 10,
  bonusFreeThrows: 2,
  doubleBonusFreeThrows: 2,
} as const;

export type FoulRules = {
  bonusThreshold: number;
  doubleBonusThreshold?: number;
  bonusFreeThrows: number;
  doubleBonusFreeThrows?: number;
};
