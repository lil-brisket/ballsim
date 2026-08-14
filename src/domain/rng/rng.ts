/**
 * Injected randomness for stochastic systems.
 * Never call Math.random() from simulation code.
 */
export type Rng = {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Inclusive integer range. */
  nextInt(minInclusive: number, maxInclusive: number): number;
  /** Uniform pick from a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** True with the given probability in [0, 1]. */
  chance(probability: number): boolean;
  /** Current seed/state token for debugging. */
  getState(): number;
};

const INTEGER_STRING_PATTERN = /^-?\d+$/;

/**
 * Normalize a seed to a uint32 for Mulberry32.
 *
 * - Finite number → `seed >>> 0`
 * - Canonical integer string (including leading zeros) → `Number(seed) >>> 0`
 * - Any other string → FNV-1a 32-bit hash of UTF-16 code units
 */
export function normalizeSeed(seed: number | string): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new Error("Rng seed must be a finite number.");
    }
    return seed >>> 0;
  }

  if (INTEGER_STRING_PATTERN.test(seed)) {
    return Number(seed) >>> 0;
  }

  return fnv1a32(seed);
}

/**
 * FNV-1a 32-bit hash over UTF-16 code units (stable, no Math.random / Date).
 */
function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 — small seeded PRNG suitable for deterministic tests.
 */
export function createSeededRng(seed: number | string): Rng {
  let state = normalizeSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const nextInt = (minInclusive: number, maxInclusive: number): number => {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error("Rng.nextInt requires integer bounds.");
    }
    if (maxInclusive < minInclusive) {
      throw new Error("Rng.nextInt maxInclusive must be >= minInclusive.");
    }
    const span = maxInclusive - minInclusive + 1;
    return minInclusive + Math.floor(next() * span);
  };

  return {
    next,
    nextInt,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("Rng.pick requires a non-empty list.");
      }
      return items[nextInt(0, items.length - 1)]!;
    },
    chance(probability: number): boolean {
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error("Rng.chance requires a probability in [0, 1].");
      }
      return next() < probability;
    },
    getState(): number {
      return state;
    },
  };
}
