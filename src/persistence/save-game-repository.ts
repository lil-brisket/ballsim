import "server-only";

import type { GameState } from "@/state/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { prisma } from "@/persistence/prisma";
import { validateGameState } from "@/persistence/validate-game-state";
import type {
  LoadedSaveGame,
  SaveGameStore,
  SaveGameSummary,
} from "@/persistence/save-game-store";

/**
 * Serialize + validate a clone before write. Does not mutate input state.
 * Treats each save as a single database write (create or update).
 */
function prepareStateJson(state: GameState): string {
  const stateJson = serializeGameState(state);
  const clone: unknown = JSON.parse(stateJson);
  validateGameState(clone);
  return stateJson;
}

function toLoaded(row: {
  id: string;
  name: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
  stateJson: string;
}): LoadedSaveGame {
  return {
    id: row.id,
    name: row.name,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    state: deserializeGameState(row.stateJson),
  };
}

export function createPrismaSaveGameStore(): SaveGameStore {
  return {
    async list(): Promise<SaveGameSummary[]> {
      const rows = await prisma.saveGame.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          schemaVersion: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return rows;
    },

    async create(input: {
      id: string;
      name: string;
      state: GameState;
    }): Promise<LoadedSaveGame> {
      const stateJson = prepareStateJson(input.state);
      const row = await prisma.saveGame.create({
        data: {
          id: input.id,
          name: input.name,
          schemaVersion: GAME_STATE_SCHEMA_VERSION,
          stateJson,
        },
      });
      return toLoaded(row);
    },

    async load(id: string): Promise<LoadedSaveGame | null> {
      const row = await prisma.saveGame.findUnique({ where: { id } });
      if (!row) {
        return null;
      }
      return toLoaded(row);
    },

    async save(input: {
      id: string;
      state: GameState;
    }): Promise<LoadedSaveGame> {
      const stateJson = prepareStateJson(input.state);
      const row = await prisma.saveGame.update({
        where: { id: input.id },
        data: {
          schemaVersion: GAME_STATE_SCHEMA_VERSION,
          stateJson,
        },
      });
      return toLoaded(row);
    },
  };
}

/** Default production store instance. */
const defaultStore = createPrismaSaveGameStore();

/** Compatibility wrappers around PrismaSaveGameStore. */
export async function listSaveGames(): Promise<SaveGameSummary[]> {
  return defaultStore.list();
}

export async function createSaveGame(input: {
  id: string;
  name: string;
  state: GameState;
}): Promise<LoadedSaveGame> {
  return defaultStore.create(input);
}

export async function getSaveGame(id: string): Promise<LoadedSaveGame | null> {
  return defaultStore.load(id);
}

export async function updateSaveGameState(input: {
  id: string;
  state: GameState;
}): Promise<LoadedSaveGame> {
  return defaultStore.save(input);
}

export async function saveGame(input: {
  id: string;
  state: GameState;
}): Promise<LoadedSaveGame> {
  return defaultStore.save(input);
}

export async function loadGame(id: string): Promise<LoadedSaveGame | null> {
  return defaultStore.load(id);
}

export type { LoadedSaveGame, SaveGameSummary, SaveGameStore };
export { defaultStore as prismaSaveGameStore };
