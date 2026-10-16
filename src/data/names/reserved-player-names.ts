/**
 * Real people's full names that FIRST_NAMES x LAST_NAMES can form. First and
 * last names are drawn independently, so a fictional pool can still produce
 * a real athlete; generation skips these. Every entry must be formable from
 * the pools (a test checks this) — when a pool changes, re-check notable
 * athletes for new matches and add them here.
 */
export const RESERVED_PLAYER_NAMES = [
  "Aaron Boone",
  "Aaron Brooks",
  "Adrian Griffin",
  "Andre Reed",
  "Blake Griffin",
  "Bryce Harper",
  "Cole Porter",
  "Dylan Harper",
  "Grant Holt",
  "Jordan Reed",
  "Jordan Walker",
  "Miles Turner",
  "Owen Nolan",
  "Terrell Owens",
] as const;

const RESERVED = new Set<string>(RESERVED_PLAYER_NAMES);

/** True when `firstName lastName` is a reserved real person's name. */
export function isReservedPlayerName(
  firstName: string,
  lastName: string,
): boolean {
  return RESERVED.has(`${firstName} ${lastName}`);
}

/**
 * Keeps `lastName` unless it makes a reserved name with `firstName`; then
 * takes the next last name in `pool` order (wrapping). Draws no RNG, so the
 * rest of generation is unchanged.
 */
export function fictionalLastName(
  firstName: string,
  lastName: string,
  pool: readonly string[],
): string {
  if (!isReservedPlayerName(firstName, lastName)) {
    return lastName;
  }
  const start = pool.indexOf(lastName);
  for (let step = 1; step < pool.length; step += 1) {
    const candidate = pool[(start + step) % pool.length]!;
    if (!isReservedPlayerName(firstName, candidate)) {
      return candidate;
    }
  }
  return lastName;
}
