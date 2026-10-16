import type { SaveGameStore } from "@/persistence/save-game-store";
import { SaveVersionConflictError } from "@/persistence/save-version-conflict";
import {
  ensurePlayerPortraits,
  getPortraitCapacityReport,
  type PortraitCapacityReport,
} from "@/systems/portraits/assign-player-portraits";

export type PlayerPortraitRepairEntry = {
  saveId: string;
  status: "repaired" | "unchanged" | "conflict" | "failed";
  assigned: number;
  capacity: PortraitCapacityReport | null;
  error?: string;
};

/**
 * Backfill / repair: fill missing portraits in every save. Re-runnable.
 * Load already migrates legacy saves (v65 backfill); this persists that and
 * repairs invalid entries. Valid assignments are never changed. Each save is
 * written independently with an optimistic CAS, so a failure partway leaves
 * every save consistent and the next run picks up where this one stopped.
 */
export async function repairPlayerPortraits(
  store: SaveGameStore,
  options: { dryRun?: boolean } = {},
): Promise<PlayerPortraitRepairEntry[]> {
  const results: PlayerPortraitRepairEntry[] = [];
  for (const summary of await store.list()) {
    try {
      const loaded = await store.load(summary.id);
      if (loaded === null) continue;
      const ensured = ensurePlayerPortraits(loaded.state);
      const capacity = getPortraitCapacityReport(ensured.state);
      // Persist when a pre-v65 row still needs its migration written back.
      const needsWrite =
        ensured.state !== loaded.state || summary.schemaVersion < 65;
      if (!needsWrite) {
        results.push({
          saveId: summary.id,
          status: "unchanged",
          assigned: 0,
          capacity,
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
        capacity,
      });
    } catch (error) {
      results.push({
        saveId: summary.id,
        status:
          error instanceof SaveVersionConflictError ? "conflict" : "failed",
        assigned: 0,
        capacity: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
