import {
  type CoachingPhilosophy,
  DEFAULT_COACHING_PHILOSOPHY,
} from "@/domain/coaching/coaching-philosophy";
import type { PlayerId } from "@/domain/ids";

/**
 * Tunable coaching modifiers applied on top of existing sim probabilities.
 * Modest defaults — directional only; not box-score tuned.
 */
export const COACHING_PHILOSOPHY_CONFIG = {
  possessionSecondsDelta: {
    fast: -2,
    balanced: 0,
    halfCourt: 2,
  },
  shotSelection: {
    threePointHeavy: { threePoint: 1.2, finishing: 1 },
    balanced: { threePoint: 1, finishing: 1 },
    inside: { threePoint: 1, finishing: 1.2 },
  },
  defensivePressureMultiplier: {
    aggressive: 1.15,
    balanced: 1,
    conservative: 0.85,
  },
  foulActionWeightMultiplier: {
    aggressive: 1.1,
    balanced: 1,
    conservative: 0.9,
  },
  /** Usage boost for the focal player while on the court. */
  focalPlayerUsageMultiplier: {
    shot: 1.4,
    involvement: 1.25,
  },
} as const;

export type CoachingModifiers = {
  readonly possessionSecondsDelta: number;
  readonly shotSelection: {
    readonly threePoint: number;
    readonly finishing: number;
  };
  readonly defensivePressureMultiplier: number;
  readonly foulActionWeightMultiplier: number;
  readonly focalPlayer: {
    readonly playerId: PlayerId;
    readonly shotMultiplier: number;
    readonly involvementMultiplier: number;
  } | null;
};

/**
 * Pure mapping from philosophy to simulation modifiers.
 * Does not mutate input or shared defaults.
 */
export function getCoachingModifiers(
  philosophy: CoachingPhilosophy = DEFAULT_COACHING_PHILOSOPHY,
): CoachingModifiers {
  const config = COACHING_PHILOSOPHY_CONFIG;
  const shot = config.shotSelection[philosophy.offensiveEmphasis];
  return {
    possessionSecondsDelta: config.possessionSecondsDelta[philosophy.pace],
    shotSelection: {
      threePoint: shot.threePoint,
      finishing: shot.finishing,
    },
    defensivePressureMultiplier:
      config.defensivePressureMultiplier[philosophy.defensiveApproach],
    foulActionWeightMultiplier:
      config.foulActionWeightMultiplier[philosophy.defensiveApproach],
    focalPlayer:
      philosophy.focalPlayerId == null
        ? null
        : {
            playerId: philosophy.focalPlayerId,
            shotMultiplier: config.focalPlayerUsageMultiplier.shot,
            involvementMultiplier:
              config.focalPlayerUsageMultiplier.involvement,
          },
  };
}
