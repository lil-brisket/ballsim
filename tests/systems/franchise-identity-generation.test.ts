import { describe, expect, it } from "vitest";
import {
  AI_PROFILES,
  createDefaultFranchiseOps,
  isAiProfile,
  isOwnershipAxis,
} from "@/domain/entities/franchise-ops";
import {
  generateAxesForExistingProfile,
  generateFranchiseIdentity,
  strategyWeightsForMarket,
} from "@/systems/franchise-identity-generation";

describe("franchise identity generation", () => {
  it("generates valid profiles and axes", () => {
    const id = generateFranchiseIdentity({
      rngSeed: 99,
      teamId: "team_alpha",
      marketSize: 60,
    });
    expect(isAiProfile(id.aiProfile)).toBe(true);
    expect(isOwnershipAxis(id.spendingTolerance)).toBe(true);
    expect(isOwnershipAxis(id.patience)).toBe(true);
    expect(isOwnershipAxis(id.riskTolerance)).toBe(true);
  });

  it("is deterministic for the same seed and teamId", () => {
    const a = generateFranchiseIdentity({
      rngSeed: 7,
      teamId: "team_x",
      marketSize: 45,
    });
    const b = generateFranchiseIdentity({
      rngSeed: 7,
      teamId: "team_x",
      marketSize: 45,
    });
    expect(a).toEqual(b);
  });

  it("varies across teams for the same seed", () => {
    const profiles = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const id = generateFranchiseIdentity({
        rngSeed: 11,
        teamId: `team_${i}`,
        marketSize: 35 + (i % 45),
      });
      profiles.add(id.aiProfile);
    }
    expect(profiles.size).toBeGreaterThanOrEqual(3);
  });

  it("keeps forceProfile and only generates axes", () => {
    const id = generateFranchiseIdentity({
      rngSeed: 3,
      teamId: "team_legacy",
      marketSize: 80,
      forceProfile: "rebuild",
    });
    expect(id.aiProfile).toBe("rebuild");
    expect(isOwnershipAxis(id.spendingTolerance)).toBe(true);
  });

  it("generateAxesForExistingProfile does not change strategy", () => {
    const axes = generateAxesForExistingProfile({
      rngSeed: 5,
      teamId: "team_y",
      aiProfile: "conservative",
    });
    expect(isOwnershipAxis(axes.spendingTolerance)).toBe(true);
    expect(isOwnershipAxis(axes.patience)).toBe(true);
    expect(isOwnershipAxis(axes.riskTolerance)).toBe(true);
  });

  it("market size tilts weights without eliminating strategies", () => {
    const large = strategyWeightsForMarket(90);
    const small = strategyWeightsForMarket(20);
    expect(large.win_now).toBeGreaterThan(small.win_now);
    expect(small.rebuild).toBeGreaterThan(large.rebuild);
    for (const profile of AI_PROFILES) {
      expect(large[profile]).toBeGreaterThan(0);
      expect(small[profile]).toBeGreaterThan(0);
    }
  });

  it("createDefaultFranchiseOps includes ownership axes", () => {
    const ops = createDefaultFranchiseOps();
    expect(ops.spendingTolerance).toBe(50);
    expect(ops.patience).toBe(50);
    expect(ops.riskTolerance).toBe(50);
    expect(ops.aiProfile).toBe("conservative");
  });
});
