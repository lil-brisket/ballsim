import "server-only";

import { createInitialGameState } from "@/state/create-initial-state";
import { toDashboardSnapshot } from "@/state/selectors";
import type { DashboardSnapshot } from "@/state/selectors";
import {
  createSaveGame,
  getSaveGame,
  listSaveGames,
  type SaveGameSummary,
} from "@/persistence/save-game-repository";

export type CreateGameResult = {
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
};

export async function createNewOwnerSave(input: {
  name: string;
  rngSeed?: number;
}): Promise<CreateGameResult> {
  const saveId = crypto.randomUUID();
  const state = createInitialGameState({
    saveId,
    rngSeed: input.rngSeed,
  });

  const loaded = await createSaveGame({
    id: saveId,
    name: input.name.trim() || "New Franchise",
    state,
  });

  return {
    save: {
      id: loaded.id,
      name: loaded.name,
      schemaVersion: loaded.schemaVersion,
      createdAt: loaded.createdAt,
      updatedAt: loaded.updatedAt,
    },
    dashboard: toDashboardSnapshot(loaded.state),
  };
}

export async function loadOwnerSave(
  saveId: string,
): Promise<CreateGameResult | null> {
  const loaded = await getSaveGame(saveId);
  if (!loaded) {
    return null;
  }

  return {
    save: {
      id: loaded.id,
      name: loaded.name,
      schemaVersion: loaded.schemaVersion,
      createdAt: loaded.createdAt,
      updatedAt: loaded.updatedAt,
    },
    dashboard: toDashboardSnapshot(loaded.state),
  };
}

export async function listOwnerSaves(): Promise<SaveGameSummary[]> {
  return listSaveGames();
}
