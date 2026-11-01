import { createHash } from "node:crypto";
import { derivePortraitTraits } from "@/systems/portraits/assign-player-portraits";
import type {
  PortraitLibraryEntry,
  PortraitLibraryTraits,
} from "@/domain/portrait-library";

/** A manifest-valid entry; sha256 is derived from the id so entries never collide. */
export function libraryEntry(
  id: string,
  traits: PortraitLibraryTraits,
): PortraitLibraryEntry {
  return {
    id,
    file: `${id}.webp`,
    traits,
    sha256: createHash("sha256").update(`image:${id}`).digest("hex"),
    approvedAt: "2026-11-01T00:00:00.000Z",
  };
}

/** `count` entries with pseudo-random (FNV-derived) traits and ids p0001... */
export function makeTestLibrary(count: number): PortraitLibraryEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const {
      ears: _ears,
      accessory: _accessory,
      ...traits
    } = derivePortraitTraits("library", `entry_${index}`, 0);
    void _ears;
    void _accessory;
    return libraryEntry(`p${String(index + 1).padStart(4, "0")}`, traits);
  });
}
