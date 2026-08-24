import { describe, expect, it } from "vitest";
import type { AiProfile } from "@/domain/entities/franchise-ops";
import type { TeamId } from "@/domain/ids";
import type { FranchiseContext } from "@/systems/franchise-ai-context";
import { resolveFranchisePreferencesFromParts } from "@/systems/franchise-ai-preferences";
import {
  emptyFranchiseTrajectoryContext,
  type FranchiseTrajectoryContext,
} from "@/systems/franchise-trajectory-context";
import {
  emptyFranchisePressureSignals,
  type FranchisePressureSignals,
} from "@/systems/franchise-pressure-signals";

function baseContext(
  overrides: Partial<FranchiseContext> = {},
): FranchiseContext {
  return {
    teamId: "team_test" as TeamId,
    wins: 41,
    losses: 41,
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

function identity(
  profile: AiProfile,
  axes: { spending: number; patience: number; risk: number } = {
    spending: 50,
    patience: 50,
    risk: 50,
  },
) {
  return {
    aiProfile: profile,
    spendingTolerance: axes.spending,
    patience: axes.patience,
    riskTolerance: axes.risk,
    marketSize: 50,
  };
}

function traj(
  overrides: Partial<FranchiseTrajectoryContext> = {},
): FranchiseTrajectoryContext {
  return { ...emptyFranchiseTrajectoryContext(), ...overrides };
}

function pressure(
  overrides: Partial<FranchisePressureSignals> = {},
): FranchisePressureSignals {
  return { ...emptyFranchisePressureSignals(), ...overrides };
}

describe("behavioral pairs — same identity, different circumstances", () => {
  it("prestige org becomes more aggressive in a championship window than in collapse", () => {
    const id = identity("win_now", { spending: 75, patience: 40, risk: 65 });

    const contender = resolveFranchisePreferencesFromParts(
      id,
      baseContext({
        wins: 54,
        losses: 28,
        winPct: 0.66,
        rosterStrength: 72,
        rosterAge: 25,
        youngRosterSharePct: 45,
        cash: 140_000_000,
        financialHealth: "healthy",
        fanSentiment: 70,
        performancePressure: 0.15,
      }),
      traj({
        competitiveWindow: 0.85,
        financialStress: 0.1,
        rebuildPressure: 0.1,
        hasYoungStar: true,
        youngStarOverall: 88,
        organizationalMomentum: 0.8,
        consecutiveLosingSeasons: 0,
      }),
      pressure({ marketOpportunity: 0.6, financialStress: 0.1 }),
    );

    const collapsing = resolveFranchisePreferencesFromParts(
      id,
      baseContext({
        wins: 27,
        losses: 55,
        winPct: 0.33,
        rosterStrength: 46,
        rosterAge: 30,
        youngRosterSharePct: 25,
        cash: 12_000_000,
        financialHealth: "warning",
        fanSentiment: 32,
        performancePressure: 0.85,
      }),
      traj({
        competitiveWindow: 0.15,
        financialStress: 0.75,
        rebuildPressure: 0.7,
        hasYoungStar: false,
        organizationalMomentum: 0.2,
        consecutiveLosingSeasons: 3,
        winsVsOwnBaseline: -0.5,
        attendanceVsOwnBaseline: -0.4,
      }),
      pressure({
        financialStress: 0.7,
        attendanceDeclining: 0.6,
        performanceDecline: 0.7,
      }),
    );

    expect(contender.preferences.spendWillingness).toBeGreaterThan(
      collapsing.preferences.spendWillingness,
    );
    expect(collapsing.preferences.cashPreservation).toBeGreaterThan(
      contender.preferences.cashPreservation,
    );
    expect(contender.posture).not.toBe(collapsing.posture);
    // Identity inertia: collapsing prestige still spends more willingly than a
    // conservative org would in the same collapse (checked in next describe).
    expect(contender.debug.strategy).toBe("win_now");
    expect(collapsing.debug.strategy).toBe("win_now");
  });
});

describe("behavioral pairs — same circumstances, different identities", () => {
  const sharedContext = baseContext({
    wins: 38,
    losses: 44,
    winPct: 0.46,
    rosterStrength: 56,
    cash: 55_000_000,
    financialHealth: "stable",
    performancePressure: 0.45,
  });
  const sharedTraj = traj({
    competitiveWindow: 0.4,
    rebuildPressure: 0.4,
    financialStress: 0.25,
    marketOpportunity: 0.4,
    organizationalMomentum: 0.5,
  });
  const sharedPressure = pressure({
    financialStress: 0.25,
    marketOpportunity: 0.4,
  });

  it("produces divergent preferences across five organizational profiles", () => {
    const profiles: AiProfile[] = [
      "win_now",
      "conservative",
      "development",
      "rebuild",
      "market_growth",
    ];
    const resolved = profiles.map((profile) =>
      resolveFranchisePreferencesFromParts(
        identity(profile, {
          spending: profile === "conservative" ? 25 : profile === "win_now" ? 75 : 50,
          patience: 50,
          risk: profile === "conservative" ? 25 : 55,
        }),
        sharedContext,
        sharedTraj,
        sharedPressure,
      ),
    );

    const byProfile = Object.fromEntries(
      resolved.map((entry) => [entry.identity.aiProfile, entry.preferences]),
    ) as Record<AiProfile, (typeof resolved)[0]["preferences"]>;

    expect(byProfile.win_now.spendWillingness).toBeGreaterThan(
      byProfile.conservative.spendWillingness,
    );
    expect(byProfile.conservative.cashPreservation).toBeGreaterThan(
      byProfile.win_now.cashPreservation,
    );
    expect(byProfile.development.youthValue).toBeGreaterThan(
      byProfile.win_now.youthValue,
    );
    expect(byProfile.rebuild.pickValue).toBeGreaterThan(
      byProfile.win_now.pickValue,
    );
    expect(byProfile.market_growth.marketingPriority).toBeGreaterThan(
      byProfile.conservative.marketingPriority,
    );
    expect(byProfile.development.developmentPriority).toBeGreaterThan(
      byProfile.win_now.developmentPriority,
    );
  });

  it("collapsing prestige still spends more than collapsing conservative (identity inertia)", () => {
    const collapseCtx = baseContext({
      winPct: 0.3,
      rosterStrength: 45,
      cash: 10_000_000,
      financialHealth: "critical",
      performancePressure: 0.9,
    });
    const collapseTraj = traj({
      competitiveWindow: 0.12,
      financialStress: 0.8,
      rebuildPressure: 0.75,
      consecutiveLosingSeasons: 3,
    });
    const collapsePressure = pressure({ financialStress: 0.8 });

    const prestige = resolveFranchisePreferencesFromParts(
      identity("win_now", { spending: 75, patience: 40, risk: 65 }),
      collapseCtx,
      collapseTraj,
      collapsePressure,
    );
    const conservative = resolveFranchisePreferencesFromParts(
      identity("conservative", { spending: 25, patience: 70, risk: 20 }),
      collapseCtx,
      collapseTraj,
      collapsePressure,
    );

    expect(prestige.preferences.spendWillingness).toBeGreaterThan(
      conservative.preferences.spendWillingness,
    );
    expect(conservative.preferences.cashPreservation).toBeGreaterThan(
      prestige.preferences.cashPreservation,
    );
  });
});
