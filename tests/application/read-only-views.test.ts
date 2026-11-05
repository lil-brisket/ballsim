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
  loadContractHubView,
  loadDevelopmentHubView,
  loadDevelopmentLeagueHubView,
  loadFinanceHubView,
  loadFranchiseHubView,
  loadFranchiseOwnershipView,
  loadLeagueHubView,
  loadLeaguePlayerStatsView,
  loadLeagueTeamStatsView,
  loadMediaPageView,
  loadNotificationsPageView,
  loadOwnerDashboardPageView,
  loadOwnerSave,
  loadOwnerSaveView,
  loadRosterPageView,
  loadSettingsView,
  loadStaffHiringMarketView,
  loadStaffHubView,
  loadStandingsPageView,
  loadTeamHubPageView,
  loadTransactionHubView,
} from "@/application/game-service";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { deepFreeze } from "@/persistence/deep-freeze";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import type { SaveGameStore } from "@/persistence/save-game-store";
import { TEST_RNG_SEED } from "../helpers/determinism";

/** Serves frozen states like the read cache does outside production. */
function frozenReadStore(): SaveGameStore {
  const store = createMemorySaveGameStore();
  return {
    ...store,
    async loadReadOnly(id) {
      const loaded = await store.load(id);
      if (loaded) {
        deepFreeze(loaded.state);
      }
      return loaded;
    },
  };
}

describe("page view loaders on a shared cached state", () => {
  it.each([
    ["loadOwnerSave", loadOwnerSave],
    ["loadOwnerSaveView", loadOwnerSaveView],
    ["loadOwnerDashboardPageView", loadOwnerDashboardPageView],
    ["loadTeamHubPageView", loadTeamHubPageView],
    ["loadNotificationsPageView", loadNotificationsPageView],
    ["loadRosterPageView", loadRosterPageView],
    ["loadLeagueHubView", loadLeagueHubView],
    ["loadContractHubView", loadContractHubView],
    ["loadStaffHubView", loadStaffHubView],
    ["loadStaffHiringMarketView", loadStaffHiringMarketView],
    ["loadDevelopmentHubView", loadDevelopmentHubView],
    ["loadDevelopmentLeagueHubView", loadDevelopmentLeagueHubView],
    ["loadFinanceHubView", loadFinanceHubView],
    ["loadFranchiseHubView", loadFranchiseHubView],
    ["loadFranchiseOwnershipView", loadFranchiseOwnershipView],
    ...(
      [
        ["loadSettingsView", loadSettingsView],
        ["loadLeagueTeamStatsView", loadLeagueTeamStatsView],
        ["loadLeaguePlayerStatsView", loadLeaguePlayerStatsView],
        ["loadMediaPageView", loadMediaPageView],
        ["loadStandingsPageView", loadStandingsPageView],
        ["loadTransactionHubView", loadTransactionHubView],
      ] as const
    ).map(
      ([name, loader]) =>
        [
          name,
          (id: string, store: SaveGameStore) => loader(id, {}, store),
        ] as const,
    ),
  ] as const)("%s does not change the state", async (_name, loader) => {
    const store = frozenReadStore();
    const created = await createNewOwnerSave(
      {
        settings: cloneGameSettings(CBL_GAME_SETTINGS),
        name: "Read only",
        rngSeed: TEST_RNG_SEED,
      },
      store,
    );
    if (!created.ok) {
      throw new Error("create failed");
    }
    const load = loader as (id: string, s: SaveGameStore) => Promise<unknown>;
    expect(await load(created.save.id, store)).toEqual(expect.anything());
  });
});
