import { describe, expect, it } from "vitest";
import { PLAYER_POSITIONS, type PlayerAttributes } from "@/domain/entities/player";
import {
  ARCHETYPE_ATTRIBUTE_WEIGHTS,
  ARCHETYPE_COMPATIBLE_POSITIONS,
  ARCHETYPE_LABELS,
  PLAYER_ARCHETYPES,
  POSITION_ATTRIBUTE_WEIGHTS,
  combinedAttributeWeights,
  compatibleArchetypesForPosition,
  isArchetypeCompatible,
  isPlayerArchetype,
} from "@/domain/entities/player-archetype";

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

describe("player archetype catalog", () => {
  it("exposes nine archetypes with display labels", () => {
    expect(PLAYER_ARCHETYPES).toHaveLength(9);
    for (const archetype of PLAYER_ARCHETYPES) {
      expect(isPlayerArchetype(archetype)).toBe(true);
      expect(ARCHETYPE_LABELS[archetype].length).toBeGreaterThan(0);
    }
    expect(isPlayerArchetype("point_god")).toBe(false);
  });

  it("covers all 19 live attributes for every position and archetype profile", () => {
    const expected = [...ATTRIBUTE_KEYS].sort();
    for (const position of PLAYER_POSITIONS) {
      expect(Object.keys(POSITION_ATTRIBUTE_WEIGHTS[position]).sort()).toEqual(
        expected,
      );
    }
    for (const archetype of PLAYER_ARCHETYPES) {
      expect(Object.keys(ARCHETYPE_ATTRIBUTE_WEIGHTS[archetype]).sort()).toEqual(
        expected,
      );
    }
  });

  it("accepts representative compatible position/archetype pairs", () => {
    expect(isArchetypeCompatible("floor_general", "PG")).toBe(true);
    expect(isArchetypeCompatible("scoring_guard", "SG")).toBe(true);
    expect(isArchetypeCompatible("three_and_d_wing", "SF")).toBe(true);
    expect(isArchetypeCompatible("stretch_big", "PF")).toBe(true);
    expect(isArchetypeCompatible("rim_protector", "C")).toBe(true);
  });

  it("rejects representative incompatible pairs for generation only", () => {
    expect(isArchetypeCompatible("floor_general", "C")).toBe(false);
    expect(isArchetypeCompatible("rim_protector", "PG")).toBe(false);
    expect(isArchetypeCompatible("stretch_big", "SG")).toBe(false);
  });

  it("lists compatible archetypes per position from the table", () => {
    for (const position of PLAYER_POSITIONS) {
      const listed = compatibleArchetypesForPosition(position);
      for (const archetype of listed) {
        expect(ARCHETYPE_COMPATIBLE_POSITIONS[archetype]).toContain(position);
      }
    }
  });

  it("combines position and archetype with additive deltas that can cancel", () => {
    const combined = combinedAttributeWeights("C", "floor_general");
    // C weak ballHandling (0.7) + Floor General strong (1.3) → 1.0 average
    expect(combined.ballHandling).toBeCloseTo(1.0);
    // C strong rebounding (1.3) + Floor General weak (0.7) → 1.0 average
    expect(combined.rebounding).toBeCloseTo(1.0);
    expect(Object.keys(combined).sort()).toEqual([...ATTRIBUTE_KEYS].sort());
  });

  it("produces different combined weights for same position different archetypes", () => {
    const stretch = combinedAttributeWeights("PF", "stretch_big");
    const rebounder = combinedAttributeWeights("PF", "rebounding_big");
    expect(stretch.threePoint).toBeGreaterThan(rebounder.threePoint);
    expect(rebounder.rebounding).toBeGreaterThan(stretch.rebounding);
  });

  it("produces different combined weights for same archetype different positions", () => {
    const pg = combinedAttributeWeights("PG", "shot_creator");
    const sf = combinedAttributeWeights("SF", "shot_creator");
    expect(pg.ballHandling).toBeGreaterThan(sf.ballHandling);
  });
});
