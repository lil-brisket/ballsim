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
  loadOwnerSave,
  saveOwnerGame,
} from "@/application/game-service";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { validateGameState } from "@/persistence/validate-game-state";
import type { GameState } from "@/state/game-state";
import { TEST_RNG_SEED } from "../helpers/determinism";

describe("game-service load / save", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it("createNewOwnerSave → discard DTO → store.load returns valid GameState", async () => {
    const created = await createNewOwnerSave(
      { name: "Owner Franchise", rngSeed: TEST_RNG_SEED },
      store,
    );
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
    const created = await createNewOwnerSave(
      { name: "Overwrite Franchise", rngSeed: TEST_RNG_SEED },
      store,
    );
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
    const created = await createNewOwnerSave(
      { name: "Delete Me", rngSeed: TEST_RNG_SEED },
      store,
    );
    const removed = await deleteOwnerSave(created.save.id, store);
    expect(removed).toBe(true);
    expect(await loadOwnerSave(created.save.id, store)).toBeNull();
  });

  it("deleteOwnerSave returns false for a nonexistent id", async () => {
    const removed = await deleteOwnerSave("does-not-exist", store);
    expect(removed).toBe(false);
  });
});
