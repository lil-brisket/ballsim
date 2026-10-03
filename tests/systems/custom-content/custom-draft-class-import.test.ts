import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createDraftFromPackage } from "@/systems/draft";
import { validateGameState } from "@/persistence/validate-game-state";
import { canonicalCustomPlayerId } from "@/systems/custom-content/normalize";
import { makeDraftClassPackage, makePlayerSource } from "../../helpers/custom-content";

describe("custom draft class import", () => {
  it("inserts prospects into DraftClass and not world.players", () => {
    let state = createInitialGameState({
      saveId: "custom_dc_import",
      rngSeed: 11,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const pkg = makeDraftClassPackage({
      draftYear: 2027,
      prospects: [
        makePlayerSource({
          sourceId: "star",
          firstName: "Imported",
          lastName: "Prospect",
          age: 21,
          position: "PG",
          archetype: "floor_general",
          heightInches: 74,
          weightPounds: 190,
        }),
      ],
    });
    const created = createDraftFromPackage(state, rng, pkg);
    expect(() => validateGameState(created.state)).not.toThrow();
    const playerId = canonicalCustomPlayerId(pkg.contentId, "star");
    const draft = Object.values(created.state.world.drafts)[0]!;
    expect(draft.prospects[playerId]).toBeDefined();
    expect(created.state.world.players[playerId]).toBeUndefined();
    expect(draft.prospects[playerId]?.player.teamId).toBeNull();
    expect(draft.prospects[playerId]?.player.contractId).toBeNull();
  });
});
