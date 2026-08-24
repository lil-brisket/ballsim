import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { runAiFranchiseDecisions } from "@/systems/ai-franchise-decisions";
import {
  ticketPriceFromPreferences,
  marketingBudgetFromPreferences,
  facilityUpgradeFromPreferences,
} from "@/systems/ai-franchise-decisions";
import { resolveFranchisePreferencesFromParts } from "@/systems/franchise-ai-preferences";
import type { FranchiseContext } from "@/systems/franchise-ai-context";
import type { TeamId } from "@/domain/ids";
import { createDefaultFranchiseOps } from "@/domain/entities/franchise-ops";

function ctx(overrides: Partial<FranchiseContext> = {}): FranchiseContext {
  return {
    teamId: "t" as TeamId,
    wins: 25,
    losses: 25,
    winPct: 0.5,
    rosterStrength: 55,
    rosterAge: 26,
    youngRosterSharePct: 40,
    cash: 60_000_000,
    financialHealth: "healthy",
    capSpace: 15_000_000,
    marketSize: 50,
    reputation: 50,
    fanSentiment: 55,
    marketingAwareness: 40,
    draftAssetCount: 2,
    performancePressure: 0.3,
    calendarUrgency: 0,
    deadlineWindow: false,
    offseasonPlanning: false,
    ...overrides,
  };
}

describe("AI franchise decisions (owner ops)", () => {
  it("does not mutate the user-controlled team", () => {
    let state = createInitialGameState({
      saveId: "ai_ops_user",
      rngSeed: 31,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          lastSimulatedWeekId: "2026-W40",
        },
      },
    };
    const userId = state.user.controlledTeamId;
    const before = structuredClone(state.business.franchiseOps[userId]);
    const result = runAiFranchiseDecisions(state, rng);
    expect(result.state.business.franchiseOps[userId]).toEqual(before);
  });

  it("market_growth prefers lower ticket prices than win_now", () => {
    const baseCtx = ctx();
    const growth = resolveFranchisePreferencesFromParts(
      {
        aiProfile: "market_growth",
        spendingTolerance: 55,
        patience: 55,
        riskTolerance: 50,
        marketSize: 50,
      },
      baseCtx,
    );
    const winNow = resolveFranchisePreferencesFromParts(
      {
        aiProfile: "win_now",
        spendingTolerance: 75,
        patience: 30,
        riskTolerance: 60,
        marketSize: 50,
      },
      baseCtx,
    );
    const growthPrice = ticketPriceFromPreferences(
      45,
      55,
      growth.preferences,
    );
    const winNowPrice = ticketPriceFromPreferences(45, 55, winNow.preferences);
    expect(growth.preferences.attendancePriority).toBeGreaterThan(
      winNow.preferences.attendancePriority,
    );
    // Directional: growth should not raise more aggressively than win-now
    expect(growthPrice).toBeLessThanOrEqual(winNowPrice);
  });

  it("development prefers development facilities when cash allows", () => {
    const resolved = resolveFranchisePreferencesFromParts(
      {
        aiProfile: "development",
        spendingTolerance: 60,
        patience: 70,
        riskTolerance: 40,
        marketSize: 50,
      },
      ctx({ cash: 40_000_000, financialHealth: "healthy" }),
    );
    const ops = createDefaultFranchiseOps({ aiProfile: "development" });
    const category = facilityUpgradeFromPreferences(
      ops,
      40_000_000,
      resolved.preferences,
    );
    expect(category === "practice" || category === "training" || category === "youth").toBe(
      true,
    );
  });

  it("high cashPreservation can no-op marketing", () => {
    const resolved = resolveFranchisePreferencesFromParts(
      {
        aiProfile: "conservative",
        spendingTolerance: 15,
        patience: 80,
        riskTolerance: 15,
        marketSize: 50,
      },
      ctx({ financialHealth: "warning", cash: 8_000_000 }),
    );
    const next = marketingBudgetFromPreferences(
      2_000_000,
      8_000_000,
      resolved.preferences,
    );
    expect(next).toBe(2_000_000);
  });
});
