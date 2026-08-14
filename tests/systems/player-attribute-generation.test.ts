import { describe, expect, it } from "vitest";
import {
  RATING_MAX,
  RATING_MIN,
  type PlayerAttributes,
} from "@/domain/entities/player";
import { createSeededRng } from "@/domain/rng";
import {
  generatePlayerAttributes,
  pickCompatibleArchetype,
} from "@/systems/player-attribute-generation";
import { isArchetypeCompatible } from "@/domain/entities/player-archetype";

const ATTRIBUTE_KEYS = [
  "speed",
  "strength",
  "athleticism",
  "stamina",
  "finishing",
  "midRange",
  "threePoint",
  "freeThrow",
  "ballHandling",
  "passing",
  "perimeterDefense",
  "interiorDefense",
  "steal",
  "block",
  "rebounding",
  "basketballIq",
  "offensiveIq",
  "defensiveIq",
  "consistency",
] as const satisfies readonly (keyof PlayerAttributes)[];

function meanOf(
  samples: PlayerAttributes[],
  key: keyof PlayerAttributes,
): number {
  const sum = samples.reduce((acc, attrs) => acc + attrs[key], 0);
  return sum / samples.length;
}

function sampleAttributes(
  seed: number,
  position: "PG" | "SG" | "SF" | "PF" | "C",
  archetype:
    | "floor_general"
    | "scoring_guard"
    | "three_and_d_wing"
    | "shot_creator"
    | "slasher"
    | "stretch_big"
    | "rim_protector"
    | "rebounding_big"
    | "two_way_forward",
  count: number,
): PlayerAttributes[] {
  const rng = createSeededRng(seed);
  const samples: PlayerAttributes[] = [];
  for (let i = 0; i < count; i += 1) {
    samples.push(generatePlayerAttributes(position, archetype, rng));
  }
  return samples;
}

describe("generatePlayerAttributes", () => {
  it("produces all 19 attributes within 1–99", () => {
    const attrs = generatePlayerAttributes(
      "PG",
      "floor_general",
      createSeededRng(42),
    );
    expect(Object.keys(attrs).sort()).toEqual([...ATTRIBUTE_KEYS].sort());
    expect("overall" in attrs).toBe(false);
    expect("shooting" in attrs).toBe(false);
    for (const key of ATTRIBUTE_KEYS) {
      expect(Number.isInteger(attrs[key])).toBe(true);
      expect(attrs[key]).toBeGreaterThanOrEqual(RATING_MIN);
      expect(attrs[key]).toBeLessThanOrEqual(RATING_MAX);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = generatePlayerAttributes(
      "SG",
      "scoring_guard",
      createSeededRng(99),
    );
    const b = generatePlayerAttributes(
      "SG",
      "scoring_guard",
      createSeededRng(99),
    );
    expect(a).toEqual(b);
  });

  it("varies across different seeds for the same position and archetype", () => {
    const a = generatePlayerAttributes(
      "PG",
      "floor_general",
      createSeededRng(1),
    );
    const b = generatePlayerAttributes(
      "PG",
      "floor_general",
      createSeededRng(2),
    );
    expect(a).not.toEqual(b);
  });

  it("shows multi-sample archetype tendencies without relying on one roll", () => {
    const floorSamples = sampleAttributes(10, "PG", "floor_general", 40);
    const scoringSamples = sampleAttributes(10, "PG", "scoring_guard", 40);

    expect(meanOf(floorSamples, "passing")).toBeGreaterThan(
      meanOf(scoringSamples, "passing"),
    );
    expect(meanOf(scoringSamples, "threePoint")).toBeGreaterThan(
      meanOf(floorSamples, "threePoint"),
    );
  });

  it("shows multi-sample position influence for the same archetype", () => {
    const pgSamples = sampleAttributes(20, "PG", "shot_creator", 40);
    const cSamples = sampleAttributes(20, "C", "shot_creator", 40);

    expect(meanOf(pgSamples, "ballHandling")).toBeGreaterThan(
      meanOf(cSamples, "ballHandling"),
    );
    expect(meanOf(cSamples, "rebounding")).toBeGreaterThan(
      meanOf(pgSamples, "rebounding"),
    );
  });

  it("shows multi-sample position+archetype differences for bigs", () => {
    const stretch = sampleAttributes(30, "PF", "stretch_big", 40);
    const rebounder = sampleAttributes(30, "PF", "rebounding_big", 40);

    expect(meanOf(stretch, "threePoint")).toBeGreaterThan(
      meanOf(rebounder, "threePoint"),
    );
    expect(meanOf(rebounder, "rebounding")).toBeGreaterThan(
      meanOf(stretch, "rebounding"),
    );
  });

  it("can still produce distinct players for the same position and archetype", () => {
    const samples = sampleAttributes(40, "PG", "floor_general", 8);
    const unique = new Set(samples.map((attrs) => JSON.stringify(attrs)));
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe("pickCompatibleArchetype", () => {
  it("only returns archetypes compatible with the position", () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 30; i += 1) {
      const archetype = pickCompatibleArchetype("PG", rng);
      expect(isArchetypeCompatible(archetype, "PG")).toBe(true);
    }
  });
});
