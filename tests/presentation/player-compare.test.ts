import { describe, expect, it } from "vitest";
import type { PlayerAttributes } from "@/domain/entities/player";
import {
  buildCompareRows,
  compareHref,
  deltaTone,
  formatDelta,
} from "@/presentation/player-compare";

function attributes(value: number): PlayerAttributes {
  return {
    speed: value,
    strength: value,
    athleticism: value,
    stamina: value,
    finishing: value,
    midRange: value,
    threePoint: value,
    freeThrow: value,
    ballHandling: value,
    passing: value,
    perimeterDefense: value,
    interiorDefense: value,
    steal: value,
    block: value,
    rebounding: value,
    basketballIq: value,
    offensiveIq: value,
    defensiveIq: value,
    consistency: value,
  };
}

describe("formatDelta", () => {
  it("signs positives, uses a true minus and leaves zero bare", () => {
    expect(formatDelta(3)).toBe("+3");
    expect(formatDelta(-2)).toBe("−2");
    expect(formatDelta(0)).toBe("0");
  });

  it("maps the sign to a tone", () => {
    expect(deltaTone(3)).toBe("win");
    expect(deltaTone(-2)).toBe("loss");
    expect(deltaTone(0)).toBe("neutral");
  });
});

describe("buildCompareRows", () => {
  it("lists overall, each group, then its attributes, with b minus a", () => {
    const rows = buildCompareRows(
      { overall: 70, attributes: attributes(60) },
      { overall: 75, attributes: attributes(58) },
    );
    expect(rows[0]).toMatchObject({ kind: "overall", a: 70, b: 75, delta: 5 });
    expect(rows.filter((row) => row.kind === "group")).toHaveLength(7);
    expect(rows.filter((row) => row.kind === "attribute")).toHaveLength(19);
    expect(rows[1]).toMatchObject({ kind: "group", label: "Inside Scoring" });
    expect(rows[2]).toMatchObject({
      kind: "attribute",
      label: "Finishing",
      a: 60,
      b: 58,
      delta: -2,
    });
  });
});

describe("compareHref", () => {
  it("keeps only filled slots", () => {
    expect(compareHref("s1", { a: "p1" })).toBe(
      "/dashboard/s1/players/compare?a=p1",
    );
    expect(compareHref("s1", { a: null, b: "p2" })).toBe(
      "/dashboard/s1/players/compare?b=p2",
    );
    expect(compareHref("s1", {})).toBe("/dashboard/s1/players/compare");
  });
});
