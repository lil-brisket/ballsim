import {
  PORTRAIT_TRAIT_CARDINALITY,
  type PortraitTraits,
} from "@/domain/entities/player-portrait";
import type { PortraitLibraryEntry } from "@/domain/portrait-library";
import { derivePortraitTraits } from "@/systems/portraits/assign-player-portraits";
import {
  nearestPortraitEntry,
  PORTRAIT_MATCH_WEIGHTS,
} from "@/systems/portraits/nearest-portrait";

/**
 * Coverage validation: does the library depict what player generation
 * produces? Player traits are drawn uniformly per dimension, so each trait
 * value should be about 1/cardinality of the library, and sampled players
 * should rarely land on an image that differs from them on a major trait.
 * Offline tooling and tests only; pure and deterministic.
 */

export type MatchedTrait = keyof typeof PORTRAIT_MATCH_WEIGHTS;

const MATCHED_TRAITS = Object.keys(PORTRAIT_MATCH_WEIGHTS) as MatchedTrait[];

export type TraitCoverageGap = {
  trait: MatchedTrait;
  value: number;
  libraryShare: number;
  expectedShare: number;
  /** libraryShare / expectedShare */
  ratio: number;
};

export type PortraitCoverageOptions = {
  /** Players sampled from the generator's distribution. */
  samples?: number;
  /** A value is a gap when its library share is below this fraction of expected. */
  minShareRatio?: number;
  /** Largest tolerated share of sampled players mismatched on a trait. */
  maxMismatchRate?: Partial<Record<MatchedTrait, number>>;
};

export type PortraitCoverageReport = {
  entries: number;
  samples: number;
  gaps: TraitCoverageGap[];
  /** Share of sampled players whose nearest image differs on the trait. */
  mismatchRate: Record<MatchedTrait, number>;
  meanDistance: number;
  problems: string[];
};

export const DEFAULT_MIN_SHARE_RATIO = 0.6;
export const DEFAULT_COVERAGE_SAMPLES = 2000;

/** Calibrated on the planned 800-entry library; a skewed library trips these. */
export const DEFAULT_MAX_MISMATCH_RATE: Record<MatchedTrait, number> = {
  skinTone: 0.2,
  hairStyle: 0.25,
  hairColor: 0.35,
  facialHair: 0.2,
  faceShape: 0.3,
  brows: 1,
  eyes: 1,
  nose: 1,
  mouth: 1,
};

/** Ordinal traits only count as mismatched when two or more steps apart. */
const ORDINAL: ReadonlySet<MatchedTrait> = new Set(["skinTone", "hairColor"]);

function differs(
  trait: MatchedTrait,
  player: PortraitTraits,
  entry: PortraitLibraryEntry,
): boolean {
  if (
    trait === "hairColor" &&
    (player.hairStyle === 0 || entry.traits.hairStyle === 0)
  ) {
    return false;
  }
  const delta = Math.abs(player[trait] - entry.traits[trait]);
  return ORDINAL.has(trait) ? delta >= 2 : delta !== 0;
}

export function evaluatePortraitCoverage(
  library: readonly PortraitLibraryEntry[],
  options: PortraitCoverageOptions = {},
): PortraitCoverageReport {
  const samples = options.samples ?? DEFAULT_COVERAGE_SAMPLES;
  const minRatio = options.minShareRatio ?? DEFAULT_MIN_SHARE_RATIO;
  const limits = { ...DEFAULT_MAX_MISMATCH_RATE, ...options.maxMismatchRate };

  const gaps: TraitCoverageGap[] = [];
  for (const trait of MATCHED_TRAITS) {
    if (PORTRAIT_MATCH_WEIGHTS[trait] < 4) continue; // minor traits don't gate coverage
    const cardinality = PORTRAIT_TRAIT_CARDINALITY[trait];
    const counts = Array.from({ length: cardinality }, () => 0);
    let counted = 0;
    for (const entry of library) {
      // A shaved head has no meaningful hair colour.
      if (trait === "hairColor" && entry.traits.hairStyle === 0) continue;
      counts[entry.traits[trait]]! += 1;
      counted += 1;
    }
    counts.forEach((count, value) => {
      const expectedShare = 1 / cardinality;
      const libraryShare = counted === 0 ? 0 : count / counted;
      const ratio = libraryShare / expectedShare;
      if (ratio < minRatio) {
        gaps.push({ trait, value, libraryShare, expectedShare, ratio });
      }
    });
  }

  const mismatches = Object.fromEntries(
    MATCHED_TRAITS.map((trait) => [trait, 0]),
  ) as Record<MatchedTrait, number>;
  let totalDistance = 0;
  let matched = 0;
  for (let index = 0; index < samples; index += 1) {
    const player = derivePortraitTraits("coverage", `sample_${index}`, 0);
    const nearest = nearestPortraitEntry(player, library);
    if (nearest === null) continue;
    matched += 1;
    totalDistance += nearest.distance;
    for (const trait of MATCHED_TRAITS) {
      if (differs(trait, player, nearest.entry)) mismatches[trait] += 1;
    }
  }
  const mismatchRate = Object.fromEntries(
    MATCHED_TRAITS.map((trait) => [
      trait,
      matched === 0 ? 1 : mismatches[trait] / matched,
    ]),
  ) as Record<MatchedTrait, number>;

  const problems: string[] = [];
  if (library.length === 0) {
    problems.push("library is empty.");
  }
  for (const gap of gaps) {
    problems.push(
      `${gap.trait} ${gap.value} is under-represented: ${(gap.libraryShare * 100).toFixed(1)}% of the library vs ${(gap.expectedShare * 100).toFixed(1)}% of generated players.`,
    );
  }
  for (const trait of MATCHED_TRAITS) {
    if (library.length > 0 && mismatchRate[trait] > limits[trait]) {
      problems.push(
        `${(mismatchRate[trait] * 100).toFixed(1)}% of generated players are matched to an image that differs on ${trait} (limit ${(limits[trait] * 100).toFixed(0)}%).`,
      );
    }
  }
  return {
    entries: library.length,
    samples: matched,
    gaps,
    mismatchRate,
    meanDistance: matched === 0 ? 0 : totalDistance / matched,
    problems,
  };
}
