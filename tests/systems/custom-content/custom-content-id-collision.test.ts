import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { applyRosterPackage } from "@/systems/custom-content/apply-roster";
import { makeFullRosterPackage } from "../../helpers/custom-content";

describe("custom content ID collision", () => {
  it("rejects a package whose canonical IDs already exist", () => {
    const state = createInitialGameState({
      saveId: "custom_collision",
      rngSeed: 14,
      settings: CBL_GAME_SETTINGS,
    });
    const pkg = makeFullRosterPackage({
      teamCount: Object.keys(state.world.teams).length,
      contentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    const rng = createSeededRng(state.meta.rngState);
    const first = applyRosterPackage(state, pkg, rng).state;
    expect(() => applyRosterPackage(first, pkg, rng)).toThrow(
      /already exists|invalid/i,
    );
  });
});
