import { describe, expect, it } from "vitest";
import { derivePlayerStrengthsWeaknesses } from "@/domain/player-evaluation";
import type { PlayerAttributes } from "@/domain/entities/player";

function attrs(overrides: Partial<PlayerAttributes> = {}): PlayerAttributes {
  return {
    speed: 70,
    strength: 70,
    athleticism: 70,
    stamina: 70,
    finishing: 70,
    midRange: 70,
    threePoint: 70,
    freeThrow: 70,
    ballHandling: 70,
    passing: 70,
    perimeterDefense: 70,
    interiorDefense: 70,
    steal: 70,
    block: 70,
    rebounding: 70,
    basketballIq: 70,
    offensiveIq: 70,
    defensiveIq: 70,
    consistency: 70,
    ...overrides,
  };
}

describe("player evaluation", () => {
  it("returns structured strengths and weaknesses from attributes", () => {
    const result = derivePlayerStrengthsWeaknesses(
      "PG",
      attrs({
        threePoint: 90,
        passing: 88,
        freeThrow: 35,
        rebounding: 30,
      }),
    );

    expect(result.strengths.some((s) => s.attribute === "threePoint")).toBe(
      true,
    );
    expect(result.strengths.some((s) => s.attribute === "passing")).toBe(true);
    expect(result.weaknesses.some((w) => w.attribute === "freeThrow")).toBe(
      true,
    );

    const strength = result.strengths[0]!;
    expect(strength).toMatchObject({
      polarity: "strength",
      level: expect.stringMatching(/elite|strong/),
      label: expect.any(String),
      rating: expect.any(Number),
      category: expect.any(String),
    });
  });

  it("limits strengths and weaknesses to maxEach", () => {
    const result = derivePlayerStrengthsWeaknesses(
      "C",
      attrs({
        finishing: 92,
        rebounding: 91,
        block: 90,
        interiorDefense: 89,
        strength: 88,
        freeThrow: 20,
        threePoint: 18,
        ballHandling: 22,
        speed: 25,
        steal: 28,
      }),
      3,
    );
    expect(result.strengths.length).toBeLessThanOrEqual(3);
    expect(result.weaknesses.length).toBeLessThanOrEqual(3);
  });
});
