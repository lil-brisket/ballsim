import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  validateDayInvariants,
  validateSimulationState,
} from "@/systems/simulation/validate-simulation-state";

describe("validateSimulationState", () => {
  it("accepts a freshly bootstrapped state", () => {
    const state = createInitialGameState({
      saveId: "inv_ok",
      rngSeed: 5,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng).state;
    expect(validateDayInvariants(bootstrapped).ok).toBe(true);
    expect(validateSimulationState(bootstrapped).ok).toBe(true);
  });

  it("flags orphan player team references", () => {
    const state = createInitialGameState({
      saveId: "inv_bad",
      rngSeed: 5,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng).state;
    const player = Object.values(bootstrapped.world.players)[0]!;
    const corrupted = {
      ...bootstrapped,
      world: {
        ...bootstrapped.world,
        players: {
          ...bootstrapped.world.players,
          [player.id]: { ...player, teamId: "missing_team" as never },
        },
      },
    };
    const result = validateDayInvariants(corrupted);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "orphan_player_team")).toBe(
      true,
    );
  });
});
