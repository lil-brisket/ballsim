import { describe, expect, it } from "vitest";
import { repairPlayerPortraits } from "@/application/repair-player-portraits";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  derivePortraitTraits,
  ensurePlayerPortraits,
} from "@/systems/portraits/assign-player-portraits";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { makeTestLibrary } from "../factories/portrait-library";
import { createTestGameState } from "../factories/game-state";

describe("repairPlayerPortraits with a library", () => {
  it("links library images, repairs removed ones, and is re-runnable", async () => {
    const base = createTestGameState({ saveId: "repair_library" });
    const bootstrapped = bootstrapWorld(
      base,
      createSeededRng(base.meta.rngState),
    ).state;
    const withFaces = ensurePlayerPortraits(bootstrapped, {
      library: [],
    }).state;
    const players = Object.keys(withFaces.world.players).length;
    const store = createMemorySaveGameStore();
    await store.create({
      id: "repair_library",
      name: "Repair library",
      state: withFaces,
    });

    const full = makeTestLibrary(players * 2);
    const first = await repairPlayerPortraits(store, { library: full });
    expect(first[0]).toMatchObject({ status: "repaired", assigned: 0 });
    expect(first[0]!.resolved).toBe(players);
    const linked = (await store.load("repair_library"))!.state.world
      .playerPortraits;
    expect(Object.values(linked).every((e) => e.libraryId !== undefined)).toBe(
      true,
    );

    const again = await repairPlayerPortraits(store, { library: full });
    expect(again[0]).toMatchObject({ status: "unchanged", resolved: 0 });

    const [someId] = Object.keys(linked);
    const removed = linked[someId!]!.libraryId;
    const trimmed = full.filter((entry) => entry.id !== removed);
    const third = await repairPlayerPortraits(store, { library: trimmed });
    expect(third[0]).toMatchObject({ status: "repaired" });
    expect(third[0]!.resolved).toBeGreaterThanOrEqual(1);
    const after = (await store.load("repair_library"))!.state.world
      .playerPortraits[someId!]!;
    expect(after.traits).toEqual(linked[someId!]!.traits);
    expect(after.libraryId).not.toBe(removed);
  });
});
