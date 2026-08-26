import { describe, expect, it } from "vitest";
import { applyOwnerCitySelection } from "@/systems/owner-city-selection";
import {
  cityProjectsInsideViewport,
  REGION_MAP_CONFIG,
} from "@/components/map/region-projection-config";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import type { LeagueArea } from "@/domain/game-settings";
import { getTeamCitiesForArea } from "@/data/league/team-cities-by-area";
import { createInitialGameState } from "@/state/create-initial-state";
import { listCitiesForTeamPick } from "@/state/selectors";
import { TEST_RNG_SEED } from "../helpers/determinism";

const AREAS: LeagueArea[] = ["north_america", "europe", "global"];

describe("city selection across league areas", () => {
  it.each(AREAS)(
    "%s generates pool cities, projects them, and accepts a custom nickname",
    (area) => {
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.league.area = area;
      const state = createInitialGameState({
        saveId: `area_${area}`,
        rngSeed: TEST_RNG_SEED,
        settings,
      });
      const pool = getTeamCitiesForArea(area);
      const cities = listCitiesForTeamPick(state);
      expect(cities.length).toBe(pool.length);
      expect(cities.every((city) => pool.includes(city.city))).toBe(true);
      expect(cities.every((city) => city.country.length > 0)).toBe(true);
      expect(cities.every((city) => city.locationLabel.length > 0)).toBe(true);

      expect(REGION_MAP_CONFIG[area]).toBeDefined();
      for (const city of cities) {
        expect(cityProjectsInsideViewport(city.lat, city.lng, area)).toBe(true);
      }

      const available = cities.find((city) => !city.occupied);
      expect(available).toBeDefined();
      const result = applyOwnerCitySelection(state, available!.city, {
        nickname: "Storm",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      const team =
        result.state.world.teams[result.state.user.controlledTeamId]!;
      expect(pool.includes(team.city)).toBe(true);
      expect(team.city).toBe(available!.city);
      expect(team.name).toBe("Storm");
    },
  );
});
