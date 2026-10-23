import type { PlayerAttributes } from "@/domain/entities/player";

/** Inclusive per-attribute integer change cap for one development year. */
export const MAX_ANNUAL_ATTRIBUTE_CHANGE = 5;

/** Safety cap on derived overall gain in one development year. */
export const MAX_ANNUAL_OVERALL_GAIN = 5;

/** Safety cap on derived overall loss in one development year. */
export const MAX_ANNUAL_OVERALL_LOSS = 5;

/**
 * Remaining-potential gap at which positive development is fully available.
 * In tapered age bands, positive deltas scale by
 * min(1, remainingPotential / POTENTIAL_TAPER_GAP).
 */
export const POTENTIAL_TAPER_GAP = 6;

/** Work-ethic modifier center (1 + (workEthic - center) / scale). */
export const WORK_ETHIC_CENTER = 50;

/** Work-ethic modifier scale. 1–99 maps to roughly 0.755–1.245. */
export const WORK_ETHIC_SCALE = 200;

export type AttributeDevelopmentCategory = "physical" | "skill" | "mental";

export type AttributeDeltaRange = {
  min: number;
  max: number;
};

/**
 * One age band of the yearly development curve. `tapered` bands grow toward
 * potential and slow as the gap closes; later bands move around the
 * player's level (the potential ceiling still applies) and then decline.
 */
export type DevelopmentAgeBand = {
  /** Inclusive upper age (after the birthday) for this band. */
  maxAge: number;
  tapered: boolean;
  deltas: Record<AttributeDevelopmentCategory, AttributeDeltaRange>;
};

/**
 * Yearly development by age: fast growth to 22, slower to 26, a plateau to
 * 29, then a decline that speeds up from 32 and again from 34.
 * Roughly +2.4, +1.6, +0.6, 0, -0.7, -1.2 and -2.2 overall a year with room
 * to grow.
 */
export const DEVELOPMENT_AGE_BANDS: readonly DevelopmentAgeBand[] = [
  {
    maxAge: 22,
    tapered: true,
    deltas: {
      physical: { min: 1, max: 5 },
      skill: { min: 1, max: 5 },
      mental: { min: 0, max: 4 },
    },
  },
  {
    maxAge: 24,
    tapered: true,
    deltas: {
      physical: { min: 0, max: 4 },
      skill: { min: 0, max: 4 },
      mental: { min: 0, max: 3 },
    },
  },
  {
    maxAge: 26,
    tapered: true,
    deltas: {
      physical: { min: -1, max: 3 },
      skill: { min: 0, max: 3 },
      mental: { min: 0, max: 2 },
    },
  },
  {
    maxAge: 29,
    tapered: false,
    deltas: {
      physical: { min: -1, max: 1 },
      skill: { min: -1, max: 1 },
      mental: { min: -1, max: 1 },
    },
  },
  {
    maxAge: 31,
    tapered: false,
    deltas: {
      physical: { min: -3, max: 0 },
      skill: { min: -2, max: 1 },
      mental: { min: -1, max: 1 },
    },
  },
  {
    maxAge: 33,
    tapered: false,
    deltas: {
      physical: { min: -4, max: 0 },
      skill: { min: -3, max: 1 },
      mental: { min: -1, max: 1 },
    },
  },
  {
    maxAge: Number.POSITIVE_INFINITY,
    tapered: false,
    deltas: {
      physical: { min: -5, max: -1 },
      skill: { min: -4, max: 0 },
      mental: { min: -2, max: 1 },
    },
  },
];

export function developmentBandForAge(age: number): DevelopmentAgeBand {
  return (
    DEVELOPMENT_AGE_BANDS.find((band) => age <= band.maxAge) ??
    DEVELOPMENT_AGE_BANDS[DEVELOPMENT_AGE_BANDS.length - 1]!
  );
}

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
