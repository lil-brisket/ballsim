import type { PlayerPosition } from "@/domain/entities/player";
import type { BodyGenerationRange } from "@/systems/player-generation-config";

/**
 * Hard limits for custom roster / draft-class imports.
 * Generated-player rolls keep {@link POSITION_BODY_RANGES}; this envelope is
 * NBA-sized so imported players are not clamped or rejected.
 */
export const CUSTOM_ROSTER_BODY_ENVELOPE = {
  minHeightInches: 68,
  maxHeightInches: 90,
  minWeightPounds: 160,
  maxWeightPounds: 320,
} as const;

/**
 * Per-position bands that count as usual for custom imports.
 * Outside the hard envelope is still an error; outside these bands warns.
 */
export const CUSTOM_ROSTER_POSITION_BODY_RANGES: Record<
  PlayerPosition,
  BodyGenerationRange
> = {
  PG: {
    minHeightInches: 70,
    maxHeightInches: 80,
    minWeightPounds: 160,
    maxWeightPounds: 230,
  },
  SG: {
    minHeightInches: 72,
    maxHeightInches: 80,
    minWeightPounds: 170,
    maxWeightPounds: 230,
  },
  SF: {
    minHeightInches: 75,
    maxHeightInches: 84,
    minWeightPounds: 175,
    maxWeightPounds: 255,
  },
  PF: {
    minHeightInches: 77,
    maxHeightInches: 86,
    minWeightPounds: 180,
    maxWeightPounds: 290,
  },
  C: {
    minHeightInches: 79,
    maxHeightInches: 90,
    minWeightPounds: 200,
    maxWeightPounds: 320,
  },
};

/** Calculated overalls outside this band warn; they do not block import. */
export const CUSTOM_ROSTER_OVERALL_LOW_WARNING = 40;
export const CUSTOM_ROSTER_OVERALL_HIGH_WARNING = 96;
