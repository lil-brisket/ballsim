import "server-only";
import { asSaveId } from "@/domain/ids";
import type { SaveGameStore } from "@/persistence/save-game-store";
import {
  decodeSaveExport,
  encodeSaveExport,
  saveExportFileName,
} from "@/persistence/save-export";
import { isOnlineLeague } from "@/systems/participation";
import {
  type OwnerCommandResult,
  MAX_OWNER_SAVE_SLOTS,
} from "@/application/game-service/types";
import {
  fail,
  getStore,
  loadSaveWithHistory,
  withDashboard,
} from "@/application/game-service/internal";

/** Largest save file accepted for import (a long league is ~20 MB). */
export const MAX_SAVE_IMPORT_BYTES = 64 * 1024 * 1024;

/** The whole league, history included, as a downloadable file. */
export async function exportOwnerSave(
  saveId: string,
  store?: SaveGameStore,
): Promise<{ fileName: string; json: string } | null> {
  const loaded = await loadSaveWithHistory(saveId, store);
  if (!loaded) {
    return null;
  }
  return {
    fileName: saveExportFileName(loaded.name),
    json: encodeSaveExport(loaded.name, loaded.state, new Date().toISOString()),
  };
}

/**
 * A new save from an exported file. It gets a fresh id, so importing the
 * same file twice (or next to the original) makes independent copies.
 */
export async function importOwnerSave(
  fileText: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const existing = await saveStore.list();
  if (existing.length >= MAX_OWNER_SAVE_SLOTS) {
    return fail(
      `Owner Mode allows at most ${MAX_OWNER_SAVE_SLOTS} saves. Delete a save to import another.`,
    );
  }
  const decoded = decodeSaveExport(fileText);
  if (!decoded.ok) {
    return fail(decoded.error);
  }
  // Membership belongs to accounts on the server it came from.
  if (isOnlineLeague(decoded.state)) {
    return fail("Online leagues cannot be imported.");
  }
  const saveId = crypto.randomUUID();
  const state = {
    ...decoded.state,
    meta: { ...decoded.state.meta, saveId: asSaveId(saveId) },
  };
  try {
    const loaded = await saveStore.create({
      id: saveId,
      name: decoded.name.trim() || "Imported Save",
      state,
    });
    return withDashboard(loaded);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to import save.",
    );
  }
}
