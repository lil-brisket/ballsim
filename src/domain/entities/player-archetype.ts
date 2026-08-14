import type { PlayerAttributes, PlayerPosition } from "@/domain/entities/player";

export type PlayerArchetype =
  | "floor_general"
  | "scoring_guard"
  | "three_and_d_wing"
  | "shot_creator"
  | "slasher"
  | "stretch_big"
  | "rim_protector"
  | "rebounding_big"
  | "two_way_forward";

export const PLAYER_ARCHETYPES: readonly PlayerArchetype[] = [
  "floor_general",
  "scoring_guard",
  "three_and_d_wing",
  "shot_creator",
  "slasher",
  "stretch_big",
  "rim_protector",
  "rebounding_big",
  "two_way_forward",
] as const;

export const ARCHETYPE_LABELS: Record<PlayerArchetype, string> = {
  floor_general: "Floor General",
  scoring_guard: "Scoring Guard",
  three_and_d_wing: "3&D Wing",
  shot_creator: "Shot Creator",
  slasher: "Slasher",
  stretch_big: "Stretch Big",
  rim_protector: "Rim Protector",
  rebounding_big: "Rebounding Big",
  two_way_forward: "Two-Way Forward",
};

/** Weight bands for position/archetype attribute profiles. */
export const WEIGHT_WEAK = 0.7;
export const WEIGHT_AVERAGE = 1.0;
export const WEIGHT_SECONDARY = 1.15;
export const WEIGHT_STRONG = 1.3;

export type AttributeWeights = Record<keyof PlayerAttributes, number>;

const W = WEIGHT_WEAK;
const A = WEIGHT_AVERAGE;
const S = WEIGHT_SECONDARY;
const E = WEIGHT_STRONG;

function weights(partial: AttributeWeights): AttributeWeights {
  return partial;
}

/**
 * Compatible primary positions per archetype (generation guidance only).
 * Stored players may use any position/archetype pair.
 */
export const ARCHETYPE_COMPATIBLE_POSITIONS: Record<
  PlayerArchetype,
  readonly PlayerPosition[]
> = {
  floor_general: ["PG"],
  scoring_guard: ["PG", "SG"],
  three_and_d_wing: ["SG", "SF"],
  shot_creator: ["PG", "SG", "SF"],
  slasher: ["SG", "SF"],
  stretch_big: ["PF", "C"],
  rim_protector: ["PF", "C"],
  rebounding_big: ["PF", "C"],
  two_way_forward: ["SF", "PF"],
};

export function isPlayerArchetype(value: string): value is PlayerArchetype {
  return (PLAYER_ARCHETYPES as readonly string[]).includes(value);
}

export function isArchetypeCompatible(
  archetype: PlayerArchetype,
  position: PlayerPosition,
): boolean {
  return ARCHETYPE_COMPATIBLE_POSITIONS[archetype].includes(position);
}

export function compatibleArchetypesForPosition(
  position: PlayerPosition,
): readonly PlayerArchetype[] {
  return PLAYER_ARCHETYPES.filter((archetype) =>
    isArchetypeCompatible(archetype, position),
  );
}

/** Position baseline weights — each record covers all 19 live attributes. */
export const POSITION_ATTRIBUTE_WEIGHTS: Record<
  PlayerPosition,
  AttributeWeights
> = {
  PG: weights({
    speed: S,
    strength: W,
    athleticism: A,
    stamina: A,
    finishing: A,
    midRange: A,
    threePoint: A,
    freeThrow: S,
    ballHandling: E,
    passing: E,
    perimeterDefense: A,
    interiorDefense: W,
    steal: S,
    block: W,
    rebounding: W,
    basketballIq: S,
    offensiveIq: S,
    defensiveIq: A,
    consistency: A,
  }),
  SG: weights({
    speed: S,
    strength: A,
    athleticism: S,
    stamina: A,
    finishing: S,
    midRange: E,
    threePoint: E,
    freeThrow: S,
    ballHandling: S,
    passing: A,
    perimeterDefense: S,
    interiorDefense: W,
    steal: S,
    block: W,
    rebounding: W,
    basketballIq: A,
    offensiveIq: S,
    defensiveIq: A,
    consistency: A,
  }),
  SF: weights({
    speed: S,
    strength: A,
    athleticism: S,
    stamina: A,
    finishing: A,
    midRange: A,
    threePoint: A,
    freeThrow: A,
    ballHandling: A,
    passing: A,
    perimeterDefense: S,
    interiorDefense: A,
    steal: A,
    block: A,
    rebounding: A,
    basketballIq: A,
    offensiveIq: A,
    defensiveIq: A,
    consistency: A,
  }),
  PF: weights({
    speed: W,
    strength: E,
    athleticism: A,
    stamina: A,
    finishing: S,
    midRange: A,
    threePoint: W,
    freeThrow: A,
    ballHandling: W,
    passing: W,
    perimeterDefense: W,
    interiorDefense: E,
    steal: W,
    block: S,
    rebounding: E,
    basketballIq: A,
    offensiveIq: A,
    defensiveIq: S,
    consistency: A,
  }),
  C: weights({
    speed: W,
    strength: E,
    athleticism: A,
    stamina: A,
    finishing: S,
    midRange: W,
    threePoint: W,
    freeThrow: W,
    ballHandling: W,
    passing: W,
    perimeterDefense: W,
    interiorDefense: E,
    steal: W,
    block: E,
    rebounding: E,
    basketballIq: A,
    offensiveIq: A,
    defensiveIq: S,
    consistency: A,
  }),
};

