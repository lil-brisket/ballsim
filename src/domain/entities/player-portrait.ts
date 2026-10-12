/**
 * Persisted procedural portrait identity for one player in one save.
 * Traits are indices into presentation layers; they never change once
 * assigned (not tied to age, ratings, team, or contract).
 */

export const PORTRAIT_GENERATOR_VERSION = 1;

export const PORTRAIT_TRAIT_KEYS = [
  "skinTone",
  "faceShape",
  "hairStyle",
  "hairColor",
  "facialHair",
  "brows",
  "eyes",
  "nose",
  "mouth",
  "ears",
  "accessory",
] as const;

export type PortraitTraitKey = (typeof PORTRAIT_TRAIT_KEYS)[number];

export type PortraitTraits = Record<PortraitTraitKey, number>;

export type PortraitTraitCardinality = Record<PortraitTraitKey, number>;

/** v1 option counts per trait (~84M combinations). */
export const PORTRAIT_TRAIT_CARDINALITY: PortraitTraitCardinality = {
  skinTone: 10,
  faceShape: 4,
  hairStyle: 14,
  hairColor: 7,
  facialHair: 7,
  brows: 4,
  eyes: 4,
  nose: 4,
  mouth: 4,
  ears: 3,
  accessory: 4,
};

export type PlayerPortraitAssignment = {
  version: typeof PORTRAIT_GENERATOR_VERSION;
  traits: PortraitTraits;
  /** Collision-avoidance probe that produced these traits. */
  salt: number;
  /** Set when the trait space was exhausted and a duplicate was accepted. */
  duplicate?: true;
};

export function portraitCapacity(
  cardinality: PortraitTraitCardinality = PORTRAIT_TRAIT_CARDINALITY,
): number {
  let total = 1;
  for (const key of PORTRAIT_TRAIT_KEYS) {
    total *= cardinality[key];
  }
  return total;
}

export function portraitTraitSignature(traits: PortraitTraits): string {
  return PORTRAIT_TRAIT_KEYS.map((key) => traits[key]).join(".");
}

export function isValidPortraitAssignment(
  value: unknown,
): value is PlayerPortraitAssignment {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.version !== PORTRAIT_GENERATOR_VERSION) {
    return false;
  }
  if (!Number.isInteger(record.salt) || (record.salt as number) < 0) {
    return false;
  }
  if (record.duplicate !== undefined && record.duplicate !== true) {
    return false;
  }
  const traits = record.traits;
  if (traits === null || typeof traits !== "object") {
    return false;
  }
  const traitRecord = traits as Record<string, unknown>;
  for (const key of PORTRAIT_TRAIT_KEYS) {
    const index = traitRecord[key];
    if (
      !Number.isInteger(index) ||
      (index as number) < 0 ||
      (index as number) >= PORTRAIT_TRAIT_CARDINALITY[key]
    ) {
      return false;
    }
  }
  return true;
}
