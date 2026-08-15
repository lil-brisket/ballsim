import "server-only";

import { createSeededRng } from "@/domain/rng";
import type { DomainEvent } from "@/domain/events";
import { createInitialGameState } from "@/state/create-initial-state";
import { toDashboardSnapshot } from "@/state/selectors";
import type { DashboardSnapshot } from "@/state/selectors";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import type { AdvanceSimulationResult } from "@/systems/simulation/types";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import type {
  LoadedSaveGame,
  SaveGameStore,
  SaveGameSummary,
} from "@/persistence/save-game-store";

export type CreateGameResult = {
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
};

export type AdvanceDayResult = CreateGameResult & {
  events: DomainEvent[];
  simulation: Omit<AdvanceSimulationResult, "state" | "events">;
};

function toSaveSummary(loaded: LoadedSaveGame): SaveGameSummary {
  return {
    id: loaded.id,
    name: loaded.name,
    schemaVersion: loaded.schemaVersion,
    createdAt: loaded.createdAt,
    updatedAt: loaded.updatedAt,
  };
}

function getStore(store?: SaveGameStore): SaveGameStore {
  return store ?? prismaSaveGameStore;
}

export async function createNewOwnerSave(
  input: {
    name: string;
    rngSeed?: number;
  },
  store?: SaveGameStore,
): Promise<CreateGameResult> {
  const saveStore = getStore(store);
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

  const loaded = await saveStore.create({
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
  store?: SaveGameStore,
): Promise<CreateGameResult | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
  };
}

export async function listOwnerSaves(
  store?: SaveGameStore,
): Promise<SaveGameSummary[]> {
  return getStore(store).list();
}

/**
 * Persist GameState without running simulation. Does not mutate input state.
 */
export async function saveOwnerGame(
  saveId: string,
  state: GameState,
  store?: SaveGameStore,
): Promise<CreateGameResult> {
  const saved = await getStore(store).save({ id: saveId, state });
  return {
    save: toSaveSummary(saved),
    dashboard: toDashboardSnapshot(saved.state),
  };
}

export async function advanceOwnerDay(
  saveId: string,
  store?: SaveGameStore,
): Promise<AdvanceDayResult | null> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const rng = createSeededRng(loaded.state.meta.rngState);
  const result = advanceSimulation(loaded.state, rng, { days: 1 });

  const nextState = {
    ...result.state,
    meta: {
      ...result.state.meta,
      rngState: rng.getState(),
      updatedAt: nowIso,
    },
  };

  const saved = await saveStore.save({
    id: saveId,
    state: nextState,
  });

  const {
    state: _state,
    events,
    ...simulation
  } = result;

  return {
    save: toSaveSummary(saved),
    dashboard: toDashboardSnapshot(saved.state),
    events,
    simulation,
  };
}
