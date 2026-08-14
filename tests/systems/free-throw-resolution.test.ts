import { describe, expect, it, vi } from "vitest";
import type { Player } from "@/domain/entities/player";
import { createSeededRng, type Rng } from "@/domain/rng";
import { FREE_THROW_RESOLUTION_CONFIG } from "@/systems/free-throw-resolution-config";
import {
  calculateFreeThrowProbability,
  resolveFreeThrow,
  type ResolveFreeThrowInput,
} from "@/systems/free-throw-resolution";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";

function baseInput(
  overrides: Partial<ResolveFreeThrowInput> = {},
): ResolveFreeThrowInput {
  return {
    shooter: createPlayer({
      id: "ft_shooter",
      attributes: { freeThrow: 75 },
    }),
    ...overrides,
  };
}

function createStubRng(nextValues: number[]): Rng {
  let index = 0;
  const next = (): number => {
    const value = nextValues[index];
    if (value === undefined) {
      throw new Error("Stub Rng exhausted.");
    }
    index += 1;
    return value;
  };

  return {
    next,
    nextInt(): number {
      throw new Error("Stub Rng.nextInt is unused.");
    },
    pick<T>(): T {
      throw new Error("Stub Rng.pick is unused.");
    },
    chance(probability: number): boolean {
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error("Rng.chance requires a probability in [0, 1].");
      }
      return next() < probability;
    },
    getState(): number {
      return 0;
    },
  };
}

describe("FREE_THROW_RESOLUTION_CONFIG", () => {
  it("uses FT-oriented probability bounds above typical FG floors", () => {
    expect(FREE_THROW_RESOLUTION_CONFIG.minProbability).toBeGreaterThanOrEqual(
      0.3,
    );
    expect(FREE_THROW_RESOLUTION_CONFIG.maxProbability).toBeLessThanOrEqual(1);
    expect(FREE_THROW_RESOLUTION_CONFIG.maxProbability).toBeGreaterThan(
      FREE_THROW_RESOLUTION_CONFIG.minProbability,
    );
  });
});

describe("calculateFreeThrowProbability", () => {
  it("returns a probability within configured bounds", () => {
    const probability = calculateFreeThrowProbability(baseInput());
    expect(probability).toBeGreaterThanOrEqual(
      FREE_THROW_RESOLUTION_CONFIG.minProbability,
    );
    expect(probability).toBeLessThanOrEqual(
      FREE_THROW_RESOLUTION_CONFIG.maxProbability,
    );
  });

  it("increases when freeThrow rating is higher", () => {
    const weaker = calculateFreeThrowProbability(
      baseInput({
        shooter: createPlayer({
          id: "weaker",
          attributes: { freeThrow: 50 },
        }),
      }),
    );
    const stronger = calculateFreeThrowProbability(
      baseInput({
        shooter: createPlayer({
          id: "stronger",
          attributes: { freeThrow: 90 },
        }),
      }),
    );
    expect(stronger).toBeGreaterThan(weaker);
  });

  it("clamps extreme ratings to configured bounds", () => {
    const low = calculateFreeThrowProbability(
      baseInput({
        shooter: createPlayer({
          id: "low",
          attributes: { freeThrow: 1 },
        }),
      }),
    );
    const high = calculateFreeThrowProbability(
      baseInput({
        shooter: createPlayer({
          id: "high",
          attributes: { freeThrow: 99 },
        }),
      }),
    );
    expect(low).toBe(FREE_THROW_RESOLUTION_CONFIG.minProbability);
    expect(high).toBe(FREE_THROW_RESOLUTION_CONFIG.maxProbability);
  });

  it("does not require or consume RNG", () => {
    const first = calculateFreeThrowProbability(baseInput());
    const second = calculateFreeThrowProbability(baseInput());
    expect(first).toBe(second);
  });
});

describe("resolveFreeThrow", () => {
  it("is deterministic for the same input and seed", () => {
    const input = baseInput();
    const resultA = resolveFreeThrow(input, createSeededRng(12345));
    const resultB = resolveFreeThrow(input, createSeededRng(12345));
    expect(resultA).toEqual(resultB);
  });

  it("does not mutate the input shooter", () => {
    const input = baseInput();
    const snapshot = structuredClone(input);
    resolveFreeThrow(input, createTestRng());
    expect(input).toEqual(snapshot);
  });

  it("calls rng.chance exactly once", () => {
    const rng = createSeededRng(99);
    const chanceSpy = vi.spyOn(rng, "chance");
    const result = resolveFreeThrow(baseInput(), rng);
    expect(chanceSpy).toHaveBeenCalledTimes(1);
    expect(chanceSpy).toHaveBeenCalledWith(result.probability);
  });

  it("makes when the roll is below probability and misses when above", () => {
    const input = baseInput();
    const probability = calculateFreeThrowProbability(input);
    expect(probability).toBeGreaterThan(0.1);
    expect(probability).toBeLessThan(0.99);

    const made = resolveFreeThrow(input, createStubRng([probability - 0.01]));
    const missed = resolveFreeThrow(input, createStubRng([probability + 0.01]));

    expect(made.probability).toBe(probability);
    expect(missed.probability).toBe(probability);
    expect(made.made).toBe(true);
    expect(missed.made).toBe(false);
    expect(made.shooterId).toBe(input.shooter.id);
  });

  it("never calls Math.random or Date.now", () => {
    const randomSpy = vi.spyOn(Math, "random");
    const nowSpy = vi.spyOn(Date, "now");
    try {
      resolveFreeThrow(baseInput(), createTestRng());
      expect(randomSpy).not.toHaveBeenCalled();
      expect(nowSpy).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
      nowSpy.mockRestore();
    }
  });
});

describe("resolveFreeThrow validation", () => {
  it("rejects a missing shooter", () => {
    expect(() =>
      resolveFreeThrow(
        { shooter: null as unknown as Player },
        createTestRng(),
      ),
    ).toThrow(/shooter/);
  });

  it("rejects a missing rng", () => {
    expect(() =>
      resolveFreeThrow(baseInput(), null as unknown as Rng),
    ).toThrow(/Rng/);
  });

  it("rejects an invalid freeThrow rating", () => {
    const shooter = createPlayer({ id: "bad_ft" });
    shooter.attributes.freeThrow = 0;
    expect(() =>
      resolveFreeThrow(baseInput({ shooter }), createTestRng()),
    ).toThrow(/freeThrow/);
  });

  it("does not reject an invalid unused rating", () => {
    const shooter = createPlayer({ id: "bad_steal" });
    shooter.attributes.steal = 0;
    expect(() =>
      resolveFreeThrow(baseInput({ shooter }), createTestRng()),
    ).not.toThrow();
  });
});
