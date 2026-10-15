import { describe, expect, it } from "vitest";
import type { PlayerAttributes } from "@/domain/entities/player";
import {
  RATING_CATEGORIES,
  categoryRatings,
  formatAttributeLabel,
  formatHeight,
} from "@/presentation/player-rating-categories";
import { createPlayer } from "../factories/player";

const ATTRIBUTE_KEYS = Object.keys(createPlayer().attributes) as Array<
  keyof PlayerAttributes
>;

describe("categoryRatings", () => {
  it("has 7 categories covering each of the 19 attributes exactly once", () => {
    expect(RATING_CATEGORIES).toHaveLength(7);
    expect(ATTRIBUTE_KEYS).toHaveLength(19);
    const covered = RATING_CATEGORIES.flatMap((c) => [...c.attributes]);
    expect(covered).toHaveLength(19);
    expect(new Set(covered).size).toBe(19);
    expect([...covered].sort()).toEqual([...ATTRIBUTE_KEYS].sort());
  });

  it("computes rounded means per category", () => {
    const attributes = {
      ...createPlayer().attributes,
      midRange: 70,
      threePoint: 81,
      freeThrow: 60,
      ballHandling: 90,
      passing: 71,
      finishing: 64,
    };
    const result = categoryRatings(attributes);
    const byKey = Object.fromEntries(result.map((c) => [c.key, c]));
    expect(byKey.insideScoring!.rating).toBe(64);
    // (70 + 81 + 60) / 3 = 70.33
    expect(byKey.outsideScoring!.rating).toBe(70);
    // (90 + 71) / 2 = 80.5 -> 81
    expect(byKey.playmaking!.rating).toBe(81);
    expect(byKey.playmaking!.attributes.map((a) => a.label)).toEqual([
      "Ball Handling",
      "Passing",
    ]);
  });
});

describe("formatters", () => {
  it("formats heights and attribute labels", () => {
    expect(formatHeight(79)).toBe(`6'7"`);
    expect(formatAttributeLabel("midRange")).toBe("Mid Range");
    expect(formatAttributeLabel("steal")).toBe("Steal");
  });
});
