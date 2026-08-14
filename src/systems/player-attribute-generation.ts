import {
  RATING_MAX,
  RATING_MIN,
  type PlayerAttributes,
  type PlayerPosition,
} from "@/domain/entities/player";
import {
  combinedAttributeWeights,
  compatibleArchetypesForPosition,
  type PlayerArchetype,
} from "@/domain/entities/player-archetype";
import type { Rng } from "@/domain/rng";

const GENERATION_BASE = 70;
const GENERATION_SCALE = 28;
const GENERATION_SPREAD = 8;

const ATTRIBUTE_KEYS: readonly (keyof PlayerAttributes)[] = [
  "speed",
  "strength",
  "athleticism",
  "stamina",
  "finishing",
  "midRange",
  "threePoint",
  "freeThrow",
  "ballHandling",
  "passing",
  "perimeterDefense",
  "interiorDefense",
  "steal",
  "block",
  "rebounding",
  "basketballIq",
  "offensiveIq",
  "defensiveIq",
  "consistency",
];

/**
 * Uniform pick among archetypes compatible with the position (generation only).
 */
export function pickCompatibleArchetype(
  position: PlayerPosition,
  rng: Rng,
): PlayerArchetype {
  const options = compatibleArchetypesForPosition(position);
  if (options.length === 0) {
    throw new Error(`No compatible archetypes for position ${position}.`);
  }
  return options[rng.nextInt(0, options.length - 1)]!;
}

/**
 * Generate 1–99 attribute ratings from position + archetype weights and RNG.
 * Clamps generation output only; createPlayer still rejects out-of-range input.
 */
export function generatePlayerAttributes(
  position: PlayerPosition,
  archetype: PlayerArchetype,
  rng: Rng,
): PlayerAttributes {
  const weights = combinedAttributeWeights(position, archetype);
  const attributes = {} as PlayerAttributes;

  for (const key of ATTRIBUTE_KEYS) {
    const center = Math.round(
      GENERATION_BASE + (weights[key] - 1) * GENERATION_SCALE,
    );
    const raw = rng.nextInt(center - GENERATION_SPREAD, center + GENERATION_SPREAD);
    attributes[key] = Math.min(RATING_MAX, Math.max(RATING_MIN, raw));
  }

  return attributes;
}
