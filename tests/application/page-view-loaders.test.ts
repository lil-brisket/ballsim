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

import {
  createNewOwnerSave,
  loadNotificationsPageView,
  loadOwnerDashboardPageView,
  loadOwnerSaveView,
  loadTeamHubPageView,
} from "@/application/game-service";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { TEST_RNG_SEED } from "../helpers/determinism";

describe("narrow page loaders", () => {
  it("return the same views as the full save view", async () => {
    const store = createMemorySaveGameStore();
    const created = await createNewOwnerSave(
      {
        settings: cloneGameSettings(CBL_GAME_SETTINGS),
        name: "Page loaders",
        rngSeed: TEST_RNG_SEED,
      },
      store,
    );
    if (!created.ok) {
      throw new Error("create failed");
    }
    const saveId = created.save.id;

    const full = await loadOwnerSaveView(saveId, store);
    expect(full).not.toBeNull();

    expect(await loadOwnerDashboardPageView(saveId, store)).toEqual({
      dashboard: full?.dashboard,
      ownerDashboard: full?.ownerDashboard,
    });
    expect(await loadTeamHubPageView(saveId, store)).toEqual({
      teamHub: full?.teamHub,
    });
    expect(await loadNotificationsPageView(saveId, store)).toEqual({
      dashboard: full?.dashboard,
      notifications: full?.notifications,
    });
  });

  it("return null for an unknown save", async () => {
    const store = createMemorySaveGameStore();
    expect(await loadOwnerDashboardPageView("missing", store)).toBeNull();
    expect(await loadTeamHubPageView("missing", store)).toBeNull();
    expect(await loadNotificationsPageView("missing", store)).toBeNull();
  });
});
