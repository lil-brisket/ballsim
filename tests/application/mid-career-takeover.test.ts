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
  takeOverFranchise,
} from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  getActiveOwnerTeamId,
  getOwnedTeamIds,
  isOwnedFranchise,
} from "@/state/owner-context";
import { TEST_RNG_SEED } from "../helpers/determinism";

describe("mid-career franchise takeover", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  async function seededOwnerSave() {
    const created = await createNewOwnerSave(
      {
        settings: CBL_GAME_SETTINGS,
        name: "Takeover Franchise",
        rngSeed: TEST_RNG_SEED,
      },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("failed to create save");
    }
    return created;
  }

  it("takeOverFranchise adds team to ownedTeamIds, creates franchise state, and sets active", async () => {
    const created = await seededOwnerSave();
    const saveId = created.save.id;
    const loaded = await store.load(saveId);
    expect(loaded).not.toBeNull();

    const primaryId = loaded!.state.user.activeOwnerTeamId;
    const aiTeam = Object.values(loaded!.state.world.teams).find(
      (team) => team.id !== primaryId,
    )!;
    expect(isOwnedFranchise(loaded!.state, aiTeam.id)).toBe(false);

    const result = await takeOverFranchise(saveId, aiTeam.id, store);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const after = await store.load(saveId);
    expect(after).not.toBeNull();
    expect(getOwnedTeamIds(after!.state)).toContain(aiTeam.id);
    expect(getOwnedTeamIds(after!.state)).toContain(primaryId);
    expect(getActiveOwnerTeamId(after!.state)).toBe(aiTeam.id);
    expect(after!.state.user.ownedFranchises[aiTeam.id]).toBeDefined();
    expect(
      after!.state.user.ownedFranchises[aiTeam.id]!.franchiseIdentityConfirmed,
    ).toBe(true);
  });

  it("cannot take over an already-owned team", async () => {
    const created = await seededOwnerSave();
    const saveId = created.save.id;
    const loaded = await store.load(saveId);
    expect(loaded).not.toBeNull();
    const primaryId = loaded!.state.user.activeOwnerTeamId;

    const result = await takeOverFranchise(saveId, primaryId, store);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toMatch(/already under your control/i);
  });
});
