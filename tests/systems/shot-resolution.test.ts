import { describe, expect, it, vi } from "vitest";
import type { Player } from "@/domain/entities/player";
import { createSeededRng, type Rng } from "@/domain/rng";
import {
  BLOCK_RESOLUTION_CONFIG,
  SHOT_RESOLUTION_CONFIG,
  type ShotType,
} from "@/systems/shot-resolution-config";
import {
  blockProbability,
  calculateShotProbability,
  effectiveShootingAbility,
  leadRegressionAdjustment,
  resolveShot,
  type ResolveShotInput,
} from "@/systems/shot-resolution";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";

function baseInput(
  overrides: Partial<ResolveShotInput> = {},
): ResolveShotInput {
  return {
    shooter: createPlayer({
      id: "shooter_a",
      attributes: {
        finishing: 70,
        midRange: 70,
        threePoint: 70,
      },
    }),
    defender: createPlayer({
      id: "defender_a",
      attributes: {
        interiorDefense: 70,
        perimeterDefense: 70,
      },
    }),
    shotType: "two_point",
    fatigue: 0,
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

describe("SHOT_RESOLUTION_CONFIG", () => {
  it("uses a positive two-point adjustment and negative three-point adjustment", () => {
    expect(SHOT_RESOLUTION_CONFIG.twoPointAdjustment).toBeGreaterThan(0);
    expect(SHOT_RESOLUTION_CONFIG.threePointAdjustment).toBeLessThan(0);
  });

  it("applies a negative baseline so ratings do not map 1:1 to make chance", () => {
    expect(SHOT_RESOLUTION_CONFIG.baselineProbability).toBeLessThan(0);
  });
});

describe("calculateShotProbability", () => {
  it("returns a probability within configured bounds", () => {
    const probability = calculateShotProbability(baseInput());
    expect(probability).toBeGreaterThanOrEqual(
      SHOT_RESOLUTION_CONFIG.minProbability,
    );
    expect(probability).toBeLessThanOrEqual(
      SHOT_RESOLUTION_CONFIG.maxProbability,
    );
  });

  it("keeps extreme valid fatigue within bounds", () => {
    const probability = calculateShotProbability(
      baseInput({
        shooter: createPlayer({
          id: "poor_shooter",
          attributes: {
            finishing: 1,
            midRange: 1,
            threePoint: 1,
          },
        }),
        defender: createPlayer({
          id: "elite_defender",
          attributes: {
            interiorDefense: 99,
            perimeterDefense: 99,
          },
        }),
        fatigue: 1,
      }),
    );
    expect(probability).toBeGreaterThanOrEqual(
      SHOT_RESOLUTION_CONFIG.minProbability,
    );
    expect(probability).toBeLessThanOrEqual(
      SHOT_RESOLUTION_CONFIG.maxProbability,
    );
  });

  it("increases when the shooter is better", () => {
    const weaker = calculateShotProbability(
      baseInput({
        shooter: createPlayer({
          id: "weaker",
          attributes: { finishing: 50, midRange: 50, threePoint: 50 },
        }),
      }),
    );
    const stronger = calculateShotProbability(
      baseInput({
        shooter: createPlayer({
          id: "stronger",
          attributes: { finishing: 90, midRange: 90, threePoint: 90 },
        }),
      }),
    );
    expect(stronger).toBeGreaterThan(weaker);
  });

  it("decreases when the matching defender is stronger", () => {
    const weakDefender = calculateShotProbability(
      baseInput({
        defender: createPlayer({
          id: "weak_d",
          attributes: { interiorDefense: 40, perimeterDefense: 40 },
        }),
      }),
    );
    const strongDefender = calculateShotProbability(
      baseInput({
        defender: createPlayer({
          id: "strong_d",
          attributes: { interiorDefense: 95, perimeterDefense: 95 },
        }),
      }),
    );
    expect(strongDefender).toBeLessThan(weakDefender);
  });

  it("applies a fatigue penalty", () => {
    const rested = calculateShotProbability(baseInput({ fatigue: 0 }));
    const fatigued = calculateShotProbability(baseInput({ fatigue: 1 }));
    expect(rested).toBeGreaterThan(fatigued);
  });

  it("gives two-point a higher probability than three-point with identical normalized inputs", () => {
    const twoPoint = calculateShotProbability(
      baseInput({ shotType: "two_point" }),
    );
    const threePoint = calculateShotProbability(
      baseInput({ shotType: "three_point" }),
    );
    expect(twoPoint).toBeGreaterThan(threePoint);
  });

  it("does not require or consume RNG", () => {
    const first = calculateShotProbability(baseInput());
    const second = calculateShotProbability(baseInput());
    expect(first).toBe(second);
  });
});

describe("leadRegressionAdjustment", () => {
  const { threshold, perPoint, max } = SHOT_RESOLUTION_CONFIG.leadRegression;

  it("is zero up to the threshold either way", () => {
    for (const margin of [0, 1, threshold, -threshold]) {
      expect(leadRegressionAdjustment(margin)).toBeCloseTo(0, 12);
    }
  });

  it("lowers the leader and raises the trailer symmetrically", () => {
    const lead = threshold + 5;
    expect(leadRegressionAdjustment(lead)).toBeCloseTo(-5 * perPoint, 12);
    expect(leadRegressionAdjustment(-lead)).toBeCloseTo(5 * perPoint, 12);
  });

  it("caps the shift at max", () => {
    expect(leadRegressionAdjustment(200)).toBeCloseTo(-max, 12);
    expect(leadRegressionAdjustment(-200)).toBeCloseTo(max, 12);
  });

  it("feeds calculateShotProbability through scoreMargin", () => {
    const level = calculateShotProbability(baseInput());
    const leading = calculateShotProbability(
      baseInput({ scoreMargin: threshold + 10 }),
    );
    expect(level - leading).toBeCloseTo(10 * perPoint, 10);
    expect(calculateShotProbability(baseInput({ scoreMargin: 3 }))).toBe(level);
  });
});

describe("resolveShot", () => {
  it("is deterministic for the same input and seed", () => {
    const input = baseInput();
    const resultA = resolveShot(input, createSeededRng(12345));
    const resultB = resolveShot(input, createSeededRng(12345));
    expect(resultA).toEqual(resultB);
  });

  it("does not mutate the input players", () => {
    const input = baseInput();
    const snapshot = structuredClone(input);
    resolveShot(input, createTestRng());
    expect(input).toEqual(snapshot);
  });

  it("calls rng.chance exactly once", () => {
    const rng = createSeededRng(99);
    const chanceSpy = vi.spyOn(rng, "chance");
    const result = resolveShot(baseInput(), rng);
    expect(chanceSpy).toHaveBeenCalledTimes(1);
    expect(chanceSpy).toHaveBeenCalledWith(result.probability);
  });

  it("makes when the roll is below probability and misses when above", () => {
    const input = baseInput();
    const probability = calculateShotProbability(input);
    expect(probability).toBeGreaterThan(0.1);
    expect(probability).toBeLessThan(0.9);

    const made = resolveShot(input, createStubRng([probability - 0.01]));
    const missed = resolveShot(input, createStubRng([probability + 0.01]));

    expect(made.probability).toBe(probability);
    expect(missed.probability).toBe(probability);
    expect(made.made).toBe(true);
    expect(missed.made).toBe(false);
  });

  it("never calls Math.random or Date.now", () => {
    const randomSpy = vi.spyOn(Math, "random");
    const nowSpy = vi.spyOn(Date, "now");
    try {
      resolveShot(baseInput(), createTestRng());
      expect(randomSpy).not.toHaveBeenCalled();
      expect(nowSpy).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
      nowSpy.mockRestore();
    }
  });

  it("returns probability within configured bounds", () => {
    const result = resolveShot(baseInput({ fatigue: 1 }), createTestRng());
    expect(result.probability).toBeGreaterThanOrEqual(
      SHOT_RESOLUTION_CONFIG.minProbability,
    );
    expect(result.probability).toBeLessThanOrEqual(
      SHOT_RESOLUTION_CONFIG.maxProbability,
    );
  });
});

describe("resolveShot validation", () => {
  it("rejects a missing shooter", () => {
    expect(() =>
      resolveShot(
        {
          ...baseInput(),
          shooter: null as unknown as Player,
        },
        createTestRng(),
      ),
    ).toThrow(/shooter/);
  });

  it("rejects a missing defender", () => {
    expect(() =>
      resolveShot(
        {
          ...baseInput(),
          defender: null as unknown as Player,
        },
        createTestRng(),
      ),
    ).toThrow(/defender/);
  });

  it("rejects an invalid shot type", () => {
    expect(() =>
      resolveShot(
        {
          ...baseInput(),
          shotType: "free_throw" as ShotType,
        },
        createTestRng(),
      ),
    ).toThrow(/Shot type/);
  });

  it("rejects fatigue outside [0, 1]", () => {
    expect(() =>
      resolveShot(baseInput({ fatigue: -0.1 }), createTestRng()),
    ).toThrow(/fatigue/);
    expect(() =>
      resolveShot(baseInput({ fatigue: 1.1 }), createTestRng()),
    ).toThrow(/fatigue/);
    expect(() =>
      resolveShot(baseInput({ fatigue: Number.NaN }), createTestRng()),
    ).toThrow(/fatigue/);
  });

  it("rejects an invalid used rating", () => {
    const shooter = createPlayer({ id: "bad_finishing" });
    shooter.attributes.finishing = 0;
    expect(() =>
      resolveShot(
        baseInput({ shooter, shotType: "two_point" }),
        createTestRng(),
      ),
    ).toThrow(/finishing/);
  });

  it("does not reject an invalid unused rating", () => {
    const shooter = createPlayer({ id: "bad_steal" });
    shooter.attributes.steal = 0;
    expect(() =>
      resolveShot(
        baseInput({ shooter, shotType: "three_point" }),
        createTestRng(),
      ),
    ).not.toThrow();
  });
});

describe("blockProbability", () => {
  const defender = (block: number) =>
    createPlayer({ id: `blocker_${block}`, attributes: { block } });

  it("is zero at or below the floor rating", () => {
    const floor = BLOCK_RESOLUTION_CONFIG.floorRating;
    expect(blockProbability(defender(floor), "two_point")).toBe(0);
    expect(blockProbability(defender(floor - 10), "three_point")).toBe(0);
  });

  it("rises with the block rating up to the configured maximum", () => {
    const ratings = [50, 65, 80, 99];
    const twos = ratings.map((r) => blockProbability(defender(r), "two_point"));
    for (let i = 1; i < twos.length; i += 1) {
      expect(twos[i]!).toBeGreaterThan(twos[i - 1]!);
    }
    expect(twos.at(-1)).toBeCloseTo(
      BLOCK_RESOLUTION_CONFIG.maxProbability.two_point,
    );
  });

  it("makes threes much harder to block than twos", () => {
    const rim = defender(95);
    expect(blockProbability(rim, "three_point")).toBeLessThan(
      blockProbability(rim, "two_point") / 3,
    );
  });

  it("no longer blocks every miss against a 72-rated defender (#95)", () => {
    // Every two-point miss against block >= 72 used to be a block.
    expect(blockProbability(defender(72), "two_point")).toBeLessThan(0.2);
    expect(blockProbability(defender(55), "two_point")).toBeLessThan(0.1);
  });
});

describe("effectiveShootingAbility (#90)", () => {
  const { abilityKnee, abilityKneeSlope } = SHOT_RESOLUTION_CONFIG;

  it("is the identity at or below the knee", () => {
    expect(effectiveShootingAbility(50)).toBe(50);
    expect(effectiveShootingAbility(abilityKnee)).toBe(abilityKnee);
  });

  it("gives each point above the knee a fraction of a point", () => {
    expect(effectiveShootingAbility(abilityKnee + 10)).toBeCloseTo(
      abilityKnee + 10 * abilityKneeSlope,
    );
  });

  it("keeps an elite shooter's two-point make chance believable", () => {
    const elite = calculateShotProbability(
      baseInput({
        shooter: createPlayer({
          id: "elite",
          attributes: { finishing: 97, midRange: 97, threePoint: 97 },
        }),
      }),
    );
    // Linear in rating this was ~0.69 against a 70 defender.
    expect(elite).toBeLessThan(0.62);
    expect(elite).toBeGreaterThan(0.5);
  });
});
