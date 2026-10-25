import {
  createPlayer,
  PLAYER_ATTRIBUTE_KEYS,
  RATING_MAX,
  RATING_MIN,
  type Player,
  type PlayerAttributes,
  type PlayerPosition,
} from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Rng } from "@/domain/rng";
import {
  ATTRIBUTE_DEVELOPMENT_CATEGORY,
  MAX_ANNUAL_ATTRIBUTE_CHANGE,
  MAX_ANNUAL_OVERALL_GAIN,
  MAX_ANNUAL_OVERALL_LOSS,
  developmentBandForAge,
  POTENTIAL_TAPER_GAP,
  WORK_ETHIC_CENTER,
  WORK_ETHIC_SCALE,
} from "@/systems/player-development-config";
import { developmentStageForAge } from "@/systems/player-generation-config";
import { developmentOpportunityFactor } from "@/systems/injury/injury-effects";
import {
  DEVELOPMENT_FOCUS_ATTRIBUTES,
  type DevelopmentFocus,
} from "@/domain/entities/development-plan";

/**
 * Points a training camp adds to each of its attributes, on top of the
 * player's normal development. Never past potential or the annual caps.
 */
export const CAMP_ATTRIBUTE_BONUS = 2;

/**
 * One deterministic annual development step at the player's current age.
 * Does not increment age. Does not mutate the input player.
 * Injury impact scales with severity/time missed via developmentOpportunityFactor —
 * short minor injuries have little effect.
 * @param trainerMultiplier Tier 1 trainer quality scale (default 1).
 */
export function developPlayer(
  player: Player,
  rng: Rng,
  trainerMultiplier: number = 1,
  focus: DevelopmentFocus = "balanced",
): Player {
  const stage = developmentStageForAge(player.age);
  const currentOverall = calculatePlayerOverall(
    player.position,
    player.attributes,
  );
  const band = developmentBandForAge(player.age);
  const remainingPotential = Math.max(
    0,
    player.potential.overall - currentOverall,
  );
  const taper = !band.tapered
    ? 1
    : remainingPotential <= 0
      ? 0
      : Math.min(1, remainingPotential / POTENTIAL_TAPER_GAP);
  const injuryFactor = developmentOpportunityFactor(player);
  // Work ethic, trainers and facilities speed growth; from the plateau on
  // the curve is age-driven (only missed time still costs).
  const workEthicModifier = band.tapered
    ? (1 +
        (player.personality.workEthic - WORK_ETHIC_CENTER) / WORK_ETHIC_SCALE) *
      trainerMultiplier *
      injuryFactor
    : injuryFactor;

  const nextAttributes: PlayerAttributes = { ...player.attributes };
  const deltas: Partial<Record<keyof PlayerAttributes, number>> = {};

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const category = ATTRIBUTE_DEVELOPMENT_CATEGORY[key];
    const range = band.deltas[category];
    let delta = rng.nextInt(range.min, range.max);

    if (delta > 0) {
      delta = Math.round(delta * taper * workEthicModifier);
    }

    if (delta > MAX_ANNUAL_ATTRIBUTE_CHANGE) {
      delta = MAX_ANNUAL_ATTRIBUTE_CHANGE;
    } else if (delta < -MAX_ANNUAL_ATTRIBUTE_CHANGE) {
      delta = -MAX_ANNUAL_ATTRIBUTE_CHANGE;
    }

    deltas[key] = delta;
  }

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const nextRating = nextAttributes[key] + (deltas[key] ?? 0);
    nextAttributes[key] = Math.min(
      RATING_MAX,
      Math.max(RATING_MIN, nextRating),
    );
  }

  enforceOverallCeiling(
    player.position,
    nextAttributes,
    player.attributes,
    player.potential.overall,
  );
  enforceAnnualOverallCaps(
    player.position,
    nextAttributes,
    player.attributes,
    currentOverall,
  );
  // The camp runs after the caps, so it only ever adds to this result.
  applyCampBonus(player, nextAttributes, currentOverall, focus);

  // Every other field (injuries, Development League profile, retirement,
  // jersey) carries over unchanged.
  return createPlayer({
    ...player,
    attributes: nextAttributes,
    development: { stage },
  });
}

