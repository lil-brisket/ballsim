/**
 * Injected randomness for stochastic systems.
 * Never call Math.random() from simulation code.
 */
export type Rng = {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Inclusive integer range. */
  nextInt(minInclusive: number, maxInclusive: number): number;
  /** Current seed/state token for debugging. */
  getState(): number;
};

/**
 * Mulberry32 — small seeded PRNG suitable for deterministic tests.
 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt(minInclusive: number, maxInclusive: number): number {
      if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
        throw new Error("Rng.nextInt requires integer bounds.");
      }
      if (maxInclusive < minInclusive) {
        throw new Error("Rng.nextInt maxInclusive must be >= minInclusive.");
      }
      const span = maxInclusive - minInclusive + 1;
      return minInclusive + Math.floor(next() * span);
    },
    getState(): number {
      return state;
    },
  };
}
