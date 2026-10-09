import { describe, expect, it } from "vitest";
import {
  PLAYER_RETIREMENT_HIGH_AGE,
  PLAYER_RETIREMENT_MIN_AGE,
} from "@/systems/league-rules/invariants";
import { playerRetirementProbability } from "@/systems/player-retirement";

describe("playerRetirementProbability", () => {
  it("is zero before the minimum retirement age", () => {
    expect(playerRetirementProbability(PLAYER_RETIREMENT_MIN_AGE - 1, 50)).toBe(
      0,
    );
    expect(playerRetirementProbability(PLAYER_RETIREMENT_MIN_AGE - 1, 90)).toBe(
      0,
    );
  });

  it("makes 80+ overall linger and sub-60 leave sooner", () => {
    const age = PLAYER_RETIREMENT_MIN_AGE + 4;
    const star = playerRetirementProbability(age, 88);
    const replacement = playerRetirementProbability(age, 55);
    const average = playerRetirementProbability(age, 70);
    expect(star).toBeLessThan(average);
    expect(replacement).toBeGreaterThan(average);
  });

  it("rises sharply at the high-age band", () => {
    const before = playerRetirementProbability(
      PLAYER_RETIREMENT_HIGH_AGE - 1,
      70,
    );
    const atHigh = playerRetirementProbability(PLAYER_RETIREMENT_HIGH_AGE, 70);
    expect(atHigh).toBeGreaterThan(before);
    expect(atHigh).toBeLessThanOrEqual(0.85);
  });
});
