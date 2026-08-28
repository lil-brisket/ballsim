import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { startFacilityUpgrade } from "@/systems/facilities";
import { setMarketingBudget } from "@/systems/marketing";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("financial spending guards", () => {
  it("blocks facility upgrades and marketing increases when cash is insolvent", () => {
    let state = createInitialGameState({
      saveId: "spend_block",
      rngSeed: 13,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;
    state = {
      ...state,
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: { ...state.business.finances[teamId]!, cash: 0 },
        },
      },
    };
    expect(() => startFacilityUpgrade(state, teamId, "practice")).toThrow(
      /blocked/i,
    );
    expect(() => setMarketingBudget(state, teamId, 9_000_000)).toThrow(
      /blocked/i,
    );
    const cut = setMarketingBudget(state, teamId, 0);
    expect(cut.state.business.franchiseOps[teamId]!.marketing.budget).toBe(0);
  });

  it("allows upgrades when cash is healthy", () => {
    let state = createInitialGameState({
      saveId: "spend_ok",
      rngSeed: 14,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;
    expect(() => startFacilityUpgrade(state, teamId, "youth")).not.toThrow();
  });
});
