/**
 * Open-market catalog for relocation destinations and expansion candidates.
 * Config only — not a live simulation of demographics.
 */

export type CatalogMarket = {
  city: string;
  name: string;
  abbreviation: string;
  marketSize: number;
};

/**
 * Unoccupied by default; occupancy is derived from live Team.city at runtime.
 * Includes former hardcoded Harbor / Summit / Canyon plus additional options.
 */
export const OPEN_MARKET_CATALOG: readonly CatalogMarket[] = [
  { city: "Harbor", name: "Waves", abbreviation: "HAR", marketSize: 62 },
  { city: "Summit", name: "Skyhawks", abbreviation: "SUM", marketSize: 58 },
  { city: "Canyon", name: "Rattlers", abbreviation: "CAN", marketSize: 52 },
  { city: "Cascade", name: "Timber", abbreviation: "CAS", marketSize: 48 },
  { city: "Metro", name: "Pulse", abbreviation: "MET", marketSize: 78 },
  { city: "Bayou", name: "Storm", abbreviation: "BAY", marketSize: 55 },
  { city: "Prairie", name: "Wind", abbreviation: "PRA", marketSize: 42 },
  { city: "Capital", name: "Guards", abbreviation: "CAP", marketSize: 85 },
  { city: "Desert", name: "Suns", abbreviation: "DES", marketSize: 50 },
  { city: "Lake", name: "Shore", abbreviation: "LAK", marketSize: 45 },
] as const;

/** Minimum market size considered worth expansion placement. */
export const EXPANSION_MIN_ATTRACTIVE_MARKET_SIZE = 45;
