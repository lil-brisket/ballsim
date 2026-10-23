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

/** Share of each positive non-focus gain a development focus moves. */
export const FOCUS_SHIFT_SHARE = 0.5;
/** Players this age or younger follow a development plan. */
export const DEVELOPMENT_PLAN_MAX_AGE = 25;

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

  // A focus moves growth, never adds it: the same draws, redistributed.
  const focused = redistributeForFocus(deltas, focus);
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const nextRating = nextAttributes[key] + (focused[key] ?? 0);
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

  // Every other field (injuries, Development League profile, retirement,
  // jersey) carries over unchanged.
  return createPlayer({
    ...player,
    attributes: nextAttributes,
    development: { stage },
  });
}

/**
 * Moves {@link FOCUS_SHIFT_SHARE} of each positive non-focus gain into the
 * focus attributes (round-robin, within the annual cap); what does not fit
 * goes back where it came from. Total growth is unchanged; balanced is a
 * no-op.
 */
export function redistributeForFocus(
  deltas: Partial<Record<keyof PlayerAttributes, number>>,
  focus: DevelopmentFocus,
): Partial<Record<keyof PlayerAttributes, number>> {
  const targets = DEVELOPMENT_FOCUS_ATTRIBUTES[focus];
  if (targets.length === 0) return deltas;
  const next = { ...deltas };
  const taken: Array<{ key: keyof PlayerAttributes; amount: number }> = [];
  let pool = 0;
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    if (targets.includes(key)) continue;
    const delta = next[key] ?? 0;
    if (delta <= 0) continue;
    const amount = Math.floor(delta * FOCUS_SHIFT_SHARE);
    if (amount <= 0) continue;
    next[key] = delta - amount;
    pool += amount;
    taken.push({ key, amount });
  }
  let index = 0;
  let stalled = 0;
  while (pool > 0 && stalled < targets.length) {
    const key = targets[index % targets.length]!;
    index += 1;
    if ((next[key] ?? 0) < MAX_ANNUAL_ATTRIBUTE_CHANGE) {
      next[key] = (next[key] ?? 0) + 1;
      pool -= 1;
      stalled = 0;
    } else {
      stalled += 1;
    }
  }
  // Return anything that did not fit, in the order it was taken.
  for (const { key, amount } of taken) {
    if (pool <= 0) break;
    const back = Math.min(pool, amount);
    next[key] = (next[key] ?? 0) + back;
    pool -= back;
  }
  return next;
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
