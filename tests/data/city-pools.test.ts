import { describe, expect, it } from "vitest";
import {
  allKnownCities,
  formatCityLocation,
  getCitiesForArea,
  getCityByName,
  isCityInArea,
  normalizeCityName,
} from "@/data/league/city-locations";
import {
  AFRICA_TEAM_CITIES,
  ASIA_TEAM_CITIES,
  EUROPE_TEAM_CITIES,
  getTeamCitiesForArea,
  GLOBAL_TEAM_CITIES,
  LEAGUE_AREAS,
  NORTH_AMERICA_TEAM_CITIES,
  REGIONAL_LEAGUE_AREAS,
  SOUTH_AMERICA_TEAM_CITIES,
} from "@/data/league/team-cities-by-area";
import type { LeagueArea } from "@/domain/game-settings";

describe("city pools data integrity", () => {
  it.each(LEAGUE_AREAS)("%s has no duplicate city names", (area) => {
    const pool = getTeamCitiesForArea(area);
    expect(new Set(pool).size).toBe(pool.length);
  });

  it.each(LEAGUE_AREAS)("%s cities all have locations", (area) => {
    for (const name of getTeamCitiesForArea(area)) {
      const city = getCityByName(name);
      expect(city, `missing location for ${name}`).not.toBeNull();
      expect(city!.name).toBe(name);
      expect(Number.isFinite(city!.lat)).toBe(true);
      expect(Number.isFinite(city!.lng)).toBe(true);
      expect(city!.lat).toBeGreaterThanOrEqual(-90);
      expect(city!.lat).toBeLessThanOrEqual(90);
      expect(city!.lng).toBeGreaterThanOrEqual(-180);
      expect(city!.lng).toBeLessThanOrEqual(180);
      expect(city!.country.length).toBeGreaterThan(0);
    }
  });

  it("US cities in North America have a subdivision", () => {
    for (const city of getCitiesForArea("north_america")) {
      if (city.country === "United States") {
        expect(city.subdivision, city.name).toBeTruthy();
      }
    }
  });

  it.each(LEAGUE_AREAS)("%s getCitiesForArea matches pool size", (area) => {
    expect(getCitiesForArea(area)).toHaveLength(getTeamCitiesForArea(area).length);
  });

  it("regional pools are pairwise disjoint", () => {
    for (let i = 0; i < REGIONAL_LEAGUE_AREAS.length; i += 1) {
      for (let j = i + 1; j < REGIONAL_LEAGUE_AREAS.length; j += 1) {
        const a = REGIONAL_LEAGUE_AREAS[i]!;
        const b = REGIONAL_LEAGUE_AREAS[j]!;
        const setA = new Set(getTeamCitiesForArea(a));
        for (const city of getTeamCitiesForArea(b)) {
          expect(setA.has(city), `${city} in both ${a} and ${b}`).toBe(false);
        }
      }
    }
  });

  it("allows global overlap with regional pools", () => {
    const regional = new Set(
      REGIONAL_LEAGUE_AREAS.flatMap((area) => [...getTeamCitiesForArea(area)]),
    );
    const overlap = GLOBAL_TEAM_CITIES.filter((city) => regional.has(city));
    expect(overlap.length).toBeGreaterThan(0);
  });

  it("has no duplicate coordinates within each regional pool", () => {
    for (const area of REGIONAL_LEAGUE_AREAS) {
      const seen = new Set<string>();
      for (const city of getCitiesForArea(area)) {
        const key = `${city.lat},${city.lng}`;
        expect(seen.has(key), `duplicate coords ${key} in ${area}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("includes Mexico in North America", () => {
    expect(NORTH_AMERICA_TEAM_CITIES).toContain("Mexico City");
    expect(NORTH_AMERICA_TEAM_CITIES).toContain("Monterrey");
  });

  it("exposes dedicated continental pools", () => {
    expect(AFRICA_TEAM_CITIES.length).toBeGreaterThanOrEqual(40);
    expect(ASIA_TEAM_CITIES.length).toBeGreaterThanOrEqual(40);
    expect(SOUTH_AMERICA_TEAM_CITIES.length).toBeGreaterThanOrEqual(40);
    expect(EUROPE_TEAM_CITIES.length).toBeGreaterThanOrEqual(40);
  });
});

describe("normalizeCityName", () => {
  it("matches canonical names case-insensitively", () => {
    expect(normalizeCityName("  toronto ")).toBe("Toronto");
    expect(normalizeCityName("MEXICO CITY")).toBe("Mexico City");
  });

  it("matches accented names", () => {
    expect(normalizeCityName("Sao Paulo")).toBe("São Paulo");
    expect(normalizeCityName("bogota")).toBe("Bogotá");
  });

  it("returns null for unknown cities", () => {
    expect(normalizeCityName("")).toBeNull();
    expect(normalizeCityName("Not A City")).toBeNull();
  });

  it("isCityInArea uses saved area pool", () => {
    expect(isCityInArea("Tokyo", "asia")).toBe(true);
    expect(isCityInArea("Tokyo", "north_america")).toBe(false);
    expect(isCityInArea("Monterrey", "north_america")).toBe(true);
  });

  it("allKnownCities is non-empty", () => {
    expect(allKnownCities().length).toBeGreaterThan(100);
  });

  it("formatCityLocation includes subdivision when present", () => {
    expect(
      formatCityLocation({ country: "United States", subdivision: "Georgia" }),
    ).toBe("Georgia, United States");
    expect(formatCityLocation({ country: "France" })).toBe("France");
  });
});

describe("league area coverage", () => {
  it("covers all six LeagueArea values", () => {
    const expected: LeagueArea[] = [
      "north_america",
      "europe",
      "africa",
      "asia",
      "south_america",
      "global",
    ];
    expect([...LEAGUE_AREAS].sort()).toEqual([...expected].sort());
  });
});
