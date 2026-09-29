import { normalizeSeed } from "@/domain/rng/rng";

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Independent child seed for a named stream. Does not mutate a parent Rng.
 * Workers must each call createSeededRng(deriveSeed(master, streamName)).
 */
export function deriveSeed(
  master: number | string,
  streamName: string,
): number {
  if (streamName.length === 0) {
    throw new Error("deriveSeed streamName must be non-empty.");
  }
  return fnv1a32(`${normalizeSeed(master)}:${streamName}`);
}
