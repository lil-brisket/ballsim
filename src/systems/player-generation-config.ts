import type {
  DevelopmentStage,
  PlayerPosition,
} from "@/domain/entities/player";

/** Inclusive age range for generated players (roster / free-agent pool). */
export const MIN_PLAYER_AGE = 20;
export const MAX_PLAYER_AGE = 34;

/**
 * Generation-time latent quality used as the attribute-generation center.
 * Not stored on Player. Not current overall or potential.
 * Default rolls use {@link PLAYER_QUALITY_WEIGHT_BANDS} (pyramid, not uniform).
 */
export const MIN_PLAYER_QUALITY = 40;
export const MAX_PLAYER_QUALITY = 85;

export type QualityBand = {
  min: number;
  max: number;
};

/**
 * Inclusive quality bands with relative mass. Density is weight / band width,
 * so clipping a band (roster slots, tests) keeps the pyramid shape.
 */
export const PLAYER_QUALITY_WEIGHT_BANDS: readonly {
  min: number;
  max: number;
  weight: number;
}[] = [
  { min: 40, max: 49, weight: 16 },
  { min: 50, max: 59, weight: 36 },
  { min: 60, max: 68, weight: 28 },
  { min: 69, max: 75, weight: 12 },
  { min: 76, max: 80, weight: 6 },
  { min: 81, max: 85, weight: 2 },
];

/** Per-integer density for {@link PLAYER_QUALITY_WEIGHT_BANDS}. */
export function qualityWeightForValue(quality: number): number {
  const band = PLAYER_QUALITY_WEIGHT_BANDS.find(
    (entry) => quality >= entry.min && quality <= entry.max,
  );
  if (!band) {
    return 0;
  }
  return band.weight / (band.max - band.min + 1);
}

/** Personality trait generation bounds (1–99 domain; generation uses this band). */
export const MIN_PERSONALITY = 40;
export const MAX_PERSONALITY = 90;

/**
 * Potential gap bands by age (aligned with development stages).
 * Young: age <= 24; Prime: 25–30; Veteran: age >= 31.
 * Rolled with mass toward the minimum of the band.
 */
export const POTENTIAL_GAP_YOUNG_MIN = 4;
export const POTENTIAL_GAP_YOUNG_MAX = 16;
export const POTENTIAL_GAP_PRIME_MIN = 1;
export const POTENTIAL_GAP_PRIME_MAX = 8;
export const POTENTIAL_GAP_VETERAN_MIN = 0;
export const POTENTIAL_GAP_VETERAN_MAX = 3;

export type BodyGenerationRange = {
  minHeightInches: number;
  maxHeightInches: number;
  minWeightPounds: number;
  maxWeightPounds: number;
};

/**
 * Descriptive height/weight bounds by position.
 * Must not feed attribute generation, overall, or potential.
 * Envelope stays within 72–84 in and 180–260 lb.
 */
export const POSITION_BODY_RANGES: Record<PlayerPosition, BodyGenerationRange> =
  {
    PG: {
      minHeightInches: 72,
      maxHeightInches: 76,
      minWeightPounds: 180,
      maxWeightPounds: 210,
    },
    SG: {
      minHeightInches: 74,
      maxHeightInches: 78,
      minWeightPounds: 185,
      maxWeightPounds: 220,
    },
    SF: {
      minHeightInches: 76,
      maxHeightInches: 80,
      minWeightPounds: 200,
      maxWeightPounds: 235,
    },
    PF: {
      minHeightInches: 78,
      maxHeightInches: 82,
      minWeightPounds: 220,
      maxWeightPounds: 250,
    },
    C: {
      minHeightInches: 80,
      maxHeightInches: 84,
      minWeightPounds: 230,
      maxWeightPounds: 260,
    },
  };

export type PotentialGapBand = {
  min: number;
  max: number;
};

/**
 * Development stage from age. Authoritative bands:
 * developing age < 25; prime 25–30; declining age > 30.
 */
export function developmentStageForAge(age: number): DevelopmentStage {
  if (age < 25) {
    return "developing";
  }
  if (age > 30) {
    return "declining";
  }
  return "prime";
}

/**
 * Opening-day age mass. Prime-heavy; 33–34 are scarce so the league does not
 * start with a retirement cliff.
 */
export const PLAYER_AGE_WEIGHTS: Readonly<Record<number, number>> = {
  20: 6,
  21: 7,
  22: 8,
  23: 9,
  24: 10,
  25: 11,
  26: 12,
  27: 12,
  28: 11,
  29: 10,
  30: 9,
  31: 7,
  32: 5,
  33: 3,
  34: 2,
};

export function ageWeightForValue(age: number): number {
  return PLAYER_AGE_WEIGHTS[age] ?? 0;
}

/**
 * Applied to rolled quality when the caller did not force `quality`.
 * Draft/test overrides skip this so pick bands stay intact.
 */
export const DEVELOPING_QUALITY_DELTA = -5;
export const PRIME_QUALITY_DELTA = 0;
export const DECLINING_QUALITY_DELTA = -4;

export function qualityAdjustedForAge(quality: number, age: number): number {
  const stage = developmentStageForAge(age);
  const delta =
    stage === "developing"
      ? DEVELOPING_QUALITY_DELTA
      : stage === "declining"
        ? DECLINING_QUALITY_DELTA
        : PRIME_QUALITY_DELTA;
  return Math.min(
    MAX_PLAYER_QUALITY,
    Math.max(MIN_PLAYER_QUALITY, quality + delta),
  );
}

/** Potential gap range for a generated age. */
export function potentialGapBandForAge(age: number): PotentialGapBand {
  if (age <= 24) {
    return {
      min: POTENTIAL_GAP_YOUNG_MIN,
      max: POTENTIAL_GAP_YOUNG_MAX,
    };
  }
  if (age >= 31) {
    return {
      min: POTENTIAL_GAP_VETERAN_MIN,
      max: POTENTIAL_GAP_VETERAN_MAX,
    };
  }
  return {
    min: POTENTIAL_GAP_PRIME_MIN,
    max: POTENTIAL_GAP_PRIME_MAX,
  };
}
