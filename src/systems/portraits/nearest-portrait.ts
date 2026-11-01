import {
  portraitTraitSignature,
  type PortraitTraits,
} from "@/domain/entities/player-portrait";
import type { PortraitLibraryEntry } from "@/domain/portrait-library";
import { portraitHash } from "@/presentation/portrait-hash";

/**
 * Pure nearest-image lookup: maps persisted portrait traits to the library
 * entry that looks most like them. Presentation only; ties are broken with the
 * FNV-1a presentation hash, never the simulation RNG.
 */

/** Cost of a total mismatch per trait. Ears and accessory are ignored. */
export const PORTRAIT_MATCH_WEIGHTS = {
  skinTone: 6,
  hairStyle: 6,
  facialHair: 6,
  hairColor: 4,
  faceShape: 4,
  brows: 1,
  eyes: 1,
  nose: 1,
  mouth: 1,
} as const;

type WeightedTrait = keyof typeof PORTRAIT_MATCH_WEIGHTS;

const WEIGHTED_TRAITS = Object.keys(PORTRAIT_MATCH_WEIGHTS) as WeightedTrait[];

/**
 * Shade and hair colour run light-to-dark, so near values cost less. The cost
 * reaches a full miss this many steps away (skin tone is the most visible
 * trait, so it saturates fastest).
 */
const ORDINAL_SPAN: Partial<Record<WeightedTrait, number>> = {
  skinTone: 3,
  hairColor: 4,
};

/** Facial-hair variants that read alike: none / stubble / mustache-like / beard-like. */
const FACIAL_HAIR_GROUP = [0, 1, 2, 2, 3, 3, 3] as const;
/** Distinct styles (stubble, mustache, chin strap, goatee, full beard) stay distinct: a near-group fallback still costs most of a miss. */
const FACIAL_HAIR_WITHIN_GROUP = 0.6;

/** Distances are integers (thousandths of a weight) so ties are exact. */
const SCALE = 1000;

export type PortraitMatchTarget = Pick<PortraitTraits, WeightedTrait>;

function traitCost(
  trait: WeightedTrait,
  target: PortraitMatchTarget,
  entry: PortraitMatchTarget,
): number {
  const weight = PORTRAIT_MATCH_WEIGHTS[trait];
  const a = target[trait];
  const b = entry[trait];
  if (a === b) return 0;
  const span = ORDINAL_SPAN[trait];
  if (span !== undefined) {
    if (
      trait === "hairColor" &&
      (target.hairStyle === 0 || entry.hairStyle === 0)
    ) {
      return 0; // a shaved head has no meaningful hair colour
    }
    return Math.round(weight * SCALE * Math.min(1, Math.abs(a - b) / span));
  }
  if (trait === "facialHair") {
    return FACIAL_HAIR_GROUP[a] === FACIAL_HAIR_GROUP[b]
      ? Math.round(weight * SCALE * FACIAL_HAIR_WITHIN_GROUP)
      : weight * SCALE;
  }
  return weight * SCALE;
}

/** Weighted trait distance; 0 means the entry matches on every weighted trait. */
export function portraitDistance(
  target: PortraitMatchTarget,
  entry: PortraitLibraryEntry,
): number {
  let total = 0;
  for (const trait of WEIGHTED_TRAITS) {
    total += traitCost(trait, target, entry.traits);
  }
  return total;
}

export type RankedPortraitEntry = {
  entry: PortraitLibraryEntry;
  distance: number;
};

export type NearestPortraitOptions = {
  /** Entries to skip (already used, etc.). */
  exclude?: (entryId: string) => boolean;
  /** Seed for the stable tie-break; defaults to the target's trait signature. */
  tieBreakKey?: string;
};

type Scored = RankedPortraitEntry & { tie: number };

function tieBreakKeyOf(
  target: PortraitMatchTarget,
  options: NearestPortraitOptions,
): string {
  if (options.tieBreakKey !== undefined) return options.tieBreakKey;
  return portraitTraitSignature(target as PortraitTraits);
}

function compareScored(a: Scored, b: Scored): number {
  if (a.distance !== b.distance) return a.distance - b.distance;
  if (a.tie !== b.tie) return a.tie - b.tie;
  return a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0;
}

/** Every library entry, nearest first. Deterministic for a given target. */
export function rankPortraitLibrary(
  target: PortraitMatchTarget,
  library: readonly PortraitLibraryEntry[],
  options: NearestPortraitOptions = {},
): RankedPortraitEntry[] {
  const key = tieBreakKeyOf(target, options);
  return library
    .filter((entry) => options.exclude?.(entry.id) !== true)
    .map((entry) => ({
      entry,
      distance: portraitDistance(target, entry),
      tie: portraitHash(`${key}:${entry.id}`),
    }))
    .sort(compareScored)
    .map(({ entry, distance }) => ({ entry, distance }));
}

/** The single nearest entry, or null when the library (minus exclusions) is empty. */
export function nearestPortraitEntry(
  target: PortraitMatchTarget,
  library: readonly PortraitLibraryEntry[],
  options: NearestPortraitOptions = {},
): RankedPortraitEntry | null {
  const key = tieBreakKeyOf(target, options);
  let best: Scored | null = null;
  for (const entry of library) {
    if (options.exclude?.(entry.id) === true) continue;
    const distance = portraitDistance(target, entry);
    if (best !== null && distance > best.distance) continue;
    const candidate: Scored = {
      entry,
      distance,
      tie: portraitHash(`${key}:${entry.id}`),
    };
    if (best === null || compareScored(candidate, best) < 0) {
      best = candidate;
    }
  }
  return best === null ? null : { entry: best.entry, distance: best.distance };
}
