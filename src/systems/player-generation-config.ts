import type { PlayerPosition } from "@/domain/entities/player";

/** Inclusive age range for generated players (roster / free-agent pool). */
export const MIN_PLAYER_AGE = 20;
export const MAX_PLAYER_AGE = 34;

/**
 * Generation-time latent quality used as the attribute-generation center.
 * Not stored on Player. Not current overall or potential.
 */
export const MIN_PLAYER_QUALITY = 40;
export const MAX_PLAYER_QUALITY = 85;

/** Personality trait generation bounds (1–99 domain; generation uses this band). */
export const MIN_PERSONALITY = 40;
export const MAX_PERSONALITY = 90;

/**
 * Potential gap bands by age (aligned with development stages).
 * Young: age <= 24; Prime: 25–30; Veteran: age >= 31.
 */
export const POTENTIAL_GAP_YOUNG_MIN = 4;
export const POTENTIAL_GAP_YOUNG_MAX = 22;
export const POTENTIAL_GAP_PRIME_MIN = 1;
export const POTENTIAL_GAP_PRIME_MAX = 10;
export const POTENTIAL_GAP_VETERAN_MIN = 0;
export const POTENTIAL_GAP_VETERAN_MAX = 5;

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
