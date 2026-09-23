import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { SaveVersionConflictError } from "@/persistence/save-version-conflict";
import { createInitialGameState } from "@/state/create-initial-state";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

describe("SaveGameStore ifUpdatedAt CAS", () => {
  it("rejects a stale commit token and leaves state unchanged", async () => {
    const store = createMemorySaveGameStore();
    const state = createInitialGameState({
      saveId: "cas_save",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: CBL_GAME_SETTINGS,
    });
    await store.create({ id: "cas_save", name: "CAS", state });

    const first = await store.load("cas_save");
    expect(first).not.toBeNull();
    const token = first!.updatedAt;

    const nextState: typeof state = {
      ...first!.state,
      meta: {
        ...first!.state.meta,
        updatedAt: new Date().toISOString(),
      },
    };
    await store.save({ id: "cas_save", state: nextState });

    const afterFirst = await store.load("cas_save");
    expect(afterFirst!.updatedAt.getTime()).not.toBe(token.getTime());

    await expect(
      store.save({
        id: "cas_save",
        state: {
          ...nextState,
          meta: {
            ...nextState.meta,
            updatedAt: "2099-01-01T00:00:00.000Z",
          },
        },
        ifUpdatedAt: token,
      }),
    ).rejects.toBeInstanceOf(SaveVersionConflictError);

    const final = await store.load("cas_save");
    expect(final!.updatedAt.getTime()).toBe(afterFirst!.updatedAt.getTime());
    expect(final!.state.meta.updatedAt).toBe(afterFirst!.state.meta.updatedAt);
  });

  it("commits when ifUpdatedAt matches the current row", async () => {
    const store = createMemorySaveGameStore();
    const state = createInitialGameState({
      saveId: "cas_ok",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: CBL_GAME_SETTINGS,
    });
    await store.create({ id: "cas_ok", name: "CAS OK", state });
    const loaded = await store.load("cas_ok");
    const token = loaded!.updatedAt;

    const saved = await store.save({
      id: "cas_ok",
      state: {
        ...loaded!.state,
        meta: {
          ...loaded!.state.meta,
          updatedAt: "2099-06-01T00:00:00.000Z",
        },
      },
      ifUpdatedAt: token,
    });
    expect(saved.state.meta.updatedAt).toBe("2099-06-01T00:00:00.000Z");
  });
});
