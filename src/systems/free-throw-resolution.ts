import {
  RATING_MAX,
  RATING_MIN,
  type Player,
} from "@/domain/entities/player";
import type { PlayerId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { FREE_THROW_RESOLUTION_CONFIG } from "@/systems/free-throw-resolution-config";

export type ResolveFreeThrowInput = {
  shooter: Player;
};

export type FreeThrowResult = {
  shooterId: PlayerId;
  made: boolean;
  /** Clamped final make chance used for the Bernoulli roll. */
  probability: number;
};

/**
 * Pure probability for a free-throw attempt. Does not consume RNG.
 *
 * Rating choice: uses shooter.attributes.freeThrow (existing 1–99 attribute).
 * Does not use finishing / midRange / threePoint or resolveShot(), which apply
 * 2PT/3PT defender and fatigue logic inappropriate for free throws.
 *
 * Formula: freeThrow / RATING_MAX → clamp(minProbability, maxProbability)
 */
export function calculateFreeThrowProbability(
  input: ResolveFreeThrowInput,
): number {
  validateResolveFreeThrowInput(input);
  const unclamped = input.shooter.attributes.freeThrow / RATING_MAX;
  return clampProbability(unclamped);
}

/**
 * Resolves a free-throw attempt: computes make probability, then one Bernoulli roll.
 * Does not mutate input. Calls rng.chance exactly once.
 */
export function resolveFreeThrow(
  input: ResolveFreeThrowInput,
  rng: Rng,
): FreeThrowResult {
  if (rng == null) {
    throw new Error("Free throw resolution requires an Rng.");
  }
  const probability = calculateFreeThrowProbability(input);
  const made = rng.chance(probability);
  return {
    shooterId: input.shooter.id,
    made,
    probability,
  };
}

function clampProbability(value: number): number {
  return Math.min(
    FREE_THROW_RESOLUTION_CONFIG.maxProbability,
    Math.max(FREE_THROW_RESOLUTION_CONFIG.minProbability, value),
  );
}

function validateResolveFreeThrowInput(input: ResolveFreeThrowInput): void {
  if (input.shooter == null) {
    throw new Error("Free throw resolution requires a shooter.");
  }
  assertRating(input.shooter.attributes.freeThrow, "shooter.freeThrow");
}

function assertRating(value: number, field: string): void {
  if (
    !Number.isInteger(value) ||
    value < RATING_MIN ||
    value > RATING_MAX
  ) {
    throw new Error(
      `Free throw ${field} must be an integer between ${RATING_MIN} and ${RATING_MAX}.`,
    );
  }
}
