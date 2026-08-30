/**
 * Scouting region resolution from league area + prospect nationality.
 * Does NOT change prospect generation — read-only coverage lookup.
 */

import type { LeagueArea } from "@/domain/game-settings";
import type { PlayerNationality } from "@/domain/entities/player-nationality";
import type { ScoutingRegion } from "@/domain/entities/scouting-types";

/** Domestic nationalities for each league area (scouting coverage only). */
export const DOMESTIC_NATIONALITIES_BY_AREA: Record<
  LeagueArea,
  readonly PlayerNationality[]
> = {
  north_america: ["USA", "Canada", "Mexico"],
  europe: [
    "Spain",
    "France",
    "Germany",
    "Italy",
    "Serbia",
    "Greece",
  ],
  africa: ["Nigeria", "Senegal"],
  asia: ["Japan", "China", "Philippines"],
  south_america: ["Brazil", "Argentina"],
  global: [
    "USA",
    "Canada",
    "Mexico",
    "Brazil",
    "Argentina",
    "Spain",
    "France",
    "Germany",
    "Italy",
    "Serbia",
    "Greece",
    "Australia",
    "New Zealand",
    "Nigeria",
    "Senegal",
    "Japan",
    "China",
    "Philippines",
  ],
};

export function domesticNationalitiesForArea(
  area: LeagueArea,
): readonly PlayerNationality[] {
  return DOMESTIC_NATIONALITIES_BY_AREA[area];
}

export function resolveScoutingRegion(
  leagueArea: LeagueArea,
  nationality: PlayerNationality,
): ScoutingRegion {
  const domestic = DOMESTIC_NATIONALITIES_BY_AREA[leagueArea];
  if (domestic.includes(nationality)) {
    return "domestic";
  }
  return "international";
}

export function isDomesticNationality(
  leagueArea: LeagueArea,
  nationality: PlayerNationality,
): boolean {
  return resolveScoutingRegion(leagueArea, nationality) === "domestic";
}