/**
 * Adds up to {@link CAMP_ATTRIBUTE_BONUS} points to each camp attribute, one
 * point per attribute per pass. A point is skipped when it would break the
 * annual attribute cap, the rating max, potential or the annual overall gain
 * cap. Balanced (no camp) is a no-op. No RNG.
 */
export function applyCampBonus(
  player: Player,
  attributes: PlayerAttributes,
  originalOverall: number,
  focus: DevelopmentFocus,
): void {
  const targets = DEVELOPMENT_FOCUS_ATTRIBUTES[focus];
  const ceiling = Math.min(
    player.potential.overall,
    originalOverall + MAX_ANNUAL_OVERALL_GAIN,
  );
  for (let pass = 0; pass < CAMP_ATTRIBUTE_BONUS; pass += 1) {
    for (const key of targets) {
      if (attributes[key] >= RATING_MAX) continue;
      if (
        attributes[key] - player.attributes[key] >=
        MAX_ANNUAL_ATTRIBUTE_CHANGE
      ) {
        continue;
      }
      attributes[key] += 1;
      if (calculatePlayerOverall(player.position, attributes) > ceiling) {
        attributes[key] -= 1;
      }
    }
  }
}

/**
 * Peel attributes until overall is at or below stored potential.
 */
export function clampPlayerToPotential(player: Player): Player {
  const attributes = { ...player.attributes };
  while (
    calculatePlayerOverall(player.position, attributes) >
    player.potential.overall
  ) {
    let bestKey: keyof PlayerAttributes | null = null;
    let bestVal = -1;
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      if (attributes[key] > RATING_MIN && attributes[key] > bestVal) {
        bestVal = attributes[key];
        bestKey = key;
      }
    }
    if (bestKey === null) {
      break;
    }
    attributes[bestKey] -= 1;
  }
  return createPlayer({
    ...player,
    attributes,
  });
}

function enforceOverallCeiling(
  position: PlayerPosition,
  attributes: PlayerAttributes,
  originalAttributes: PlayerAttributes,
  potentialOverall: number,
): void {
  while (calculatePlayerOverall(position, attributes) > potentialOverall) {
    const key = findPeelKey(attributes, originalAttributes, "gain");
    if (key === null) {
      break;
    }
    attributes[key] -= 1;
  }
}

function enforceAnnualOverallCaps(
  position: PlayerPosition,
  attributes: PlayerAttributes,
  originalAttributes: PlayerAttributes,
  originalOverall: number,
): void {
  while (
    calculatePlayerOverall(position, attributes) - originalOverall >
    MAX_ANNUAL_OVERALL_GAIN
  ) {
    const key = findPeelKey(attributes, originalAttributes, "gain");
    if (key === null) {
      break;
    }
    attributes[key] -= 1;
  }

  while (
    originalOverall - calculatePlayerOverall(position, attributes) >
    MAX_ANNUAL_OVERALL_LOSS
  ) {
    const key = findPeelKey(attributes, originalAttributes, "loss");
    if (key === null) {
      break;
    }
    attributes[key] += 1;
  }
}

function findPeelKey(
  current: PlayerAttributes,
  original: PlayerAttributes,
  direction: "gain" | "loss",
): keyof PlayerAttributes | null {
  let bestKey: keyof PlayerAttributes | null = null;
  let bestMagnitude = 0;

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const delta = current[key] - original[key];
    if (direction === "gain") {
      if (delta <= 0 || current[key] <= RATING_MIN) {
        continue;
      }
      if (delta > bestMagnitude) {
        bestMagnitude = delta;
        bestKey = key;
      }
    } else {
      if (delta >= 0 || current[key] >= RATING_MAX) {
        continue;
      }
      const magnitude = -delta;
      if (magnitude > bestMagnitude) {
        bestMagnitude = magnitude;
        bestKey = key;
      }
    }
  }

  return bestKey;
}
