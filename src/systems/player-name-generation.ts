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

export type GeneratePlayerNameOptions = {
  occupiedNames?: ReadonlySet<string>;
  /** Extra RNG draws after the first pick when retrying collisions. */
  maxRetries?: number;
};

const DEFAULT_MAX_NAME_RETRIES = 24;

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

/**
 * Selects first name, last name, and nationality from expandable pools.
 * Does not mutate pools. No knowledge of ratings, teams, or UI.
 *
 * When occupiedNames is set, retries against active collisions. Retries consume
 * extra RNG draws after the first name draw; the first draw order is unchanged.
 * If retries are exhausted, a roman suffix is appended to the last name.
 */
export function generatePlayerName(
  rng: Rng,
  pools: PlayerNamePools = DEFAULT_POOLS,
  options: GeneratePlayerNameOptions = {},
): GeneratedPlayerName {
  const occupied = options.occupiedNames;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_NAME_RETRIES;
  let firstName = pickName(pools.firstNames, "firstNames", rng);
  let lastName = pickName(pools.lastNames, "lastNames", rng);
  const nationality = pickNationality(pools.nationalities, rng);

  if (occupied && occupied.size > 0) {
    let attempts = 0;
    while (occupied.has(fullName(firstName, lastName)) && attempts < maxRetries) {
      attempts += 1;
      firstName = pickName(pools.firstNames, "firstNames", rng);
      lastName = pickName(pools.lastNames, "lastNames", rng);
    }
    if (occupied.has(fullName(firstName, lastName))) {
      lastName = suffixLastName(lastName, occupied, firstName);
    }
  }

  return { firstName, lastName, nationality };
}

const NAME_SUFFIXES = [" Jr", " II", " III", " IV", " V"] as const;

function suffixLastName(
  lastName: string,
  occupied: ReadonlySet<string>,
  firstName: string,
): string {
  for (const suffix of NAME_SUFFIXES) {
    const candidate = `${lastName}${suffix}`;
    if (!occupied.has(fullName(firstName, candidate))) {
      return candidate;
    }
  }
  let serial = 2;
  while (occupied.has(fullName(firstName, `${lastName} ${serial}`))) {
    serial += 1;
  }
  return `${lastName} ${serial}`;
}

function pickName(pool: readonly string[], poolName: string, rng: Rng): string {
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
