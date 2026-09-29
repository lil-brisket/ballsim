import { describe, expect, it } from "vitest";
import {
  LAB_MAX_GAMES,
  LAB_MAX_SEASONS_STANDARD,
  runGameLab,
  runSeasonLab,
  runScheduleLab,
} from "@/application/sim-lab";

describe("sim lab application wrappers", () => {
  it("rejects a game batch above the page cap", () => {
    const result = runGameLab({
      seed: 42,
      games: LAB_MAX_GAMES + 1,
      scenarioId: "normal",
      rotation: "off",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/capped/i);
    }
  });

  it("rejects an unknown scenario", () => {
    const result = runGameLab({
      seed: 42,
      games: 2,
      scenarioId: "not-a-scenario",
      rotation: "on",
    });
    expect(result.ok).toBe(false);
  });

  it("runs a tiny game batch", () => {
    const result = runGameLab({
      seed: 42,
      games: 2,
      scenarioId: "normal",
      rotation: "off",
      persist: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.gamesSimulated).toBe(2);
      expect(result.wallMs).toBeGreaterThan(0);
    }
  });

  it("rejects standard multi-season above the page cap", () => {
    const result = runSeasonLab({
      seed: 42,
      seasons: LAB_MAX_SEASONS_STANDARD + 1,
      preset: "standard",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Standard/i);
    }
  });

  it("rejects an invalid schedule until value", () => {
    const result = runScheduleLab({
      seed: 42,
      preset: "cbl",
      until: "never" as "regular",
    });
    expect(result.ok).toBe(false);
  });
});
