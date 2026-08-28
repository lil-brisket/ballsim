import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { projectCashHorizon } from "@/systems/cash-projection";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("projectCashHorizon", () => {
  it("includes monthly broadcast in the horizon and stays non-mutating", () => {
    let state = createInitialGameState({
      saveId: "horizon_broadcast",
      rngSeed: 11,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;
    const cashBefore = state.business.finances[teamId]!.cash;
    const projection = projectCashHorizon(state, teamId);
    expect(projection.inflowBreakdown.broadcast).toBeGreaterThan(0);
    expect(state.business.finances[teamId]!.cash).toBe(cashBefore);
    expect(projection.outflowBreakdown.playerPayroll).toBeGreaterThan(0);
    expect(projection.horizonEndDate.length).toBe(10);
  });

  it("records zero gate inflow when no remaining home games exist", () => {
    let state = createInitialGameState({
      saveId: "horizon_nogames",
      rngSeed: 12,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;
    state = {
      ...state,
      competition: { ...state.competition, games: {} },
    };
    const projection = projectCashHorizon(state, teamId);
    expect(projection.inflowBreakdown.gate).toBe(0);
    expect(projection.horizonKind).toBe("near_term");
  });
});
