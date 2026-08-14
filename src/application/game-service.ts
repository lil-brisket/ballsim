import "server-only";

import { createSeededRng } from "@/domain/rng";
import type { DomainEvent } from "@/domain/events";
import { createInitialGameState } from "@/state/create-initial-state";
import { toDashboardSnapshot } from "@/state/selectors";
import type { DashboardSnapshot } from "@/state/selectors";
import {
  bootstrapWorld,
  runWorldPipeline,
} from "@/systems/world-pipeline";
import {
  createSaveGame,
  getSaveGame,
  listSaveGames,
  updateSaveGameState,
  type SaveGameSummary,
} from "@/persistence/save-game-repository";

export type CreateGameResult = {
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
};

export type AdvanceDayResult = CreateGameResult & {
  events: DomainEvent[];
};

function toSaveSummary(loaded: {
  id: string;
  name: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): SaveGameSummary {
  return {
    id: loaded.id,
    name: loaded.name,
    schemaVersion: loaded.schemaVersion,
    createdAt: loaded.createdAt,
    updatedAt: loaded.updatedAt,
  };
}

export async function createNewOwnerSave(input: {
  name: string;
  rngSeed?: number;
}): Promise<CreateGameResult> {
  const saveId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  let state = createInitialGameState({
    saveId,
    rngSeed: input.rngSeed,
    nowIso,
  });

  const rng = createSeededRng(state.meta.rngState);
  const bootstrapped = bootstrapWorld(state, rng);
  state = {
    ...bootstrapped.state,
    meta: {
      ...bootstrapped.state.meta,
      rngState: rng.getState(),
      updatedAt: nowIso,
    },
  };

  const loaded = await createSaveGame({
    id: saveId,
    name: input.name.trim() || "New Franchise",
    state,
  });

  return {
    save: toSaveSummary(loaded),
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
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
  };
}

export async function listOwnerSaves(): Promise<SaveGameSummary[]> {
  return listSaveGames();
}

export async function advanceOwnerDay(
  saveId: string,
): Promise<AdvanceDayResult | null> {
  const loaded = await getSaveGame(saveId);
  if (!loaded) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const rng = createSeededRng(loaded.state.meta.rngState);
  const result = runWorldPipeline(loaded.state, rng, { type: "advanceDay" });

  const nextState = {
    ...result.state,
    meta: {
      ...result.state.meta,
      rngState: rng.getState(),
      updatedAt: nowIso,
    },
  };

  const saved = await updateSaveGameState({
    id: saveId,
    state: nextState,
  });

  return {
    save: toSaveSummary(saved),
    dashboard: toDashboardSnapshot(saved.state),
    events: result.events,
  };
}
