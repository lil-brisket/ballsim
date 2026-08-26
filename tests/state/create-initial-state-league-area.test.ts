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
  selectOwnerTeam,
} from "@/application/game-service";
import { getTeamCitiesForArea } from "@/data/league/team-cities-by-area";
import {
  CBL_GAME_SETTINGS,
  cloneGameSettings,
  type LeagueArea,
} from "@/domain/game-settings";
import { DEFAULT_OWNER_PHILOSOPHY } from "@/domain/entities/owner-philosophy";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import { runMultiYearSimulation } from "../helpers/multi-year-simulation";
import { TEST_RNG_SEED } from "../helpers/determinism";

const LEAGUE_AREAS: readonly LeagueArea[] = [
  "north_america",
  "europe",
  "africa",
  "asia",
  "south_america",
  "global",
];

const LONG_TIMEOUT_MS = 600_000;

describe("createInitialGameState league area wiring", () => {
  it.each(LEAGUE_AREAS)(
    "settings.league.area=%s flows into generated team cities",
    (area) => {
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.league.area = area;
      const pool = new Set(getTeamCitiesForArea(area));

      const state = createInitialGameState({
        saveId: `area_${area}`,
        rngSeed: TEST_RNG_SEED,
        settings,
      });

      expect(state.settings.league.area).toBe(area);
      const teams = Object.values(state.world.teams);
      expect(teams.length).toBeGreaterThan(0);
      for (const team of teams) {
        expect(pool.has(team.city)).toBe(true);
      }
    },
  );

  it("defaults missing area to north_america cities", () => {
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    delete settings.league.area;
    const pool = new Set(getTeamCitiesForArea("north_america"));

    const state = createInitialGameState({
      saveId: "area_default",
      rngSeed: TEST_RNG_SEED,
      settings,
    });

    for (const team of Object.values(state.world.teams)) {
      expect(pool.has(team.city)).toBe(true);
    }
  });
});

describe("existing save does not regenerate team cities", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it("load returns the same team cities as at create time", async () => {
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    settings.league.area = "europe";

    const created = await createNewOwnerSave(
      { name: "Europe Save", rngSeed: TEST_RNG_SEED, settings },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const loadedAtCreate = await store.load(created.save.id);
    expect(loadedAtCreate).not.toBeNull();
    const citiesAtCreate = Object.values(loadedAtCreate!.state.world.teams)
      .map((team) => `${team.id}:${team.city}:${team.name}`)
      .sort();

    const reloaded = await store.load(created.save.id);
    expect(reloaded).not.toBeNull();
    const citiesOnLoad = Object.values(reloaded!.state.world.teams)
      .map((team) => `${team.id}:${team.city}:${team.name}`)
      .sort();

    expect(citiesOnLoad).toEqual(citiesAtCreate);
  });

  it.each(["north_america", "europe", "global"] as const)(
    "legacy area %s loads and reaches team pick without migration errors",
    async (area) => {
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.league.area = area;
      const created = await createNewOwnerSave(
        { name: `Legacy ${area}`, rngSeed: TEST_RNG_SEED, settings },
        store,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }
      expect(created.dashboard.teamSelectionLocked).toBe(false);
      const loaded = await store.load(created.save.id);
      expect(loaded!.state.user.citySelectionConfirmed).toBe(false);
      expect(loaded!.state.settings.league.area).toBe(area);
    },
  );
});

describe("selectOwnerTeam philosophy regression", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it("selecting a team without philosophy options preserves default philosophy", async () => {
    const created = await createNewOwnerSave(
      {
        name: "Philosophy Preserve",
        rngSeed: TEST_RNG_SEED,
        settings: CBL_GAME_SETTINGS,
      },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const before = await store.load(created.save.id);
    expect(before).not.toBeNull();
    expect(before!.state.user.ownerPhilosophy).toBe(DEFAULT_OWNER_PHILOSOPHY);

    const teamIds = Object.keys(before!.state.world.teams).sort();
    const selected = await selectOwnerTeam(
      created.save.id,
      teamIds[0]!,
      store,
    );
    expect(selected.ok).toBe(true);

    const after = await store.load(created.save.id);
    expect(after).not.toBeNull();
    expect(after!.state.user.ownerPhilosophy).toBe(DEFAULT_OWNER_PHILOSOPHY);
    expect(after!.state.user.controlledTeamId).toBe(teamIds[0]);
  });
});

describe("league area multi-year smoke", () => {
  it(
    "europe area completes 1 season without Invalid GameState",
    async () => {
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.league.area = "europe";
      const europePool = new Set(getTeamCitiesForArea("europe"));

      const result = await runMultiYearSimulation({
        seasons: 1,
        managementPreset: "off",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 20,
        settingsBase: settings,
        saveReloadEachSeason: true,
      });

      expect(result.seasonsCompleted).toBe(1);
      for (const team of Object.values(result.finalState.world.teams)) {
        expect(europePool.has(team.city)).toBe(true);
      }
    },
    LONG_TIMEOUT_MS,
  );
});
