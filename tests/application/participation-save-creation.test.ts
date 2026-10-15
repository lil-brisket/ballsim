import { describe, expect, it, vi } from "vitest";

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

vi.mock("@/persistence/custom-content-repository", () => ({
  prismaCustomContentStore: {
    list: vi.fn(),
    getByContentId: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}));

import { cloneGameSettings, CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createNewOwnerSave } from "@/application/game-service";

describe("participation on save creation", () => {
  it("creates single-player saves when participation is omitted or single", async () => {
    for (const participation of [undefined, { mode: "single" }]) {
      const store = createMemorySaveGameStore();
      const result = await createNewOwnerSave(
        {
          name: "Solo",
          settings: cloneGameSettings(CBL_GAME_SETTINGS),
          rngSeed: 7,
          participation,
        },
        store,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      const loaded = await store.load(result.save.id);
      expect(loaded?.state.user.participation).toEqual({ mode: "single" });
    }
  });

  it("rejects unavailable or invalid formats without creating a save", async () => {
    const inputs: unknown[] = [
      { mode: "online" },
      {
        mode: "local_shared",
        participants: [
          { displayName: "Alex", teamCount: 1 },
          { displayName: "Sam", teamCount: 1 },
        ],
      },
      "nonsense",
    ];
    for (const participation of inputs) {
      const store = createMemorySaveGameStore();
      const result = await createNewOwnerSave(
        {
          name: "Rejected",
          settings: cloneGameSettings(CBL_GAME_SETTINGS),
          rngSeed: 7,
          participation,
        },
        store,
      );
      expect(result.ok).toBe(false);
      expect(await store.list()).toHaveLength(0);
    }
  });
});
