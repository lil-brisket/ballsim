import { describe, expect, it } from "vitest";
import { createSeededRng, deriveSeed } from "@/domain/rng";
import { getScenarioBuilder } from "@/simulation/lab/scenarios";

describe("Lab scenarios", () => {
  it("produce identical rosters for the same derived seed", () => {
    const scenarioId = "superteam";
    const seed = deriveSeed(99, scenarioId);
    const a = getScenarioBuilder(scenarioId)(createSeededRng(seed));
    const b = getScenarioBuilder(scenarioId)(createSeededRng(seed));
    expect(a.homePlayers.map((p) => p.attributes.finishing)).toEqual(
      b.homePlayers.map((p) => p.attributes.finishing),
    );
    expect(a.homePlayers.every((p) => p.attributes.finishing >= 95)).toBe(true);
  });

  it("deriveSeed is stable and differs by stream", () => {
    expect(deriveSeed(1, "superteam")).toBe(deriveSeed(1, "superteam"));
    expect(deriveSeed(1, "superteam")).not.toBe(deriveSeed(1, "weak"));
  });
});
