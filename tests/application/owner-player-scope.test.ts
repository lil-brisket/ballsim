import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  createNewOwnerSave,
  loadOwnerPlayerView,
  selectOwnerTeam,
} from "@/application/game-service";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { TEST_RNG_SEED } from "../helpers/determinism";

describe("owner player scope", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it("returns null for missing or out-of-scope playerId", async () => {
    const created = await createNewOwnerSave(
      { name: "Scope Franchise", rngSeed: TEST_RNG_SEED },
      store,
    );
    const saveId = created.save.id;
    const teams = Object.values(
      (await store.load(saveId))!.state.world.teams,
    );
    const controlled = teams.find(
      (team) => team.id === created.dashboard.controlledTeam.id,
    )!;
    await selectOwnerTeam(saveId, controlled.id, store);

    const loaded = await store.load(saveId);
    expect(loaded).not.toBeNull();

    const missing = await loadOwnerPlayerView(
      saveId,
      "player_does_not_exist",
      store,
    );
    expect(missing).toBeNull();

    const otherTeam = teams.find((team) => team.id !== controlled.id)!;
    const otherPlayerId = otherTeam.roster[0];
    expect(otherPlayerId).toBeDefined();

    const outOfScope = await loadOwnerPlayerView(
      saveId,
      otherPlayerId!,
      store,
    );
    expect(outOfScope).toBeNull();

    const ownPlayerId = controlled.roster[0];
    expect(ownPlayerId).toBeDefined();
    const inScope = await loadOwnerPlayerView(saveId, ownPlayerId!, store);
    expect(inScope).not.toBeNull();
    expect(inScope!.player.playerId).toBe(ownPlayerId);
  });
});
