import { describe, expect, it, vi } from "vitest";
import { RATING_MAX, RATING_MIN, type Player } from "@/domain/entities/player";
import { createSeededRng, type Rng } from "@/domain/rng";
import { PASS_RESOLUTION_CONFIG } from "@/systems/pass-resolution-config";
import {
  calculatePassProbabilities,
  resolvePass,
  type ResolvePassInput,
} from "@/systems/pass-resolution";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";

function baseInput(
  overrides: Partial<ResolvePassInput> = {},
): ResolvePassInput {
  return {
    passer: createPlayer({
      id: "passer_a",
      attributes: {
        passing: 70,
        ballHandling: 70,
      },
    }),
    receiver: createPlayer({
      id: "receiver_a",
      attributes: {
        passing: 70,
        ballHandling: 70,
      },
    }),
    defensivePressure: 70,
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

function createCountingRng(nextValues: number[]): {
  rng: Rng;
  chanceCallCount: () => number;
} {
  const inner = createStubRng(nextValues);
  let chanceCalls = 0;

  return {
    rng: {
      next: inner.next,
      nextInt: inner.nextInt,
      pick: inner.pick,
      chance(probability: number): boolean {
        chanceCalls += 1;
        return inner.chance(probability);
      },
      getState: inner.getState,
    },
    chanceCallCount: () => chanceCalls,
  };
}

describe("PASS_RESOLUTION_CONFIG", () => {
  it("keeps pass-success bounds inside (0, 1]", () => {
    expect(PASS_RESOLUTION_CONFIG.minPassSuccess).toBeGreaterThan(0);
    expect(PASS_RESOLUTION_CONFIG.maxPassSuccess).toBeLessThanOrEqual(1);
    expect(PASS_RESOLUTION_CONFIG.minPassSuccess).toBeLessThan(
      PASS_RESOLUTION_CONFIG.maxPassSuccess,
    );
  });

  it("keeps assist-opportunity bounds inside (0, 1]", () => {
    expect(PASS_RESOLUTION_CONFIG.minAssist).toBeGreaterThan(0);
    expect(PASS_RESOLUTION_CONFIG.maxAssist).toBeLessThanOrEqual(1);
    expect(PASS_RESOLUTION_CONFIG.minAssist).toBeLessThan(
      PASS_RESOLUTION_CONFIG.maxAssist,
    );
  });
});

describe("calculatePassProbabilities", () => {
  it("returns probabilities within configured bounds", () => {
    const probabilities = calculatePassProbabilities(baseInput());
    expect(probabilities.passSuccessProbability).toBeGreaterThanOrEqual(
      PASS_RESOLUTION_CONFIG.minPassSuccess,
    );
    expect(probabilities.passSuccessProbability).toBeLessThanOrEqual(
      PASS_RESOLUTION_CONFIG.maxPassSuccess,
    );
    expect(probabilities.assistProbability).toBeGreaterThanOrEqual(
      PASS_RESOLUTION_CONFIG.minAssist,
    );
    expect(probabilities.assistProbability).toBeLessThanOrEqual(
      PASS_RESOLUTION_CONFIG.maxAssist,
    );
  });

  it("derives turnoverProbability exactly as 1 - passSuccessProbability", () => {
    const probabilities = calculatePassProbabilities(baseInput());
    expect(probabilities.turnoverProbability).toBe(
      1 - probabilities.passSuccessProbability,
    );
    expect(
      probabilities.passSuccessProbability + probabilities.turnoverProbability,
    ).toBe(1);
  });

  it("does not require or consume RNG", () => {
    const first = calculatePassProbabilities(baseInput());
    const second = calculatePassProbabilities(baseInput());
    expect(first).toEqual(second);
  });

  it("increases pass success when passing is higher", () => {
    const weaker = calculatePassProbabilities(
      baseInput({
        passer: createPlayer({
          id: "weaker",
          attributes: { passing: 50, ballHandling: 70 },
        }),
      }),
    );
    const stronger = calculatePassProbabilities(
      baseInput({
        passer: createPlayer({
          id: "stronger",
          attributes: { passing: 90, ballHandling: 70 },
        }),
      }),
    );
    expect(stronger.passSuccessProbability).toBeGreaterThan(
      weaker.passSuccessProbability,
    );
  });

  it("increases pass success when ball handling is higher", () => {
    const weaker = calculatePassProbabilities(
      baseInput({
        passer: createPlayer({
          id: "weaker_hands",
          attributes: { passing: 70, ballHandling: 40 },
        }),
      }),
    );
    const stronger = calculatePassProbabilities(
      baseInput({
        passer: createPlayer({
          id: "stronger_hands",
          attributes: { passing: 70, ballHandling: 90 },
        }),
      }),
    );
    expect(stronger.passSuccessProbability).toBeGreaterThan(
      weaker.passSuccessProbability,
    );
  });

  it("decreases pass success when defensive pressure is higher", () => {
    const lowPressure = calculatePassProbabilities(
      baseInput({ defensivePressure: 30 }),
    );
    const highPressure = calculatePassProbabilities(
      baseInput({ defensivePressure: 95 }),
    );
    expect(highPressure.passSuccessProbability).toBeLessThan(
      lowPressure.passSuccessProbability,
    );
  });

  it("increases assist-opportunity probability when passing is higher", () => {
    const weaker = calculatePassProbabilities(
      baseInput({
        passer: createPlayer({
          id: "weaker_assist",
          attributes: { passing: 40, ballHandling: 70 },
        }),
      }),
    );
    const stronger = calculatePassProbabilities(
      baseInput({
        passer: createPlayer({
          id: "stronger_assist",
          attributes: { passing: 95, ballHandling: 70 },
        }),
      }),
    );
    expect(stronger.assistProbability).toBeGreaterThan(weaker.assistProbability);
  });

  it("does not set assistProbability equal to passSuccessProbability", () => {
    const probabilities = calculatePassProbabilities(baseInput());
    expect(probabilities.assistProbability).not.toBe(
      probabilities.passSuccessProbability,
    );
  });

  it("keeps extreme valid ratings within bounds", () => {
    const worst = calculatePassProbabilities(
      baseInput({
        passer: createPlayer({
          id: "worst",
          attributes: { passing: RATING_MIN, ballHandling: RATING_MIN },
        }),
        defensivePressure: RATING_MAX,
      }),
    );
    const best = calculatePassProbabilities(
      baseInput({
        passer: createPlayer({
          id: "best",
          attributes: { passing: RATING_MAX, ballHandling: RATING_MAX },
        }),
        defensivePressure: RATING_MIN,
      }),
    );

    for (const probabilities of [worst, best]) {
      expect(probabilities.passSuccessProbability).toBeGreaterThanOrEqual(
        PASS_RESOLUTION_CONFIG.minPassSuccess,
      );
      expect(probabilities.passSuccessProbability).toBeLessThanOrEqual(
        PASS_RESOLUTION_CONFIG.maxPassSuccess,
      );
      expect(probabilities.assistProbability).toBeGreaterThanOrEqual(
        PASS_RESOLUTION_CONFIG.minAssist,
      );
      expect(probabilities.assistProbability).toBeLessThanOrEqual(
        PASS_RESOLUTION_CONFIG.maxAssist,
      );
      expect(probabilities.turnoverProbability).toBe(
        1 - probabilities.passSuccessProbability,
      );
    }
  });

  it("stays in bounds at RATING_MIN, midpoint, and RATING_MAX", () => {
    const midpoint = 50;
    const ratings = [RATING_MIN, midpoint, RATING_MAX];

    for (const passing of ratings) {
      for (const ballHandling of ratings) {
        for (const defensivePressure of ratings) {
          const probabilities = calculatePassProbabilities(
            baseInput({
              passer: createPlayer({
                id: `p_${passing}_${ballHandling}_${defensivePressure}`,
                attributes: { passing, ballHandling },
              }),
              defensivePressure,
            }),
          );
          expect(probabilities.passSuccessProbability).toBeGreaterThanOrEqual(
            PASS_RESOLUTION_CONFIG.minPassSuccess,
          );
          expect(probabilities.passSuccessProbability).toBeLessThanOrEqual(
            PASS_RESOLUTION_CONFIG.maxPassSuccess,
          );
          expect(probabilities.assistProbability).toBeGreaterThanOrEqual(
            PASS_RESOLUTION_CONFIG.minAssist,
          );
          expect(probabilities.assistProbability).toBeLessThanOrEqual(
            PASS_RESOLUTION_CONFIG.maxAssist,
          );
          expect(
            probabilities.passSuccessProbability +
              probabilities.turnoverProbability,
          ).toBe(1);
        }
      }
    }
  });

  it("does not use receiver ratings", () => {
    const receiver = createPlayer({ id: "receiver_unused" });
    receiver.attributes.passing = 0;
    receiver.attributes.ballHandling = 0;
    expect(() =>
      calculatePassProbabilities(baseInput({ receiver })),
    ).not.toThrow();
  });
});

describe("resolvePass", () => {
  it("is deterministic for the same input and seed", () => {
    const input = baseInput();
    const resultA = resolvePass(input, createSeededRng(12345));
    const resultB = resolvePass(input, createSeededRng(12345));
    expect(resultA).toEqual(resultB);
  });

  it("does not mutate the input players", () => {
    const input = baseInput();
    const snapshot = structuredClone(input);
    resolvePass(input, createTestRng());
    expect(input).toEqual(snapshot);
  });

  it("never calls Math.random or Date.now", () => {
    const randomSpy = vi.spyOn(Math, "random");
    const nowSpy = vi.spyOn(Date, "now");
    try {
      resolvePass(baseInput(), createTestRng());
      expect(randomSpy).not.toHaveBeenCalled();
      expect(nowSpy).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
      nowSpy.mockRestore();
    }
  });

  it("completes when the pass roll is below probability and turns over when above", () => {
    const input = baseInput();
    const probabilities = calculatePassProbabilities(input);
    expect(probabilities.passSuccessProbability).toBeGreaterThan(0.1);
    expect(probabilities.passSuccessProbability).toBeLessThan(0.9);

    const completed = resolvePass(
      input,
      createStubRng([probabilities.passSuccessProbability - 0.01, 1]),
    );
    const turnover = resolvePass(
      input,
      createStubRng([probabilities.passSuccessProbability + 0.01]),
    );

    expect(completed.outcome).toBe("complete");
    expect(turnover.outcome).toBe("turnover");
    expect(completed.passSuccessProbability).toBe(
      probabilities.passSuccessProbability,
    );
    expect(turnover.passSuccessProbability).toBe(
      probabilities.passSuccessProbability,
    );
  });

  it("never treats a completed pass as a turnover", () => {
    const input = baseInput();
    const probabilities = calculatePassProbabilities(input);
    const result = resolvePass(
      input,
      createStubRng([probabilities.passSuccessProbability - 0.01, 0.99]),
    );
    expect(result.outcome).toBe("complete");
    expect(result.outcome).not.toBe("turnover");
  });

  it("can produce an assist opportunity only after a completed pass", () => {
    const input = baseInput();
    const probabilities = calculatePassProbabilities(input);
    const withOpportunity = resolvePass(
      input,
      createStubRng([0, probabilities.assistProbability - 0.01]),
    );
    const withoutOpportunity = resolvePass(
      input,
      createStubRng([0, probabilities.assistProbability + 0.01]),
    );

    expect(withOpportunity.outcome).toBe("complete");
    expect(withOpportunity.assistOpportunity).toBe(true);
    expect(withoutOpportunity.outcome).toBe("complete");
    expect(withoutOpportunity.assistOpportunity).toBe(false);
  });

  it("does not treat assistOpportunity as a credited box-score assist", () => {
    const input = baseInput();
    const result = resolvePass(input, createStubRng([0, 0]));
    expect(result.outcome).toBe("complete");
    expect(result.assistOpportunity).toBe(true);
    expect(result).not.toHaveProperty("assists");
  });

  it("never sets assistOpportunity on a turnover", () => {
    const input = baseInput();
    const probabilities = calculatePassProbabilities(input);
    const result = resolvePass(
      input,
      createStubRng([probabilities.passSuccessProbability + 0.01]),
    );
    expect(result.outcome).toBe("turnover");
    expect(result.assistOpportunity).toBe(false);
  });

  it("consumes exactly one RNG chance roll on a turnover", () => {
    const input = baseInput();
    const probabilities = calculatePassProbabilities(input);
    const { rng, chanceCallCount } = createCountingRng([
      probabilities.passSuccessProbability + 0.01,
    ]);
    const result = resolvePass(input, rng);
    expect(result.outcome).toBe("turnover");
    expect(chanceCallCount()).toBe(1);
  });

  it("consumes a second RNG chance roll only when the pass completes", () => {
    const input = baseInput();
    const { rng, chanceCallCount } = createCountingRng([0, 0.5]);
    const result = resolvePass(input, rng);
    expect(result.outcome).toBe("complete");
    expect(chanceCallCount()).toBe(2);
  });

  it("does not consume the assist RNG roll after a turnover", () => {
    const input = baseInput();
    const probabilities = calculatePassProbabilities(input);
    const { rng, chanceCallCount } = createCountingRng([
      probabilities.passSuccessProbability + 0.01,
      0,
    ]);
    const result = resolvePass(input, rng);
    expect(result.outcome).toBe("turnover");
    expect(result.assistOpportunity).toBe(false);
    expect(chanceCallCount()).toBe(1);
  });

  it("returns probabilities within configured bounds", () => {
    const result = resolvePass(
      baseInput({ defensivePressure: RATING_MAX }),
      createTestRng(),
    );
    expect(result.passSuccessProbability).toBeGreaterThanOrEqual(
      PASS_RESOLUTION_CONFIG.minPassSuccess,
    );
    expect(result.passSuccessProbability).toBeLessThanOrEqual(
      PASS_RESOLUTION_CONFIG.maxPassSuccess,
    );
    expect(result.turnoverProbability).toBe(1 - result.passSuccessProbability);
  });
});

describe("resolvePass validation", () => {
  it("rejects a missing passer", () => {
    expect(() =>
      resolvePass(
        {
          ...baseInput(),
          passer: null as unknown as Player,
        },
        createTestRng(),
      ),
    ).toThrow(/passer/);
  });

  it("rejects a missing receiver", () => {
    expect(() =>
      resolvePass(
        {
          ...baseInput(),
          receiver: null as unknown as Player,
        },
        createTestRng(),
      ),
    ).toThrow(/receiver/);
  });

  it("rejects the same passer and receiver", () => {
    const passer = createPlayer({ id: "same_player" });
    expect(() =>
      resolvePass(
        baseInput({ passer, receiver: passer }),
        createTestRng(),
      ),
    ).toThrow(/different/);
  });

  it("rejects passing below RATING_MIN", () => {
    const passer = createPlayer({ id: "bad_passing_low" });
    passer.attributes.passing = RATING_MIN - 1;
    expect(() =>
      resolvePass(baseInput({ passer }), createTestRng()),
    ).toThrow(/passing/);
  });

  it("rejects passing above RATING_MAX", () => {
    const passer = createPlayer({ id: "bad_passing_high" });
    passer.attributes.passing = RATING_MAX + 1;
    expect(() =>
      resolvePass(baseInput({ passer }), createTestRng()),
    ).toThrow(/passing/);
  });

  it("rejects ball handling below RATING_MIN", () => {
    const passer = createPlayer({ id: "bad_handling_low" });
    passer.attributes.ballHandling = 0;
    expect(() =>
      resolvePass(baseInput({ passer }), createTestRng()),
    ).toThrow(/ballHandling/);
  });

  it("rejects ball handling above RATING_MAX", () => {
    const passer = createPlayer({ id: "bad_handling_high" });
    passer.attributes.ballHandling = 100;
    expect(() =>
      resolvePass(baseInput({ passer }), createTestRng()),
    ).toThrow(/ballHandling/);
  });

  it("rejects defensive pressure outside rating bounds", () => {
    expect(() =>
      resolvePass(baseInput({ defensivePressure: 0 }), createTestRng()),
    ).toThrow(/defensivePressure/);
    expect(() =>
      resolvePass(baseInput({ defensivePressure: 100 }), createTestRng()),
    ).toThrow(/defensivePressure/);
    expect(() =>
      resolvePass(baseInput({ defensivePressure: 70.5 }), createTestRng()),
    ).toThrow(/defensivePressure/);
  });

  it("does not reject an invalid unused passer rating", () => {
    const passer = createPlayer({ id: "bad_steal" });
    passer.attributes.steal = 0;
    expect(() =>
      resolvePass(baseInput({ passer }), createTestRng()),
    ).not.toThrow();
  });
});
