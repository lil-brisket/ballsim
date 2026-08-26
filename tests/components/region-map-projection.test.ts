import { describe, expect, it } from "vitest";
import {
  cityProjectsInsideViewport,
  REGION_MAP_CONFIG,
} from "@/components/owner/region-map-config";
import { getCitiesForArea } from "@/data/league/city-locations";
import { LEAGUE_AREAS } from "@/data/league/team-cities-by-area";

describe("region map projection", () => {
  it.each(LEAGUE_AREAS)(
    "every %s city projects inside its region viewport",
    (area) => {
      const config = REGION_MAP_CONFIG[area];
      for (const city of getCitiesForArea(area)) {
        expect(
          cityProjectsInsideViewport(city.lat, city.lng, config),
          `${city.name} (${city.lat},${city.lng}) outside ${area} bounds`,
        ).toBe(true);
      }
    },
  );
});
