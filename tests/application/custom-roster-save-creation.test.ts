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
import { validateGameState } from "@/persistence/validate-game-state";
import { DEFAULT_ROSTER_SIZE } from "@/systems/roster-generation-config";
import { makeFullRosterPackage } from "../helpers/custom-content";

describe("custom roster save creation", () => {
  it("creates a valid save from a custom roster package", async () => {
    const store = createMemorySaveGameStore();
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    settings.draft.mode = "custom";
    const pkg = makeFullRosterPackage({ teamCount: settings.league.teamCount });
    const result = await createNewOwnerSave(
      { name: "Custom Save", settings, rosterPackage: pkg, rngSeed: 21 },
      store,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const loaded = await store.load(result.save.id);
    expect(loaded).not.toBeNull();
    expect(() => validateGameState(loaded!.state)).not.toThrow();
    expect(Object.keys(loaded!.state.world.players).length).toBe(
      settings.league.teamCount * DEFAULT_ROSTER_SIZE,
    );
    expect(loaded!.state.settings.draft.mode).toBe("custom");
  });

  it("creates a fantasy save from a custom roster and pads the pool", async () => {
    const store = createMemorySaveGameStore();
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    settings.draft.mode = "fantasy";
    const pkg = makeFullRosterPackage({
      teamCount: settings.league.teamCount,
      playersPerTeam: 8,
    });
    const result = await createNewOwnerSave(
      { name: "Custom Fantasy", settings, rosterPackage: pkg, rngSeed: 23 },
      store,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const loaded = await store.load(result.save.id);
    expect(loaded).not.toBeNull();
    expect(() => validateGameState(loaded!.state)).not.toThrow();
    expect(loaded!.state.settings.draft.mode).toBe("fantasy");
    expect(loaded!.state.world.fantasyDraft).not.toBeNull();
    expect(
      Object.values(loaded!.state.world.players).every(
        (player) => player.teamId === null,
      ),
    ).toBe(true);
    const customCount = Object.keys(loaded!.state.world.players).filter((id) =>
      id.startsWith("custom_"),
    ).length;
    expect(customCount).toBe(settings.league.teamCount * 8);
    expect(Object.keys(loaded!.state.world.players).length).toBeGreaterThan(
      customCount,
    );
  });

  it("does not create a save when the package has errors", async () => {
    const store = createMemorySaveGameStore();
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    settings.draft.mode = "custom";
    const result = await createNewOwnerSave(
      {
        name: "Bad Save",
        settings,
        rosterPackage: { not: "a package" },
        rngSeed: 22,
      },
      store,
    );
    expect(result.ok).toBe(false);
    expect(await store.list()).toHaveLength(0);
  });
});
