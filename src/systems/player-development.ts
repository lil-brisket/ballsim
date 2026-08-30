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
  POTENTIAL_TAPER_GAP,
  STAGE_CATEGORY_DELTAS,
  WORK_ETHIC_CENTER,
  WORK_ETHIC_SCALE,
} from "@/systems/player-development-config";
import { developmentStageForAge } from "@/systems/player-generation-config";

/**
 * One deterministic annual development step at the player's current age.
 * Does not increment age. Does not mutate the input player.
 * Injury status is ignored (no injury development penalty in v1).
 * @param trainerMultiplier Tier 1 trainer quality scale (default 1).
 */
export function developPlayer(
  player: Player,
  rng: Rng,
  trainerMultiplier: number = 1,
): Player {
  const stage = developmentStageForAge(player.age);
  const currentOverall = calculatePlayerOverall(
    player.position,
    player.attributes,
  );
  const remainingPotential = Math.max(
    0,
    player.potential.overall - currentOverall,
  );
  const taper =
    remainingPotential <= 0
      ? 0
      : Math.min(1, remainingPotential / POTENTIAL_TAPER_GAP);
  const workEthicModifier =
    (1 +
      (player.personality.workEthic - WORK_ETHIC_CENTER) / WORK_ETHIC_SCALE) *
    trainerMultiplier;

  const nextAttributes: PlayerAttributes = { ...player.attributes };

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const category = ATTRIBUTE_DEVELOPMENT_CATEGORY[key];
    const range = STAGE_CATEGORY_DELTAS[stage][category];
    let delta = rng.nextInt(range.min, range.max);

    if (delta > 0) {
      delta = Math.round(delta * taper * workEthicModifier);
    }

    if (delta > MAX_ANNUAL_ATTRIBUTE_CHANGE) {
      delta = MAX_ANNUAL_ATTRIBUTE_CHANGE;
    } else if (delta < -MAX_ANNUAL_ATTRIBUTE_CHANGE) {
      delta = -MAX_ANNUAL_ATTRIBUTE_CHANGE;
    }

    const nextRating = nextAttributes[key] + delta;
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

  return createPlayer({
    id: player.id,
    teamId: player.teamId,
    firstName: player.firstName,
    lastName: player.lastName,
    nationality: player.nationality,
    age: player.age,
    heightInches: player.heightInches,
    weightPounds: player.weightPounds,
    position: player.position,
    archetype: player.archetype,
    attributes: nextAttributes,
    potential: player.potential,
    personality: player.personality,
    contractId: player.contractId,
    availability: player.availability,
    injury: player.injury,
    suspension: player.suspension,
    development: { stage },
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
