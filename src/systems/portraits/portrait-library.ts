import manifest from "@/data/portrait-library.manifest.json";
import type {
  PortraitLibraryEntry,
  PortraitLibraryManifest,
} from "@/domain/portrait-library";

/**
 * The shipped library, from src/data/portrait-library.manifest.json. Empty
 * until images are ingested; every consumer falls back to the SVG face then.
 */
export const PORTRAIT_LIBRARY_MANIFEST =
  manifest as unknown as PortraitLibraryManifest;

export const PORTRAIT_LIBRARY: readonly PortraitLibraryEntry[] =
  PORTRAIT_LIBRARY_MANIFEST.entries;

const SHIPPED_IDS: ReadonlySet<string> = new Set(
  PORTRAIT_LIBRARY.map((entry) => entry.id),
);

/** True when `id` is an entry of the shipped library. */
export function isShippedPortraitLibraryId(id: string): boolean {
  return SHIPPED_IDS.has(id);
}
