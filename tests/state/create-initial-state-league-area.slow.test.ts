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

import { getTeamCitiesForArea } from "@/data/league/team-cities-by-area";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { runMultiYearSimulation } from "../helpers/multi-year-simulation";
import { TEST_RNG_SEED } from "../helpers/determinism";

const LONG_TIMEOUT_MS = 600_000;

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
