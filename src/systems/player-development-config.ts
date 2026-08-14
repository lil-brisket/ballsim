import type {
  DevelopmentStage,
  PlayerAttributes,
} from "@/domain/entities/player";

/** Inclusive per-attribute integer change cap for one development year. */
export const MAX_ANNUAL_ATTRIBUTE_CHANGE = 3;

/** Safety cap on derived overall gain in one development year. */
export const MAX_ANNUAL_OVERALL_GAIN = 5;

/** Safety cap on derived overall loss in one development year. */
export const MAX_ANNUAL_OVERALL_LOSS = 4;

/**
 * Remaining-potential gap at which positive development is fully available.
 * Positive deltas scale by min(1, remainingPotential / POTENTIAL_TAPER_GAP).
 */
export const POTENTIAL_TAPER_GAP = 20;

/** Work-ethic modifier center (1 + (workEthic - center) / scale). */
export const WORK_ETHIC_CENTER = 50;

/** Work-ethic modifier scale. 1–99 maps to roughly 0.755–1.245. */
export const WORK_ETHIC_SCALE = 200;

export type AttributeDevelopmentCategory = "physical" | "skill" | "mental";

export type AttributeDeltaRange = {
  min: number;
  max: number;
};

export const DEVELOPING_PHYSICAL_DELTA: AttributeDeltaRange = {
  min: -1,
  max: 3,
};
export const DEVELOPING_SKILL_DELTA: AttributeDeltaRange = {
  min: -1,
  max: 3,
};
export const DEVELOPING_MENTAL_DELTA: AttributeDeltaRange = {
  min: 0,
  max: 2,
};

export const PRIME_PHYSICAL_DELTA: AttributeDeltaRange = {
  min: -1,
  max: 1,
};
export const PRIME_SKILL_DELTA: AttributeDeltaRange = {
  min: -1,
  max: 1,
};
export const PRIME_MENTAL_DELTA: AttributeDeltaRange = {
  min: -1,
  max: 1,
};

export const DECLINING_PHYSICAL_DELTA: AttributeDeltaRange = {
  min: -3,
  max: 0,
};
export const DECLINING_SKILL_DELTA: AttributeDeltaRange = {
  min: -2,
  max: 1,
};
export const DECLINING_MENTAL_DELTA: AttributeDeltaRange = {
  min: -1,
  max: 1,
};

export const STAGE_CATEGORY_DELTAS: Record<
  DevelopmentStage,
  Record<AttributeDevelopmentCategory, AttributeDeltaRange>
> = {
  developing: {
    physical: DEVELOPING_PHYSICAL_DELTA,
    skill: DEVELOPING_SKILL_DELTA,
    mental: DEVELOPING_MENTAL_DELTA,
  },
  prime: {
    physical: PRIME_PHYSICAL_DELTA,
    skill: PRIME_SKILL_DELTA,
    mental: PRIME_MENTAL_DELTA,
  },
  declining: {
    physical: DECLINING_PHYSICAL_DELTA,
    skill: DECLINING_SKILL_DELTA,
    mental: DECLINING_MENTAL_DELTA,
  },
};

export const ATTRIBUTE_DEVELOPMENT_CATEGORY: Record<
  keyof PlayerAttributes,
  AttributeDevelopmentCategory
> = {
  speed: "physical",
  strength: "physical",
  athleticism: "physical",
  stamina: "physical",
  finishing: "skill",
  midRange: "skill",
  threePoint: "skill",
  freeThrow: "skill",
  ballHandling: "skill",
  passing: "skill",
  perimeterDefense: "skill",
  interiorDefense: "skill",
  steal: "skill",
  block: "skill",
  rebounding: "skill",
  basketballIq: "mental",
  offensiveIq: "mental",
  defensiveIq: "mental",
  consistency: "mental",
};
