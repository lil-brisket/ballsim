import { describe, expect, it } from "vitest";
import {
  DEFAULT_COACHING_PHILOSOPHY,
  DEFENSIVE_APPROACHES,
  isCoachingPhilosophy,
  isDefensiveApproach,
  isOffensiveEmphasis,
  isPacePhilosophy,
  OFFENSIVE_EMPHASES,
  PACE_PHILOSOPHIES,
  type CoachingPhilosophy,
} from "@/domain/coaching/coaching-philosophy";
import {
  getCoachingModifiers,
  COACHING_PHILOSOPHY_CONFIG,
} from "@/domain/coaching/coaching-philosophy-config";

describe("coaching philosophy domain", () => {
  it("exposes valid union members", () => {
    expect(PACE_PHILOSOPHIES).toEqual(["fast", "balanced", "halfCourt"]);
    expect(OFFENSIVE_EMPHASES).toEqual([
      "threePointHeavy",
      "balanced",
      "inside",
    ]);
    expect(DEFENSIVE_APPROACHES).toEqual([
      "aggressive",
      "balanced",
      "conservative",
    ]);
  });

  it("defaults to all balanced", () => {
    expect(DEFAULT_COACHING_PHILOSOPHY).toEqual({
      pace: "balanced",
      offensiveEmphasis: "balanced",
      defensiveApproach: "balanced",
    });
  });

  it("type guards accept valid values and reject invalid ones", () => {
    expect(isPacePhilosophy("fast")).toBe(true);
    expect(isPacePhilosophy("sprint")).toBe(false);
    expect(isOffensiveEmphasis("inside")).toBe(true);
    expect(isOffensiveEmphasis("post")).toBe(false);
    expect(isDefensiveApproach("aggressive")).toBe(true);
    expect(isDefensiveApproach("press")).toBe(false);
    expect(isCoachingPhilosophy(DEFAULT_COACHING_PHILOSOPHY)).toBe(true);
    expect(
      isCoachingPhilosophy({
        pace: "fast",
        offensiveEmphasis: "balanced",
        defensiveApproach: "nope",
      }),
    ).toBe(false);
  });
});

describe("getCoachingModifiers", () => {
  it("returns identity modifiers for balanced philosophy", () => {
    const mods = getCoachingModifiers(DEFAULT_COACHING_PHILOSOPHY);
    expect(mods).toEqual({
      possessionSecondsDelta: 0,
      shotSelection: { threePoint: 1, finishing: 1 },
      defensivePressureMultiplier: 1,
      foulActionWeightMultiplier: 1,
    });
  });

  it("applies directional pace deltas", () => {
    const fast = getCoachingModifiers({
      ...DEFAULT_COACHING_PHILOSOPHY,
      pace: "fast",
    });
    const halfCourt = getCoachingModifiers({
      ...DEFAULT_COACHING_PHILOSOPHY,
      pace: "halfCourt",
    });
    const balanced = getCoachingModifiers(DEFAULT_COACHING_PHILOSOPHY);
    expect(fast.possessionSecondsDelta).toBeLessThan(
      balanced.possessionSecondsDelta,
    );
    expect(balanced.possessionSecondsDelta).toBeLessThan(
      halfCourt.possessionSecondsDelta,
    );
  });

  it("increases three-point weight for threePointHeavy", () => {
    const heavy = getCoachingModifiers({
      ...DEFAULT_COACHING_PHILOSOPHY,
      offensiveEmphasis: "threePointHeavy",
    });
    const balanced = getCoachingModifiers(DEFAULT_COACHING_PHILOSOPHY);
    expect(heavy.shotSelection.threePoint).toBeGreaterThan(
      balanced.shotSelection.threePoint,
    );
    expect(heavy.shotSelection.finishing).toBe(1);
  });

  it("increases finishing weight for inside", () => {
    const inside = getCoachingModifiers({
      ...DEFAULT_COACHING_PHILOSOPHY,
      offensiveEmphasis: "inside",
    });
    const balanced = getCoachingModifiers(DEFAULT_COACHING_PHILOSOPHY);
    expect(inside.shotSelection.finishing).toBeGreaterThan(
      balanced.shotSelection.finishing,
    );
    expect(inside.shotSelection.threePoint).toBe(1);
  });

  it("orders defensive pressure and foul risk aggressive > balanced > conservative", () => {
    const aggressive = getCoachingModifiers({
      ...DEFAULT_COACHING_PHILOSOPHY,
      defensiveApproach: "aggressive",
    });
    const balanced = getCoachingModifiers(DEFAULT_COACHING_PHILOSOPHY);
    const conservative = getCoachingModifiers({
      ...DEFAULT_COACHING_PHILOSOPHY,
      defensiveApproach: "conservative",
    });
    expect(aggressive.defensivePressureMultiplier).toBeGreaterThan(
      balanced.defensivePressureMultiplier,
    );
    expect(balanced.defensivePressureMultiplier).toBeGreaterThan(
      conservative.defensivePressureMultiplier,
    );
    expect(aggressive.foulActionWeightMultiplier).toBeGreaterThan(
      balanced.foulActionWeightMultiplier,
    );
    expect(balanced.foulActionWeightMultiplier).toBeGreaterThan(
      conservative.foulActionWeightMultiplier,
    );
  });

  it("does not mutate the supplied philosophy or shared defaults", () => {
    const input: CoachingPhilosophy = {
      pace: "fast",
      offensiveEmphasis: "inside",
      defensiveApproach: "aggressive",
    };
    const beforeDefault = { ...DEFAULT_COACHING_PHILOSOPHY };
    const beforeConfig = structuredClone(COACHING_PHILOSOPHY_CONFIG);
    const mods = getCoachingModifiers(input);
    expect(input).toEqual({
      pace: "fast",
      offensiveEmphasis: "inside",
      defensiveApproach: "aggressive",
    });
    expect(DEFAULT_COACHING_PHILOSOPHY).toEqual(beforeDefault);
    expect(COACHING_PHILOSOPHY_CONFIG).toEqual(beforeConfig);
    expect(mods.shotSelection).not.toBe(
      COACHING_PHILOSOPHY_CONFIG.shotSelection.inside,
    );
  });
});