/** Archetype modifier weights — each record covers all 19 live attributes. */
export const ARCHETYPE_ATTRIBUTE_WEIGHTS: Record<
  PlayerArchetype,
  AttributeWeights
> = {
  floor_general: weights({
    speed: A,
    strength: A,
    athleticism: A,
    stamina: A,
    finishing: A,
    midRange: A,
    threePoint: A,
    freeThrow: A,
    ballHandling: E,
    passing: E,
    perimeterDefense: A,
    interiorDefense: W,
    steal: A,
    block: W,
    rebounding: W,
    basketballIq: E,
    offensiveIq: E,
    defensiveIq: A,
    consistency: S,
  }),
  scoring_guard: weights({
    speed: A,
    strength: A,
    athleticism: S,
    stamina: A,
    finishing: E,
    midRange: E,
    threePoint: E,
    freeThrow: S,
    ballHandling: E,
    passing: S,
    perimeterDefense: A,
    interiorDefense: W,
    steal: A,
    block: W,
    rebounding: W,
    basketballIq: A,
    offensiveIq: S,
    defensiveIq: A,
    consistency: A,
  }),
  three_and_d_wing: weights({
    speed: S,
    strength: S,
    athleticism: S,
    stamina: A,
    finishing: A,
    midRange: S,
    threePoint: E,
    freeThrow: A,
    ballHandling: A,
    passing: W,
    perimeterDefense: E,
    interiorDefense: W,
    steal: S,
    block: W,
    rebounding: W,
    basketballIq: A,
    offensiveIq: A,
    defensiveIq: S,
    consistency: A,
  }),
  shot_creator: weights({
    speed: A,
    strength: A,
    athleticism: S,
    stamina: A,
    finishing: E,
    midRange: E,
    threePoint: E,
    freeThrow: S,
    ballHandling: E,
    passing: A,
    perimeterDefense: A,
    interiorDefense: W,
    steal: A,
    block: W,
    rebounding: W,
    basketballIq: S,
    offensiveIq: E,
    defensiveIq: A,
    consistency: A,
  }),
  slasher: weights({
    speed: E,
    strength: E,
    athleticism: E,
    stamina: S,
    finishing: E,
    midRange: W,
    threePoint: W,
    freeThrow: A,
    ballHandling: S,
    passing: A,
    perimeterDefense: A,
    interiorDefense: A,
    steal: A,
    block: A,
    rebounding: A,
    basketballIq: A,
    offensiveIq: A,
    defensiveIq: A,
    consistency: A,
  }),
  stretch_big: weights({
    speed: W,
    strength: E,
    athleticism: A,
    stamina: A,
    finishing: S,
    midRange: E,
    threePoint: E,
    freeThrow: S,
    ballHandling: W,
    passing: A,
    perimeterDefense: W,
    interiorDefense: A,
    steal: W,
    block: A,
    rebounding: S,
    basketballIq: A,
    offensiveIq: S,
    defensiveIq: A,
    consistency: A,
  }),
  rim_protector: weights({
    speed: A,
    strength: E,
    athleticism: E,
    stamina: A,
    finishing: S,
    midRange: W,
    threePoint: W,
    freeThrow: W,
    ballHandling: W,
    passing: W,
    perimeterDefense: A,
    interiorDefense: E,
    steal: A,
    block: E,
    rebounding: S,
    basketballIq: A,
    offensiveIq: A,
    defensiveIq: E,
    consistency: A,
  }),
  rebounding_big: weights({
    speed: W,
    strength: E,
    athleticism: S,
    stamina: A,
    finishing: S,
    midRange: W,
    threePoint: W,
    freeThrow: A,
    ballHandling: W,
    passing: A,
    perimeterDefense: W,
    interiorDefense: E,
    steal: W,
    block: S,
    rebounding: E,
    basketballIq: A,
    offensiveIq: A,
    defensiveIq: S,
    consistency: A,
  }),
  two_way_forward: weights({
    speed: S,
    strength: E,
    athleticism: E,
    stamina: S,
    finishing: S,
    midRange: A,
    threePoint: A,
    freeThrow: A,
    ballHandling: A,
    passing: A,
    perimeterDefense: E,
    interiorDefense: E,
    steal: S,
    block: S,
    rebounding: S,
    basketballIq: A,
    offensiveIq: A,
    defensiveIq: E,
    consistency: A,
  }),
};

/**
 * Additive-delta combine: position and archetype modifiers may cancel.
 * combined = 1 + (positionWeight - 1) + (archetypeWeight - 1)
 */
export function combinedAttributeWeights(
  position: PlayerPosition,
  archetype: PlayerArchetype,
): AttributeWeights {
  const positionWeights = POSITION_ATTRIBUTE_WEIGHTS[position];
  const archetypeWeights = ARCHETYPE_ATTRIBUTE_WEIGHTS[archetype];
  const result = {} as AttributeWeights;
  for (const key of Object.keys(positionWeights) as (keyof PlayerAttributes)[]) {
    result[key] =
      1 + (positionWeights[key] - 1) + (archetypeWeights[key] - 1);
  }
  return result;
}
