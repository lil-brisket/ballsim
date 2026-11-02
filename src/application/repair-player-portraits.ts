import type { PortraitLibraryEntry } from "@/domain/portrait-library";
import type { SaveGameStore } from "@/persistence/save-game-store";
import { SaveVersionConflictError } from "@/persistence/save-version-conflict";
import {
  ensurePlayerPortraits,
  getPortraitCapacityReport,
  getPortraitUsageReport,
  type PortraitCapacityReport,
  type PortraitUsageReport,
} from "@/systems/portraits/assign-player-portraits";

export type PlayerPortraitRepairEntry = {
  saveId: string;
  status: "repaired" | "unchanged" | "conflict" | "failed";
  assigned: number;
  /** Existing faces that gained (or re-resolved) a library image. */
  resolved: number;
  capacity: PortraitCapacityReport | null;
  /** Per-image usage in this save (null on failure). */
  usage: PortraitUsageReport | null;
  error?: string;
};

/**
 * Backfill / repair: fill missing portraits and library images in every save.
 * Re-runnable. Load already migrates legacy saves; this persists that, repairs
 * invalid entries, and re-resolves library images that left the manifest.
 * Valid faces are never changed. Each save is
 * written independently with an optimistic CAS, so a failure partway leaves
 * every save consistent and the next run picks up where this one stopped.
 */
export async function repairPlayerPortraits(
  store: SaveGameStore,
  options: {
    dryRun?: boolean;
    /** Library to resolve against; defaults to the shipped manifest. */
    library?: readonly PortraitLibraryEntry[];
  } = {},
): Promise<PlayerPortraitRepairEntry[]> {
  const results: PlayerPortraitRepairEntry[] = [];
  for (const summary of await store.list()) {
    try {
      const loaded = await store.load(summary.id);
      if (loaded === null) continue;
      const ensured = ensurePlayerPortraits(loaded.state, {
        library: options.library,
      });
      const capacity = getPortraitCapacityReport(ensured.state);
      const usage = getPortraitUsageReport(ensured.state, options.library);
      // Persist when a pre-v65 row still needs its migration written back.
      const needsWrite =
        ensured.state !== loaded.state || summary.schemaVersion < 65;
      if (!needsWrite) {
        results.push({
          saveId: summary.id,
          status: "unchanged",
          assigned: 0,
          resolved: 0,
          capacity,
          usage,
        });
        continue;
      }
      if (options.dryRun !== true) {
        await store.save({
          id: summary.id,
          state: ensured.state,
          ifUpdatedAt: loaded.updatedAt,
        });
      }
      results.push({
        saveId: summary.id,
        status: "repaired",
        assigned: ensured.assigned,
        resolved: ensured.resolved,
        capacity,
        usage,
      });
    } catch (error) {
      results.push({
        saveId: summary.id,
        status:
          error instanceof SaveVersionConflictError ? "conflict" : "failed",
        assigned: 0,
        resolved: 0,
        capacity: null,
        usage: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
