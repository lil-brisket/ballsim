/**
 * Expandable nickname pool for fictional team generation.
 * Each nickname may be used only once within a generated league.
 * Sized above max teamCount (32); kept slightly under regional city pools
 * so exhaustion diagnostics can distinguish city vs nickname limits.
 *
 * No current or former NBA/WNBA nicknames. Generic nicknames that other
 * leagues also use are fine; generation re-pairs any city + nickname that
 * forms a real team (see reserved-team-names.ts). Replace entries in place
 * so the pool size, and with it the RNG draws, stays the same.
 */
export const TEAM_NICKNAMES = [
  "Titans",
  "Jackals",
  "Coyotes",
  "Breakers",
  "Harriers",
  "Kestrels",
  "Falcons",
  "Eagles",
  "Lions",
  "Bears",
  "Sharks",
  "Vipers",
  "Cobras",
  "Panthers",
  "Jaguars",
  "Stallions",
  "Mustangs",
  "Chargers",
  "Riptide",
  "Quasars",
  "Meteors",
  "Novas",
  "Embers",
  "Flames",
  "Tempest",
  "Monsoon",
  "Lightning",
  "Cyclones",
  "Hurricanes",
  "Avalanche",
  "Glaciers",
  "Rangers",
  "Outlaws",
  "Knights",
  "Phantoms",
  "Specters",
  "Legends",
  "Dynamos",
  "Fury",
  "Pulse",
] as const;
