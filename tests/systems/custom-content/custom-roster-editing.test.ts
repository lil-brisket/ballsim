import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { asPlayerId } from "@/domain/ids";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { applyRosterPackage } from "@/systems/custom-content/apply-roster";
import {
  addCustomRosterPlayer,
  removeCustomRosterPlayer,
  updateCustomRosterPlayer,
} from "@/systems/custom-content/post-save-edit";
import { validateGameState } from "@/persistence/validate-game-state";
import { canonicalCustomPlayerId } from "@/systems/custom-content/normalize";
import { makeFullRosterPackage, makePlayerSource } from "../../helpers/custom-content";

describe("custom roster editing", () => {
  function boot() {
    const state = createInitialGameState({
      saveId: "custom_edit",
      rngSeed: 9,
      settings: CBL_GAME_SETTINGS,
    });
    const pkg = makeFullRosterPackage({
      teamCount: Object.keys(state.world.teams).length,
    });
    const rng = createSeededRng(state.meta.rngState);
    return {
      state: applyRosterPackage(state, pkg, rng).state,
      rng,
      pkg,
    };
  }

  it("updates identity through domain constructors", () => {
    const { state, pkg } = boot();
    const playerId = asPlayerId(canonicalCustomPlayerId(pkg.contentId, "t0_p0"));
    const updated = updateCustomRosterPlayer(state, playerId, {
      firstName: "Edited",
      lastName: "Name",
    });
    expect(() => validateGameState(updated.state)).not.toThrow();
    expect(updated.state.world.players[playerId]?.firstName).toBe("Edited");
  });

  it("hard-removes a player before games are played", () => {
    const { state, pkg } = boot();
    const playerId = asPlayerId(canonicalCustomPlayerId(pkg.contentId, "t0_p0"));
    const removed = removeCustomRosterPlayer(state, playerId);
    expect(() => validateGameState(removed.state)).not.toThrow();
    expect(removed.state.world.players[playerId]).toBeUndefined();
  });

  it("adds a free agent via createPlayer", () => {
    const { state, rng } = boot();
    const added = addCustomRosterPlayer(
      state,
      {
        ...makePlayerSource({ sourceId: "fa1", lastName: "Agent" }),
        teamSourceId: null,
      },
      rng,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    expect(() => validateGameState(added.state)).not.toThrow();
    const fa = Object.values(added.state.world.players).find(
      (player) => player.lastName === "Agent",
    );
    expect(fa?.teamId).toBeNull();
  });
});
