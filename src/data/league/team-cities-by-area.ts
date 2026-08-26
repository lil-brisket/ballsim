/**
 * Real-world metropolitan city pools for league generation by area.
 *
 * Data-model rules:
 * - Every entry is a recognizable real-world metropolitan/city name suitable
 *   as the first part of a fictional franchise name.
 * - No suburbs, regions, countries, or obscure locations.
 * - One entry per market (no duplicate metros).
 * - North America: major US + Canadian markets.
 * - Europe: major European cities.
 * - Global: genuinely worldwide major markets (no continental restriction).
 *
 * Target size: 40–50 cities per pool for headroom beyond max teamCount (32).
 */
import type { LeagueArea } from "@/domain/game-settings";

export const NORTH_AMERICA_TEAM_CITIES = [
  "Toronto",
  "New York",
  "Boston",
  "Los Angeles",
  "Chicago",
  "Miami",
  "Dallas",
  "Vancouver",
  "Houston",
  "Philadelphia",
  "Atlanta",
  "Phoenix",
  "Seattle",
  "Denver",
  "Montreal",
  "San Francisco",
  "Detroit",
  "Minneapolis",
  "Portland",
  "Orlando",
  "Charlotte",
  "Memphis",
  "Milwaukee",
  "Cleveland",
  "Indianapolis",
  "San Antonio",
  "Sacramento",
  "Oklahoma City",
  "New Orleans",
  "Salt Lake City",
  "Washington",
  "Calgary",
  "Edmonton",
  "Ottawa",
  "Winnipeg",
  "Las Vegas",
  "San Diego",
  "Tampa",
  "Nashville",
  "Kansas City",
  "St. Louis",
  "Columbus",
  "Pittsburgh",
  "Baltimore",
  "Austin",
] as const;

export const EUROPE_TEAM_CITIES = [
  "Munich",
  "Paris",
  "London",
  "Barcelona",
  "Milan",
  "Berlin",
  "Madrid",
  "Amsterdam",
  "Rome",
  "Vienna",
  "Lisbon",
  "Athens",
  "Stockholm",
  "Copenhagen",
  "Oslo",
  "Helsinki",
  "Dublin",
  "Brussels",
  "Zurich",
  "Prague",
  "Warsaw",
  "Budapest",
  "Bucharest",
  "Belgrade",
  "Zagreb",
  "Sofia",
  "Istanbul",
  "Manchester",
  "Birmingham",
  "Glasgow",
  "Lyon",
  "Marseille",
  "Frankfurt",
  "Hamburg",
  "Cologne",
  "Valencia",
  "Seville",
  "Naples",
  "Turin",
  "Rotterdam",
  "Porto",
  "Krakow",
  "Gothenburg",
  "Edinburgh",
  "Nice",
] as const;

export const GLOBAL_TEAM_CITIES = [
  "Tokyo",
  "Sydney",
  "Dubai",
  "Singapore",
  "Mexico City",
  "Istanbul",
  "Mumbai",
  "São Paulo",
  "Toronto",
  "Paris",
  "London",
  "New York",
  "Los Angeles",
  "Shanghai",
  "Beijing",
  "Seoul",
  "Hong Kong",
  "Bangkok",
  "Jakarta",
  "Manila",
  "Buenos Aires",
  "Rio de Janeiro",
  "Lima",
  "Bogotá",
  "Santiago",
  "Cairo",
  "Johannesburg",
  "Lagos",
  "Nairobi",
  "Cape Town",
  "Melbourne",
  "Auckland",
  "Tel Aviv",
  "Doha",
  "Riyadh",
  "Delhi",
  "Bangalore",
  "Osaka",
  "Taipei",
  "Kuala Lumpur",
  "Ho Chi Minh City",
  "Madrid",
  "Berlin",
  "Chicago",
  "Miami",
] as const;

/**
 * Returns the city pool for a league area.
 * Throws on unexpected runtime values rather than returning an empty pool.
 */
export function getTeamCitiesForArea(area: LeagueArea): readonly string[] {
  switch (area) {
    case "north_america":
      return NORTH_AMERICA_TEAM_CITIES;
    case "europe":
      return EUROPE_TEAM_CITIES;
    case "global":
      return GLOBAL_TEAM_CITIES;
    default: {
      const _exhaustive: never = area;
      throw new Error(`Unknown league area: ${String(_exhaustive)}`);
    }
  }
}
