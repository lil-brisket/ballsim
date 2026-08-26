/**
 * Derives a unique 3-letter abbreviation from a city name with deterministic
 * collision suffixes (no RNG).
 *
 * Invariant: always returns a unique abbreviation among `used`, or throws
 * deterministically if the finite candidate namespace is exhausted.
 */
export function uniqueTeamAbbreviation(
  city: string,
  used: ReadonlySet<string>,
): string {
  const letters = city.replace(/[^A-Za-z]/g, "").toUpperCase();
  const base =
    letters.length >= 3
      ? letters.slice(0, 3)
      : (letters + "XXX").slice(0, 3);

  if (!used.has(base)) {
    return base;
  }

  for (let suffix = 0; suffix < 10; suffix += 1) {
    const candidate = `${base.slice(0, 2)}${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  for (let code = 65; code <= 90; code += 1) {
    const candidate = `${base.slice(0, 2)}${String.fromCharCode(code)}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not derive a unique abbreviation for city "${city}".`,
  );
}
