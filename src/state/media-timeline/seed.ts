/**
 * Presentation-only FNV-1a hash for the timeline's social layer. Every choice
 * (author, template, reply, jitter) derives from `(saveId, post.id, salt)`, so
 * the same save always renders the same posts.
 * Must not import from src/domain/rng — this is not simulation RNG.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Stable uint32 hash of the parts joined with a separator. */
export function hashParts(...parts: Array<string | number>): number {
  const joined = parts.join("␟");
  let hash = FNV_OFFSET;
  for (let index = 0; index < joined.length; index += 1) {
    hash ^= joined.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  // Final avalanche so small modulo picks use well-mixed bits.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** Picks a list entry by hash. The list must not be empty. */
export function pick<T>(list: readonly T[], hash: number): T {
  return list[hash % list.length]!;
}

/** Maps a hash onto [0, 1). */
export function unitFromHash(hash: number): number {
  return (hash >>> 0) / 0x1_0000_0000;
}
