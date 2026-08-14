import {
  createFoul,
  type Foul,
  type FoulType,
} from "@/domain/entities/foul";
import type { PlayerId } from "@/domain/ids";
import {
  SHOT_TYPES,
  type ShotType,
} from "@/systems/shot-resolution-config";
import {
  FOUL_RESOLUTION_CONFIG,
  type FoulRules,
} from "@/systems/foul-resolution-config";

export type { FoulRules };

export type ResolveFoulInput = {
  foul: Foul;
  /** Fouling team's team-foul count before this foul is applied. */
  teamFoulsBefore: number;
  rules?: FoulRules;
  /**
   * Required when foul.foulType is "shooting"; must be omitted for
   * "non-shooting". Reuses ShotType from shot-resolution (not a second model).
   */
  shotType?: ShotType;
  /** Required when foul.foulType is "shooting"; must be omitted otherwise. */
  shotMade?: boolean;
};

export type FoulResolution = {
  foulType: FoulType;
  foulingPlayerId: PlayerId;
  fouledPlayerId: PlayerId;
  teamFoulsAfter: number;
  basketCounts: boolean;
  freeThrowsAwarded: number;
  /** True when non-shooting free throws came from team-foul bonus rules. */
  bonusFreeThrows: boolean;
};

/**
 * Deterministic foul consequence resolver. Does not consume RNG, mutate input,
 * or touch Game / GameState. Callers own persistence of teamFoulsAfter.
 *
 * Bonus for non-shooting fouls compares teamFoulsAfter to configured thresholds
 * so the foul just recorded can put the team into bonus.
 */
export function resolveFoul(input: ResolveFoulInput): FoulResolution {
  validateResolveFoulInput(input);

  const rules = input.rules ?? FOUL_RESOLUTION_CONFIG;
  validateFoulRules(rules);

  const teamFoulsAfter = input.teamFoulsBefore + 1;
  const foul = input.foul;

  if (foul.foulType === "shooting") {
    return resolveShootingFoul(foul, teamFoulsAfter, input.shotType!, input.shotMade!);
  }

  return resolveNonShootingFoul(foul, teamFoulsAfter, rules);
}

/**
 * Validates FoulRules. Throws Error on invalid values (no clamping).
 */
export function validateFoulRules(rules: FoulRules): void {
  assertIntegerAtLeast(rules.bonusThreshold, "bonusThreshold", 1);
  assertIntegerAtLeast(rules.bonusFreeThrows, "bonusFreeThrows", 1);

  if (rules.doubleBonusThreshold !== undefined) {
    if (
      !Number.isInteger(rules.doubleBonusThreshold) ||
      rules.doubleBonusThreshold <= rules.bonusThreshold
    ) {
      throw new Error(
        "Foul rules doubleBonusThreshold must be an integer greater than bonusThreshold.",
      );
    }
    if (rules.doubleBonusFreeThrows === undefined) {
      throw new Error(
        "Foul rules doubleBonusFreeThrows is required when doubleBonusThreshold is set.",
      );
    }
    assertIntegerAtLeast(
      rules.doubleBonusFreeThrows,
      "doubleBonusFreeThrows",
      1,
    );
  } else if (rules.doubleBonusFreeThrows !== undefined) {
    throw new Error(
      "Foul rules doubleBonusFreeThrows requires doubleBonusThreshold.",
    );
  }
}

function resolveShootingFoul(
  foul: Foul,
  teamFoulsAfter: number,
  shotType: ShotType,
  shotMade: boolean,
): FoulResolution {
  let freeThrowsAwarded: number;
  if (shotMade) {
    freeThrowsAwarded = 1;
  } else if (shotType === "two_point") {
    freeThrowsAwarded = 2;
  } else {
    freeThrowsAwarded = 3;
  }

  return {
    foulType: foul.foulType,
    foulingPlayerId: foul.foulingPlayerId,
    fouledPlayerId: foul.fouledPlayerId,
    teamFoulsAfter,
    basketCounts: shotMade,
    freeThrowsAwarded,
    bonusFreeThrows: false,
  };
}

function resolveNonShootingFoul(
  foul: Foul,
  teamFoulsAfter: number,
  rules: FoulRules,
): FoulResolution {
  let freeThrowsAwarded = 0;
  let bonusFreeThrows = false;

  if (
    rules.doubleBonusThreshold !== undefined &&
    teamFoulsAfter >= rules.doubleBonusThreshold
  ) {
    freeThrowsAwarded = rules.doubleBonusFreeThrows!;
    bonusFreeThrows = true;
  } else if (teamFoulsAfter >= rules.bonusThreshold) {
    freeThrowsAwarded = rules.bonusFreeThrows;
    bonusFreeThrows = true;
  }

  return {
    foulType: foul.foulType,
    foulingPlayerId: foul.foulingPlayerId,
    fouledPlayerId: foul.fouledPlayerId,
    teamFoulsAfter,
    basketCounts: false,
    freeThrowsAwarded,
    bonusFreeThrows,
  };
}

function validateResolveFoulInput(input: ResolveFoulInput): void {
  if (input.foul == null) {
    throw new Error("Foul resolution requires a foul.");
  }

  // Re-validate foul shape so raw objects cannot bypass createFoul.
  createFoul(input.foul);

  if (
    !Number.isInteger(input.teamFoulsBefore) ||
    input.teamFoulsBefore < 0
  ) {
    throw new Error(
      "Foul resolution teamFoulsBefore must be a non-negative integer.",
    );
  }

  const isShooting = input.foul.foulType === "shooting";
  const hasShotType = input.shotType !== undefined;
  const hasShotMade = input.shotMade !== undefined;

  if (isShooting) {
    if (!hasShotType || !hasShotMade) {
      throw new Error(
        "Foul resolution requires shotType and shotMade for shooting fouls.",
      );
    }
    if (!SHOT_TYPES.includes(input.shotType!)) {
      throw new Error(
        `Foul resolution shotType must be one of ${SHOT_TYPES.join(", ")}.`,
      );
    }
    if (typeof input.shotMade !== "boolean") {
      throw new Error("Foul resolution shotMade must be a boolean.");
    }
  } else if (hasShotType || hasShotMade) {
    throw new Error(
      "Foul resolution must not include shotType or shotMade for non-shooting fouls.",
    );
  }
}

function assertIntegerAtLeast(
  value: number,
  field: string,
  minimum: number,
): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(
      `Foul rules ${field} must be an integer greater than or equal to ${minimum}.`,
    );
  }
}
