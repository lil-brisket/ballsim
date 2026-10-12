/**
 * Presentation-only FNV-1a hash for deterministic player portraits.
 * Must not import from src/domain/rng — this is not simulation RNG.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export const PORTRAIT_PLATE_COUNT = 8;
export const PORTRAIT_COMPOSITION_COUNT = 6;

/**
 * Stable uint32 hash of a player id. Same id → same hash across remounts and saves.
 */
export function hashPlayerIdForPortrait(playerId: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < playerId.length; index += 1) {
    hash ^= playerId.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function portraitPlateIndex(hash: number): number {
  return hash & (PORTRAIT_PLATE_COUNT - 1);
}

export function portraitCompositionIndex(hash: number): number {
  return (hash >>> 3) % PORTRAIT_COMPOSITION_COUNT;
}

export function splitDisplayName(name: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = name.trim();
  const space = trimmed.indexOf(" ");
  if (space < 0) {
    return { firstName: trimmed, lastName: "" };
  }
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1),
  };
}
