import {
  RATING_MAX,
  RATING_MIN,
  type PlayerAttributes,
  type PlayerPosition,
} from "@/domain/entities/player";

/**
 * Attribute categories for overall rating (conceptual grouping only).
 *
 * Skills: finishing, midRange, threePoint, freeThrow, ballHandling, passing,
 *   perimeterDefense, interiorDefense, steal, block, rebounding
 * Physical: speed, strength, athleticism, stamina
 * Mental: basketballIq, offensiveIq, defensiveIq, consistency
 *
 * Personality (e.g. composure) is excluded; height/weight are not used —
 * size-related impact for bigs is carried by strength, athleticism, and block.
 */

export type SkillAttributeKey =
  | "finishing"
  | "midRange"
  | "threePoint"
  | "freeThrow"
  | "ballHandling"
  | "passing"
  | "perimeterDefense"
  | "interiorDefense"
  | "steal"
  | "block"
  | "rebounding";

export type PhysicalAttributeKey =
  | "speed"
  | "strength"
  | "athleticism"
  | "stamina";

export type MentalAttributeKey =
  | "basketballIq"
  | "offensiveIq"
  | "defensiveIq"
  | "consistency";

export type CategoryMix = {
  skills: number;
  physical: number;
  mental: number;
};

/** Position category mix; weights sum to 100. */
export const CATEGORY_MIX: Record<PlayerPosition, CategoryMix> = {
  PG: { skills: 65, physical: 20, mental: 15 },
  SG: { skills: 65, physical: 22, mental: 13 },
  SF: { skills: 62, physical: 23, mental: 15 },
  PF: { skills: 60, physical: 25, mental: 15 },
  C: { skills: 60, physical: 25, mental: 15 },
};

/**
 * Relative skill weights by position (normalized in weighted mean).
 * Prefer integers that sum to 100 for readability.
 */
export const SKILL_WEIGHTS: Record<
  PlayerPosition,
  Record<SkillAttributeKey, number>
> = {
  PG: {
    finishing: 8,
    midRange: 10,
    threePoint: 12,
    freeThrow: 6,
    ballHandling: 18,
    passing: 18,
    perimeterDefense: 10,
    interiorDefense: 2,
    steal: 8,
    block: 2,
    rebounding: 6,
  },
  SG: {
    finishing: 12,
    midRange: 14,
    threePoint: 16,
    freeThrow: 6,
    ballHandling: 12,
    passing: 6,
    perimeterDefense: 14,
    interiorDefense: 2,
    steal: 10,
    block: 2,
    rebounding: 6,
  },
  SF: {
    finishing: 12,
    midRange: 11,
    threePoint: 11,
    freeThrow: 5,
    ballHandling: 8,
    passing: 7,
    perimeterDefense: 12,
    interiorDefense: 8,
    steal: 7,
    block: 7,
    rebounding: 12,
  },
  PF: {
    finishing: 16,
    midRange: 10,
    threePoint: 6,
    freeThrow: 5,
    ballHandling: 4,
    passing: 4,
    perimeterDefense: 5,
    interiorDefense: 16,
    steal: 4,
    block: 12,
    rebounding: 18,
  },
  C: {
    finishing: 16,
    midRange: 4,
    threePoint: 3,
    freeThrow: 4,
    ballHandling: 3,
    passing: 3,
    perimeterDefense: 3,
    interiorDefense: 18,
    steal: 3,
    block: 18,
    rebounding: 25,
  },
};

/** Relative physical weights by position (normalized in weighted mean). */
export const PHYSICAL_WEIGHTS: Record<
  PlayerPosition,
  Record<PhysicalAttributeKey, number>
> = {
  PG: {
    speed: 35,
    strength: 15,
    athleticism: 30,
    stamina: 20,
  },
  SG: {
    speed: 30,
    strength: 18,
    athleticism: 32,
    stamina: 20,
  },
  SF: {
    speed: 28,
    strength: 22,
    athleticism: 30,
    stamina: 20,
  },
  PF: {
    speed: 15,
    strength: 40,
    athleticism: 25,
    stamina: 20,
  },
  C: {
    speed: 10,
    strength: 45,
    athleticism: 25,
    stamina: 20,
  },
};

/** Relative mental weights by position (normalized in weighted mean). */
export const MENTAL_WEIGHTS: Record<
  PlayerPosition,
  Record<MentalAttributeKey, number>
> = {
  PG: {
    basketballIq: 30,
    offensiveIq: 35,
    defensiveIq: 15,
    consistency: 20,
  },
  SG: {
    basketballIq: 25,
    offensiveIq: 30,
    defensiveIq: 20,
    consistency: 25,
  },
  SF: {
    basketballIq: 25,
    offensiveIq: 25,
    defensiveIq: 25,
    consistency: 25,
  },
  PF: {
    basketballIq: 25,
    offensiveIq: 20,
    defensiveIq: 30,
    consistency: 25,
  },
  C: {
    basketballIq: 25,
    offensiveIq: 15,
    defensiveIq: 35,
    consistency: 25,
  },
};

function weightedMean<K extends string>(
  attributes: PlayerAttributes,
  weights: Record<K, number>,
): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const key of Object.keys(weights) as K[]) {
    const weight = weights[key];
    weightedSum += attributes[key as keyof PlayerAttributes] * weight;
    weightTotal += weight;
  }
  return weightedSum / weightTotal;
}

/**
 * Derives a 1–99 overall for evaluating attributes at a given position.
 * Pure: uses only the supplied position and attributes (not Player.position).
 * Rounds once after combining category means, then clamps to rating bounds.
 */
export function calculatePlayerOverall(
  position: PlayerPosition,
  attributes: PlayerAttributes,
): number {
  const skillsMean = weightedMean(attributes, SKILL_WEIGHTS[position]);
  const physicalMean = weightedMean(attributes, PHYSICAL_WEIGHTS[position]);
  const mentalMean = weightedMean(attributes, MENTAL_WEIGHTS[position]);

  const mix = CATEGORY_MIX[position];
  const mixTotal = mix.skills + mix.physical + mix.mental;
  const combined =
    (skillsMean * mix.skills +
      physicalMean * mix.physical +
      mentalMean * mix.mental) /
    mixTotal;

  const rounded = Math.round(combined);
  return Math.min(RATING_MAX, Math.max(RATING_MIN, rounded));
}
