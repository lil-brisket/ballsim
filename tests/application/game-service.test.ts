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
  deleteOwnerSave,
  listOwnerSavePreviews,
  loadOwnerSave,
  MAX_OWNER_SAVE_SLOTS,
  saveOwnerGame,
} from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { validateGameState } from "@/persistence/validate-game-state";
import type { GameState } from "@/state/game-state";
import * as worldPipeline from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { TEST_RNG_SEED } from "../helpers/determinism";

async function seedSaveSlots(
  store: ReturnType<typeof createMemorySaveGameStore>,
  count: number,
): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const saveId = `save_slot_${index}`;
    const state = createTestGameState({ saveId });
    await store.create({
      id: saveId,
      name: `Seeded ${index}`,
      state,
    });
    ids.push(saveId);
  }
  return ids;
}

describe("game-service load / save", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it("createNewOwnerSave → discard DTO → store.load returns valid GameState", async () => {
    const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "Owner Franchise", rngSeed: TEST_RNG_SEED },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const saveId = created.save.id;
    expect(created.dashboard).toBeDefined();

    // Simulate application restart: discard the create result.
    let runtimeResult: typeof created | undefined = created;
    runtimeResult = undefined;
    void runtimeResult;

    const loaded = await store.load(saveId);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(saveId);
    expect(loaded!.name).toBe("Owner Franchise");
    expect(() => validateGameState(loaded!.state)).not.toThrow();
    expect(Object.keys(loaded!.state.world.teams).length).toBeGreaterThan(0);
    expect(Object.keys(loaded!.state.world.players).length).toBeGreaterThan(0);
  });

  it("save A → mutate to B → save → discard → load equals B not A", async () => {
    const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "Overwrite Franchise", rngSeed: TEST_RNG_SEED },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const saveId = created.save.id;

    const loadedA = await store.load(saveId);
    expect(loadedA).not.toBeNull();
    let stateA: GameState | undefined = loadedA!.state;
    const cloneOfA = structuredClone(stateA);

    let stateB: GameState | undefined = {
      ...stateA,
      world: {
        ...stateA.world,
        calendar: {
          ...stateA.world.calendar,
          currentDate: "2026-11-20",
        },
      },
      competition: {
        ...stateA.competition,
        season: {
          ...stateA.competition.season,
          phase: "regular",
        },
      },
      meta: {
        ...stateA.meta,
        updatedAt: "2026-08-16T00:00:00.000Z",
        rngState: stateA.meta.rngState + 7,
      },
    };
    const cloneOfB = structuredClone(stateB);

    await saveOwnerGame(saveId, stateB, store);

    stateA = undefined;
    stateB = undefined;

    const loaded = await store.load(saveId);
    expect(loaded).not.toBeNull();
    expect(loaded!.state).toEqual(cloneOfB);
    expect(loaded!.state).not.toEqual(cloneOfA);
    expect(loaded!.state.world.calendar.currentDate).toBe("2026-11-20");
    expect(loaded!.state.competition.season.phase).toBe("regular");
    expect(() => validateGameState(loaded!.state)).not.toThrow();
  });

  it("loadOwnerSave returns null for a missing save", async () => {
    const result = await loadOwnerSave("does-not-exist", store);
    expect(result).toBeNull();
  });

  it("create → deleteOwnerSave → loadOwnerSave returns null", async () => {
    const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "Delete Me", rngSeed: TEST_RNG_SEED },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const removed = await deleteOwnerSave(created.save.id, store);
    expect(removed).toBe(true);
    expect(await loadOwnerSave(created.save.id, store)).toBeNull();
  });

  it("deleteOwnerSave returns false for a nonexistent id", async () => {
    const removed = await deleteOwnerSave("does-not-exist", store);
    expect(removed).toBe(false);
  });

  it("listOwnerSavePreviews maps valid saves and isolates unloadable ones", async () => {
    const created = await createNewOwnerSave(
      { settings: CBL_GAME_SETTINGS, name: "Preview Franchise", rngSeed: TEST_RNG_SEED },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    await store.create({
      id: "save_broken",
      name: "Broken Save",
      state: createTestGameState({ saveId: "save_broken" }),
    });
    const originalLoad = store.load.bind(store);
    store.load = async (id: string) => {
      if (id === "save_broken") {
        throw new Error("corrupt");
      }
      return originalLoad(id);
    };

    const previews = await listOwnerSavePreviews(store);
    expect(previews.length).toBeGreaterThanOrEqual(2);

    const ok = previews.find((p) => p.id === created.save.id);
    expect(ok?.ok).toBe(true);
    if (ok?.ok) {
      expect(ok.name).toBe("Preview Franchise");
      expect(ok.mode).toBe("owner");
      expect(ok.controlledTeam).toBeDefined();
      expect(ok.currentDate).toBeTruthy();
      expect(ok.seasonYear).toBeGreaterThan(0);
    }

    const broken = previews.find((p) => p.id === "save_broken");
    expect(broken?.ok).toBe(false);
    if (broken && !broken.ok) {
      expect(broken.error).toMatch(/incompatible|corrupted/i);
    }

    // Preview path must not delete the broken save.
    expect(await store.load("save_broken").catch(() => null)).toBeNull();
    const stillListed = (await store.list()).some((s) => s.id === "save_broken");
    expect(stillListed).toBe(true);
  });
});

describe("MAX_OWNER_SAVE_SLOTS", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it("creates successfully when 9 saves already exist", async () => {
    await seedSaveSlots(store, MAX_OWNER_SAVE_SLOTS - 1);
    const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "Tenth Slot", rngSeed: TEST_RNG_SEED },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.save.name).toBe("Tenth Slot");
    expect(await store.list()).toHaveLength(MAX_OWNER_SAVE_SLOTS);
  });

  it("rejects create at the cap without bootstrapping and leaves existing saves intact", async () => {
    const seededIds = await seedSaveSlots(store, MAX_OWNER_SAVE_SLOTS);
    const before = await store.list();
    const bootstrapSpy = vi.spyOn(worldPipeline, "bootstrapWorld");

    const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "Over Cap", rngSeed: TEST_RNG_SEED },
      store,
    );

    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error).toMatch(/at most 10 saves/i);
    expect(bootstrapSpy).not.toHaveBeenCalled();
    expect(await store.list()).toHaveLength(MAX_OWNER_SAVE_SLOTS);
    expect((await store.list()).map((row) => row.id).sort()).toEqual(
      [...seededIds].sort(),
    );
    expect((await store.list()).map((row) => row.name).sort()).toEqual(
      before.map((row) => row.name).sort(),
    );

    bootstrapSpy.mockRestore();
  });

  it("allows create again after deleting one save at the cap", async () => {
    const seededIds = await seedSaveSlots(store, MAX_OWNER_SAVE_SLOTS);
    const removed = await deleteOwnerSave(seededIds[0]!, store);
    expect(removed).toBe(true);
    expect(await store.list()).toHaveLength(MAX_OWNER_SAVE_SLOTS - 1);

    const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "After Delete", rngSeed: TEST_RNG_SEED },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.save.name).toBe("After Delete");
    expect(await store.list()).toHaveLength(MAX_OWNER_SAVE_SLOTS);
  });
});

