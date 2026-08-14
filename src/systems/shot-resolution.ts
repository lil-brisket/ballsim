import {
  RATING_MAX,
  RATING_MIN,
  type Player,
} from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import {
  SHOT_RESOLUTION_CONFIG,
  SHOT_TYPES,
  type ShotType,
} from "@/systems/shot-resolution-config";

export type { ShotType };

export type ResolveShotInput = {
  shooter: Player;
  defender: Player;
  shotType: ShotType;
  /** 0 = rested, 1 = fully fatigued. */
  fatigue: number;
};

export type ShotResolution = {
  made: boolean;
  /** Clamped final make chance used for the Bernoulli roll. */
  probability: number;
};

/**
 * Pure probability for a shot attempt. Does not consume RNG.
 *
 * Formula:
 *   baseProbability = shootingAbility / RATING_MAX
 *   + shotTypeAdjustment
 *   - (defenseRating / RATING_MAX) * defensiveImpact
 *   - fatigue * fatigueImpact
 *   → clamp(minProbability, maxProbability)
 *
 * For v1, all two-point attempts use the mean of finishing and midRange.
 * Shot-location-specific two-point types are out of scope.
 */
export function calculateShotProbability(input: ResolveShotInput): number {
  validateResolveShotInput(input);

  const { shootingAbility, defenseRating, shotTypeAdjustment } =
    resolveShotFactors(input);

  const baseProbability = shootingAbility / RATING_MAX;
  const defensivePenalty =
    (defenseRating / RATING_MAX) * SHOT_RESOLUTION_CONFIG.defensiveImpact;
  const fatiguePenalty =
    input.fatigue * SHOT_RESOLUTION_CONFIG.fatigueImpact;

  const unclamped =
    baseProbability +
    shotTypeAdjustment -
    defensivePenalty -
    fatiguePenalty;

  return clampProbability(unclamped);
}

/**
 * Resolves a shot attempt: computes make probability, then one Bernoulli roll.
 * Does not mutate input. Calls rng.chance exactly once.
 */
export function resolveShot(
  input: ResolveShotInput,
  rng: Rng,
): ShotResolution {
  const probability = calculateShotProbability(input);
  const made = rng.chance(probability);
  return { made, probability };
}

function resolveShotFactors(input: ResolveShotInput): {
  shootingAbility: number;
  defenseRating: number;
  shotTypeAdjustment: number;
} {
  if (input.shotType === "two_point") {
    return {
      shootingAbility:
        (input.shooter.attributes.finishing +
          input.shooter.attributes.midRange) /
        2,
      defenseRating: input.defender.attributes.interiorDefense,
      shotTypeAdjustment: SHOT_RESOLUTION_CONFIG.twoPointAdjustment,
    };
  }

  return {
    shootingAbility: input.shooter.attributes.threePoint,
    defenseRating: input.defender.attributes.perimeterDefense,
    shotTypeAdjustment: SHOT_RESOLUTION_CONFIG.threePointAdjustment,
  };
}

function clampProbability(value: number): number {
  return Math.min(
    SHOT_RESOLUTION_CONFIG.maxProbability,
    Math.max(SHOT_RESOLUTION_CONFIG.minProbability, value),
  );
}

function validateResolveShotInput(input: ResolveShotInput): void {
  if (input.shooter == null) {
    throw new Error("Shot resolution requires a shooter.");
  }
  if (input.defender == null) {
    throw new Error("Shot resolution requires a defender.");
  }
  if (!SHOT_TYPES.includes(input.shotType)) {
    throw new Error(
      `Shot type must be one of ${SHOT_TYPES.join(", ")}.`,
    );
  }
  if (
    typeof input.fatigue !== "number" ||
    !Number.isFinite(input.fatigue) ||
    input.fatigue < 0 ||
    input.fatigue > 1
  ) {
    throw new Error("Shot fatigue must be a finite number between 0 and 1.");
  }

  if (input.shotType === "two_point") {
    assertRating(
      input.shooter.attributes.finishing,
      "shooter.finishing",
    );
    assertRating(input.shooter.attributes.midRange, "shooter.midRange");
    assertRating(
      input.defender.attributes.interiorDefense,
      "defender.interiorDefense",
    );
  } else {
    assertRating(
      input.shooter.attributes.threePoint,
      "shooter.threePoint",
    );
    assertRating(
      input.defender.attributes.perimeterDefense,
      "defender.perimeterDefense",
    );
  }
}

function assertRating(value: number, field: string): void {
  if (
    !Number.isInteger(value) ||
    value < RATING_MIN ||
    value > RATING_MAX
  ) {
    throw new Error(
      `Shot ${field} must be an integer between ${RATING_MIN} and ${RATING_MAX}.`,
    );
  }
}
