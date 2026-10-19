/**
 * Jersey numbers. Every player wears a number 0–99, unique among the
 * non-retired players of his franchise. Numbers are presentation and
 * identity only: the simulation never reads them, and they are chosen from
 * the player id with a string hash, never simulation RNG, so adding them
 * changes no seeded outcome.
 */

export const JERSEY_NUMBER_MIN = 0;
export const JERSEY_NUMBER_MAX = 99;

/**
 * Numbers players actually pick, most common first. A player's preferred
 * number comes from this list; less common numbers are only used when a
 * team has taken all of them.
 */
const POPULAR_NUMBERS: readonly number[] = [
  0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 20, 21, 22, 23, 24, 25,
  30, 31, 32, 33, 34, 35, 40, 41, 42, 44, 45, 50, 55,
];

/** FNV-1a hash of `text` (uint32). */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

export function isJerseyNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= JERSEY_NUMBER_MIN &&
    value <= JERSEY_NUMBER_MAX
  );
}

/** The number a player picks when it is free; stable for a player id. */
export function preferredJerseyNumber(playerId: string): number {
  return POPULAR_NUMBERS[hash(playerId) % POPULAR_NUMBERS.length]!;
}

/**
 * Every number in the order this player would try them: his preferred
 * number, the rest of the popular list (rotated per player so teammates
 * spread out), then the remaining numbers ascending.
 */
function preferenceOrder(playerId: string): number[] {
  const start = hash(playerId) % POPULAR_NUMBERS.length;
  const popular = POPULAR_NUMBERS.map(
    (_, i) => POPULAR_NUMBERS[(start + i) % POPULAR_NUMBERS.length]!,
  );
  const rest: number[] = [];
  for (let n = JERSEY_NUMBER_MIN; n <= JERSEY_NUMBER_MAX; n += 1) {
    if (!POPULAR_NUMBERS.includes(n)) {
      rest.push(n);
    }
  }
  return [...popular, ...rest];
}

/**
 * The number a player wears given the numbers his teammates already wear:
 * his current number when it is valid and free, otherwise the first free
 * number in his preference order. Keeps `current` if every number is taken.
 */
export function freeJerseyNumber(
  playerId: string,
  current: number | undefined,
  taken: ReadonlySet<number>,
): number {
  if (isJerseyNumber(current) && !taken.has(current)) {
    return current;
  }
  for (const n of preferenceOrder(playerId)) {
    if (!taken.has(n)) {
      return n;
    }
  }
  return isJerseyNumber(current) ? current : preferredJerseyNumber(playerId);
}
