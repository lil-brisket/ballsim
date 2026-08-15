import type { GameState } from "@/state/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import type {
  LoadedSaveGame,
  SaveGameStore,
  SaveGameSummary,
} from "@/persistence/save-game-store";

type MemorySaveRow = {
  id: string;
  name: string;
  schemaVersion: number;
  stateJson: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SeedPersistedBlobInput = {
  id: string;
  name: string;
  schemaVersion: number;
  stateJson: string;
};

/**
 * Memory adapter plus a test-only escape hatch for seeding raw persisted
 * blobs that the public create/save API correctly refuses (historical or
 * corrupt storage). Not part of SaveGameStore.
 */
export type MemorySaveGameStore = SaveGameStore & {
  seedPersistedBlob(input: SeedPersistedBlobInput): void;
};

/**
 * In-memory SaveGameStore for tests. Replaces the whole blob in one
 * assignment. Does not leak stateJson outside LoadedSaveGame.state.
 */
export function createMemorySaveGameStore(): MemorySaveGameStore {
  const rows = new Map<string, MemorySaveRow>();

  function prepareStateJson(state: GameState): string {
    const stateJson = serializeGameState(state);
    const clone: unknown = JSON.parse(stateJson);
    validateGameState(clone);
    return stateJson;
  }

  function toLoaded(row: MemorySaveRow): LoadedSaveGame {
    return {
      id: row.id,
      name: row.name,
      schemaVersion: row.schemaVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      state: deserializeGameState(row.stateJson),
    };
  }

  return {
    async list(): Promise<SaveGameSummary[]> {
      return [...rows.values()]
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map((row) => ({
          id: row.id,
          name: row.name,
          schemaVersion: row.schemaVersion,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }));
    },

    async create(input: {
      id: string;
      name: string;
      state: GameState;
    }): Promise<LoadedSaveGame> {
      if (rows.has(input.id)) {
        throw new Error(`SaveGame "${input.id}" already exists.`);
      }
      const stateJson = prepareStateJson(input.state);
      const now = new Date();
      const row: MemorySaveRow = {
        id: input.id,
        name: input.name,
        schemaVersion: GAME_STATE_SCHEMA_VERSION,
        stateJson,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(input.id, row);
      return toLoaded(row);
    },

    async load(id: string): Promise<LoadedSaveGame | null> {
      const row = rows.get(id);
      if (!row) {
        return null;
      }
      return toLoaded(row);
    },

    async save(input: {
      id: string;
      state: GameState;
    }): Promise<LoadedSaveGame> {
      const existing = rows.get(input.id);
      if (!existing) {
        throw new Error(`SaveGame "${input.id}" not found.`);
      }
      const stateJson = prepareStateJson(input.state);
      const row: MemorySaveRow = {
        ...existing,
        schemaVersion: GAME_STATE_SCHEMA_VERSION,
        stateJson,
        updatedAt: new Date(),
      };
      rows.set(input.id, row);
      return toLoaded(row);
    },

    /**
     * Test-only escape hatch: insert a raw persisted blob without running
     * serialize/validate. Lets tests represent historical schema versions
     * or corrupt storage that create/save correctly refuse.
     * Not exposed on SaveGameStore.
     */
    seedPersistedBlob(input: SeedPersistedBlobInput): void {
      if (rows.has(input.id)) {
        throw new Error(`SaveGame "${input.id}" already exists.`);
      }
      const now = new Date();
      rows.set(input.id, {
        id: input.id,
        name: input.name,
        schemaVersion: input.schemaVersion,
        stateJson: input.stateJson,
        createdAt: now,
        updatedAt: now,
      });
    },
  };
}
