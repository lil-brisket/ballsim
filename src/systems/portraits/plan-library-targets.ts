import {
  PORTRAIT_TRAIT_CARDINALITY,
  portraitTraitSignature,
  type PortraitTraits,
} from "@/domain/entities/player-portrait";
import type { PortraitLibraryTraits } from "@/domain/portrait-library";
import { portraitHash } from "@/presentation/portrait-hash";

/**
 * Plans which trait combinations the shared library should depict, so
 * coverage is designed rather than random. Offline tooling only: pure,
 * deterministic, FNV-1a/xorshift (never the simulation RNG).
 *
 * Every trait is planned uniformly because player generation draws every trait
 * uniformly: the library mirrors what the game produces (it never reshapes
 * player generation to suit the library). Each planned trait runs its own deficit-round-robin sequence, so every
 * prefix of the plan is balanced and growing the library keeps earlier
 * entries unchanged (plan(100) is the first 100 of plan(800)).
 */

export const DEFAULT_PORTRAIT_LIBRARY_SEED = "ballsim-portrait-library-v1";
export const DEFAULT_PORTRAIT_LIBRARY_SIZE = 800;

export type LibraryTarget = { id: string; traits: PortraitLibraryTraits };

const PLANNED_KEYS = [
  "skinTone",
  "faceShape",
  "hairStyle",
  "hairColor",
  "facialHair",
  "brows",
  "eyes",
  "nose",
  "mouth",
] as const;

type PlannedKey = (typeof PLANNED_KEYS)[number];

function xorshift32(value: number): number {
  let x = value === 0 ? 0x9e3779b9 : value;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function sharesFor(key: PlannedKey): readonly number[] {
  const cardinality = PORTRAIT_TRAIT_CARDINALITY[key];
  return Array.from({ length: cardinality }, () => 1 / cardinality);
}

/** Picks the most under-represented value each call; ties broken by a seeded jitter. */
function createSequence(seed: string, key: PlannedKey): () => number {
  const shares = sharesFor(key);
  const counts = shares.map(() => 0);
  let state = portraitHash(`${seed}:${key}`);
  let drawn = 0;
  return () => {
    drawn += 1;
    let best = 0;
    let bestScore = -Infinity;
    shares.forEach((share, value) => {
      state = xorshift32(state);
      const jitter = (state / 0xffffffff) * 1e-3;
      const score = share * drawn - counts[value]! + jitter;
      if (score > bestScore) {
        bestScore = score;
        best = value;
      }
    });
    counts[best] = (counts[best] ?? 0) + 1;
    return best;
  };
}

export function libraryTargetId(index: number): string {
  return `p${String(index + 1).padStart(4, "0")}`;
}

export function planLibraryTargets(
  count: number,
  seed: string = DEFAULT_PORTRAIT_LIBRARY_SEED,
): LibraryTarget[] {
  const next = Object.fromEntries(
    PLANNED_KEYS.map((key) => [key, createSequence(seed, key)]),
  ) as Record<PlannedKey, () => number>;
  const seen = new Set<string>();
  const targets: LibraryTarget[] = [];
  for (let index = 0; index < count; index += 1) {
    const traits = {} as Record<PlannedKey, number>;
    for (const key of PLANNED_KEYS) {
      // A shaved head has no hair colour; it must not consume a colour slot.
      if (key === "hairColor" && traits.hairStyle === 0) {
        traits.hairColor = 0;
        continue;
      }
      traits[key] = next[key]();
    }
    // Identical full signatures are vanishingly rare; nudge a minor trait.
    for (let nudge = 0; ; nudge += 1) {
      const signature = portraitTraitSignature({
        ...traits,
        ears: 0,
        accessory: 0,
      } as PortraitTraits);
      if (!seen.has(signature)) {
        seen.add(signature);
        break;
      }
      traits.eyes = (traits.eyes + 1) % PORTRAIT_TRAIT_CARDINALITY.eyes;
      if (nudge % PORTRAIT_TRAIT_CARDINALITY.eyes === 3) {
        traits.nose = (traits.nose + 1) % PORTRAIT_TRAIT_CARDINALITY.nose;
      }
    }
    targets.push({ id: libraryTargetId(index), traits: { ...traits } });
  }
  return targets;
}
