/**
 * Derives a unique 3-letter abbreviation from a city name with deterministic
 * collision fallbacks (no RNG).
 *
 * Order: the first three letters ("Toronto" → TOR); then letter-only
 * candidates built from the city (see `letterCandidates`); then the first two
 * letters plus A–Z; and only then the first two letters plus a digit.
 * Abbreviations are stored on the team, so this only affects new teams.
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
    letters.length >= 3 ? letters.slice(0, 3) : (letters + "XXX").slice(0, 3);

  if (!used.has(base)) {
    return base;
  }

  for (const candidate of letterCandidates(city)) {
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

  for (let suffix = 0; suffix < 10; suffix += 1) {
    const candidate = `${base.slice(0, 2)}${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not derive a unique abbreviation for city "${city}".`);
}

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

/**
 * Letter-only fallbacks in priority order, all starting with the city's first
 * letter:
 * 1. Word initials for 3+ word cities ("Mar del Plata" → MDP).
 * 2. For 2+ words, the first initial with the last word's first and last
 *    letters ("San Francisco" → SFO), then its first two ("San Francisco" →
 *    SFR).
 * 3. Two later consonants in order ("Toronto" → TRN, TRT, TNT).
 * 4. Any two later letters in order ("Toronto" → TOO, TON, TOT, …).
 */
function letterCandidates(city: string): string[] {
  const words = city
    .split(/[\s-]+/)
    .map((word) => word.replace(/[^A-Za-z]/g, "").toUpperCase())
    .filter((word) => word.length > 0);
  const letters = words.join("");
  const first = letters[0];
  if (!first) {
    return [];
  }

  const candidates: string[] = [];
  if (words.length >= 3) {
    candidates.push(words[0]![0]! + words[1]![0]! + words[2]![0]!);
  }
  if (words.length >= 2) {
    const last = words[words.length - 1]!;
    candidates.push(first + last[0]! + last[last.length - 1]!);
    candidates.push(first + last.slice(0, 2));
  }
  const rest = [...letters.slice(1)];
  const consonants = rest.filter((letter) => !VOWELS.has(letter));
  candidates.push(...orderedPairs(consonants).map((pair) => first + pair));
  candidates.push(...orderedPairs(rest).map((pair) => first + pair));
  return candidates.filter((candidate) => candidate.length === 3);
}

/** Every in-order pair from `letters` ("ABC" → AB, AC, BC). */
function orderedPairs(letters: readonly string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < letters.length; i += 1) {
    for (let j = i + 1; j < letters.length; j += 1) {
      pairs.push(letters[i]! + letters[j]!);
    }
  }
  return pairs;
}
