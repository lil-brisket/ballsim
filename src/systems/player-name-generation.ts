import { FIRST_NAMES } from "@/data/names/first-names";
import { LAST_NAMES } from "@/data/names/last-names";
import {
  isPlayerNationality,
  PLAYER_NATIONALITIES,
  type PlayerNationality,
} from "@/domain/entities/player-nationality";
import type { Rng } from "@/domain/rng";

export type GeneratedPlayerName = {
  firstName: string;
  lastName: string;
  nationality: PlayerNationality;
};

export type PlayerNamePools = {
  firstNames: readonly string[];
  lastNames: readonly string[];
  nationalities: readonly PlayerNationality[];
};

const DEFAULT_POOLS: PlayerNamePools = {
  firstNames: FIRST_NAMES,
  lastNames: LAST_NAMES,
  nationalities: PLAYER_NATIONALITIES,
};

/**
 * Selects first name, last name, and nationality from expandable pools.
 * Does not mutate pools. No knowledge of ratings, teams, or UI.
 */
export function generatePlayerName(
  rng: Rng,
  pools: PlayerNamePools = DEFAULT_POOLS,
): GeneratedPlayerName {
  const firstName = pickName(pools.firstNames, "firstNames", rng);
  const lastName = pickName(pools.lastNames, "lastNames", rng);
  const nationality = pickNationality(pools.nationalities, rng);

  return { firstName, lastName, nationality };
}

function pickName(
  pool: readonly string[],
  poolName: string,
  rng: Rng,
): string {
  if (pool.length === 0) {
    throw new Error(`Player name pool "${poolName}" must not be empty.`);
  }
  const value = pool[rng.nextInt(0, pool.length - 1)]!;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Player name pool "${poolName}" contains an empty name entry.`,
    );
  }
  if (value.trim().length === 0) {
    throw new Error(
      `Player name pool "${poolName}" contains a whitespace-only name entry.`,
    );
  }
  return value;
}

function pickNationality(
  pool: readonly PlayerNationality[],
  rng: Rng,
): PlayerNationality {
  if (pool.length === 0) {
    throw new Error('Player name pool "nationalities" must not be empty.');
  }
  const value = pool[rng.nextInt(0, pool.length - 1)]!;
  if (!isPlayerNationality(value)) {
    throw new Error(
      'Player name pool "nationalities" contains an invalid nationality.',
    );
  }
  return value;
}
