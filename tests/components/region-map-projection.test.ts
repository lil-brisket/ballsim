import { describe, expect, it } from "vitest";
import {
  cityProjectsInsideViewport,
  getRegionAdmin1LineFeatures,
  projectCityToMap,
  REGION_MAP_CONFIG,
} from "@/components/map/region-projection-config";
import { getCitiesForArea } from "@/data/league/city-locations";
import { LEAGUE_AREAS } from "@/data/league/team-cities-by-area";

describe("region map projection", () => {
  it.each(LEAGUE_AREAS)(
    "every %s city projects inside its region viewport",
    (area) => {
      for (const city of getCitiesForArea(area)) {
        expect(
          cityProjectsInsideViewport(city.lat, city.lng, area),
          `${city.name} (${city.lat},${city.lng}) outside ${area} bounds`,
        ).toBe(true);
      }
    },
  );

  it("uses distinct viewports for North America, Europe, and Global", () => {
    const na = REGION_MAP_CONFIG.north_america;
    const eu = REGION_MAP_CONFIG.europe;
    const world = REGION_MAP_CONFIG.global;
    expect(na.projectionKind).toBe("albers");
    expect(eu.projectionKind).toBe("mercator");
    expect(world.projectionKind).toBe("naturalEarth");
    expect(na.viewport).not.toEqual(eu.viewport);
    expect(world.viewport).not.toEqual(na.viewport);
  });

  it("places western North American cities left of eastern cities", () => {
    const seattle = projectCityToMap(47.61, -122.33, "north_america");
    const boston = projectCityToMap(42.36, -71.06, "north_america");
    const miami = projectCityToMap(25.76, -80.19, "north_america");
    const toronto = projectCityToMap(43.65, -79.38, "north_america");
    expect(seattle.x).toBeLessThan(boston.x);
    expect(miami.y).toBeGreaterThan(toronto.y);
  });

  it("includes US and Canadian interior state and province lines for North America", () => {
    const lines = getRegionAdmin1LineFeatures("north_america");
    expect(lines.length).toBeGreaterThan(80);
  });

  it("fits North American cities across most of the viewport", () => {
    const seattle = projectCityToMap(47.61, -122.33, "north_america");
    const boston = projectCityToMap(42.36, -71.06, "north_america");
    const { width } = REGION_MAP_CONFIG.north_america.viewport;
    expect(boston.x - seattle.x).toBeGreaterThan(width * 0.45);
  });
});
