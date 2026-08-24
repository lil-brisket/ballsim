import { describe, expect, it } from "vitest";
import type { TeamId } from "@/domain/ids";
import type { FranchiseContext } from "@/systems/franchise-ai-context";
import { deriveOrganizationalTraits } from "@/systems/franchise-organizational-traits";
import {
  emptyFranchiseTrajectoryContext,
  type FranchiseTrajectoryContext,
} from "@/systems/franchise-trajectory-context";
import {
  deriveStrategicPosture,
  posturePreferenceDeltas,
} from "@/systems/franchise-strategic-posture";

function baseContext(
  overrides: Partial<FranchiseContext> = {},
): FranchiseContext {
  return {
    teamId: "team_test" as TeamId,
    wins: 20,
    losses: 20,
    winPct: 0.5,
    rosterStrength: 55,
    rosterAge: 26,
    youngRosterSharePct: 40,
    cash: 50_000_000,
    financialHealth: "stable",
    capSpace: 20_000_000,
    marketSize: 50,
    reputation: 50,
    fanSentiment: 50,
    marketingAwareness: 40,
    draftAssetCount: 2,
    performancePressure: 0.4,
    calendarUrgency: 0,
    deadlineWindow: false,
    offseasonPlanning: false,
    ...overrides,
  };
}

function traj(
  overrides: Partial<FranchiseTrajectoryContext> = {},
): FranchiseTrajectoryContext {
  return { ...emptyFranchiseTrajectoryContext(), ...overrides };
}

describe("deriveStrategicPosture", () => {
  it("assigns ALL_IN for prestige traits with strong window", () => {
    const { traits } = deriveOrganizationalTraits({
      aiProfile: "win_now",
      spendingTolerance: 80,
      patience: 40,
      riskTolerance: 70,
      marketSize: 60,
    });
    const result = deriveStrategicPosture(
      traits,
      traj({
        competitiveWindow: 0.85,
        financialStress: 0.1,
        rebuildPressure: 0.1,
        hasYoungStar: true,
        youngStarOverall: 88,
        organizationalMomentum: 0.75,
      }),
      baseContext({ winPct: 0.68, rosterStrength: 72, cash: 150_000_000 }),
    );
    expect(result.posture).toBe("all_in");
  });

  it("assigns DEVELOPING for development org with youth + rebuild pressure", () => {
    const { traits } = deriveOrganizationalTraits({
      aiProfile: "development",
      spendingTolerance: 45,
      patience: 70,
      riskTolerance: 40,
      marketSize: 45,
    });
    const result = deriveStrategicPosture(
      traits,
      traj({
        rebuildPressure: 0.65,
        competitiveWindow: 0.25,
        hasYoungStar: true,
        youngStarOverall: 80,
      }),
      baseContext({
        winPct: 0.35,
        youngRosterSharePct: 55,
        rosterStrength: 48,
      }),
    );
    expect(result.posture).toBe("developing");
  });

  it("assigns RETRENCHING for prestige org after multi-year decline + stress", () => {
    const { traits } = deriveOrganizationalTraits({
      aiProfile: "win_now",
      spendingTolerance: 75,
      patience: 35,
      riskTolerance: 65,
      marketSize: 55,
    });
    const result = deriveStrategicPosture(
      traits,
      traj({
        consecutiveLosingSeasons: 3,
        financialStress: 0.8,
        rebuildPressure: 0.7,
        competitiveWindow: 0.15,
        winsVsOwnBaseline: -0.6,
        valueVsOwnBaseline: -0.5,
        organizationalMomentum: 0.2,
      }),
      baseContext({
        winPct: 0.28,
        rosterStrength: 44,
        financialHealth: "critical",
        cash: 5_000_000,
      }),
    );
    expect(result.posture).toBe("retrenching");
  });

  it("does not flip from contending on mild short-term noise for patient orgs", () => {
    const { traits } = deriveOrganizationalTraits({
      aiProfile: "win_now",
      spendingTolerance: 60,
      patience: 85,
      riskTolerance: 55,
      marketSize: 50,
    });
    const strong = deriveStrategicPosture(
      traits,
      traj({
        competitiveWindow: 0.7,
        financialStress: 0.15,
        organizationalMomentum: 0.65,
        rebuildPressure: 0.15,
      }),
      baseContext({ winPct: 0.62, rosterStrength: 64 }),
    );
    const mildDip = deriveStrategicPosture(
      traits,
      traj({
        competitiveWindow: 0.62,
        financialStress: 0.2,
        organizationalMomentum: 0.55,
        rebuildPressure: 0.2,
      }),
      baseContext({ winPct: 0.52, rosterStrength: 62 }),
    );
    expect(["contending", "all_in", "maintaining"]).toContain(strong.posture);
    // Patient org should not jump to rebuilding on a mild dip
    expect(mildDip.posture).not.toBe("rebuilding");
  });

  it("posture deltas move spend up for all_in and cash up for retrenching", () => {
    const allIn = posturePreferenceDeltas("all_in");
    const retrench = posturePreferenceDeltas("retrenching");
    expect(allIn.spendWillingness).toBeGreaterThan(0);
    expect(allIn.cashPreservation).toBeLessThan(0);
    expect(retrench.cashPreservation).toBeGreaterThan(0);
    expect(retrench.spendWillingness).toBeLessThan(0);
  });
});
