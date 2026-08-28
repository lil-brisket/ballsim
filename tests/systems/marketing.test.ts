import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { processWeeklyMarketing, setMarketingBudget } from "@/systems/marketing";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("marketing", () => {
  it("raises awareness over weeks with spend and decays toward neutral without spend", () => {
    let state = createInitialGameState({
      saveId: "mkt_test",
      rngSeed: 3,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;

    state = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...state.business.franchiseOps[teamId]!,
            marketing: { budget: 10_000_000, awareness: 40 },
          },
        },
      },
    };
    const startAwareness =
      state.business.franchiseOps[teamId]!.marketing.awareness;

    for (let week = 0; week < 12; week += 1) {
      state = processWeeklyMarketing(state).state;
    }
    const afterSpend =
      state.business.franchiseOps[teamId]!.marketing.awareness;
    expect(afterSpend).toBeGreaterThan(startAwareness);

    // Force a high awareness so weekly decay toward 50 survives integer rounding.
    state = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...state.business.franchiseOps[teamId]!,
            marketing: { budget: 0, awareness: 80 },
          },
        },
      },
    };
    const peak = 80;
    for (let week = 0; week < 40; week += 1) {
      state = processWeeklyMarketing(state).state;
    }
    const afterDecay =
      state.business.franchiseOps[teamId]!.marketing.awareness;
    expect(afterDecay).toBeLessThan(peak);
    expect(afterDecay).toBeGreaterThanOrEqual(50);
  });

  it("moves awareness toward 50 even when the weekly delta would round to zero", () => {
    let state = createInitialGameState({
      saveId: "mkt_round",
      rngSeed: 6,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;
    state = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...state.business.franchiseOps[teamId]!,
            marketing: { budget: 0, awareness: 51 },
          },
        },
      },
    };
    state = processWeeklyMarketing(state).state;
    expect(state.business.franchiseOps[teamId]!.marketing.awareness).toBe(50);
  });

  it("marketing spend reduces cash and does not create cash", () => {
    let state = createInitialGameState({
      saveId: "mkt_cash",
      rngSeed: 5,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = asTeamId(state.user.activeOwnerTeamId);
    state = setMarketingBudget(state, teamId, 2_600_000).state;
    const cashBefore = state.business.finances[teamId]!.cash;
    state = processWeeklyMarketing(state).state;
    const cashAfter = state.business.finances[teamId]!.cash;
    expect(cashAfter).toBeLessThan(cashBefore);
  });
});
