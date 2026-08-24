/**
 * Shared open-market catalog helpers for relocation and expansion.
 * Occupancy is derived from live teams — do not invent parallel city state.
 */

import type { GameState } from "@/state/game-state";
import {
  EXPANSION_MIN_ATTRACTIVE_MARKET_SIZE,
  OPEN_MARKET_CATALOG,
  type CatalogMarket,
} from "@/systems/market-catalog-config";

export type { CatalogMarket };

/** Cities currently hosting a franchise (case-insensitive). */
export function occupiedCities(state: GameState): Set<string> {
  const cities = new Set<string>();
  for (const team of Object.values(state.world.teams)) {
    cities.add(team.city.trim().toLowerCase());
  }
  return cities;
}

export function isCityOccupied(state: GameState, city: string): boolean {
  return occupiedCities(state).has(city.trim().toLowerCase());
}

/** Catalog markets whose city is not occupied by a live franchise. */
export function listUnoccupiedCatalogMarkets(
  state: GameState,
): CatalogMarket[] {
  const occupied = occupiedCities(state);
  return OPEN_MARKET_CATALOG.filter(
    (market) => !occupied.has(market.city.trim().toLowerCase()),
  );
}

/** Unoccupied markets large enough to be expansion opportunities. */
export function listAttractiveExpansionMarkets(
  state: GameState,
): CatalogMarket[] {
  return listUnoccupiedCatalogMarkets(state).filter(
    (market) => market.marketSize >= EXPANSION_MIN_ATTRACTIVE_MARKET_SIZE,
  );
}

export function findCatalogMarketByCity(
  city: string,
): CatalogMarket | undefined {
  const key = city.trim().toLowerCase();
  return OPEN_MARKET_CATALOG.find((m) => m.city.trim().toLowerCase() === key);
}
