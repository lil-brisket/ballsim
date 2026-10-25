import { reconcileJerseyNumbers } from "@/systems/jersey-numbers";
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
import { SaveVersionConflictError } from "@/persistence/save-version-conflict";
import {
  mergeSaveHistory,
  splitColdHistory,
  type SaveHistory,
} from "@/persistence/save-history";

type MemorySaveRow = {
  id: string;
  name: string;
  schemaVersion: number;
  stateJson: string;
  createdAt: Date;
  updatedAt: Date;
  ownerUserId: string | null;
};

export type SeedPersistedBlobInput = {
  id: string;
  name: string;
  schemaVersion: number;
  stateJson: string;
  ownerUserId?: string | null;
};

/**
 * Memory adapter plus a test-only escape hatch for seeding raw persisted
 * blobs that the public create/save API correctly refuses (historical or
 * corrupt storage). Not part of SaveGameStore.
 */
export type MemorySaveGameStore = SaveGameStore & {
  seedPersistedBlob(input: SeedPersistedBlobInput): void;
};

function sameUpdatedAt(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/**
 * In-memory SaveGameStore for tests. Replaces the whole blob in one
 * assignment. Does not leak stateJson outside LoadedSaveGame.state.
 */
export function createMemorySaveGameStore(): MemorySaveGameStore {
  const rows = new Map<string, MemorySaveRow>();
  /** Finished-season history by save, as JSON per chunk (immutable). */
  const historyBySave = new Map<string, Map<string, string>>();

  /** Splits off finished-season history, keeps new chunks, returns the rest. */
  function storeHistory(saveId: string, state: GameState): GameState {
    const { hot, chunks } = splitColdHistory(state);
    let stored = historyBySave.get(saveId);
    if (stored === undefined) {
      stored = new Map();
      historyBySave.set(saveId, stored);
    }
    for (const chunk of chunks) {
      if (!stored.has(chunk.chunkId)) {
        stored.set(chunk.chunkId, JSON.stringify(chunk.history));
      }
    }
    return hot;
  }

  function prepareStateJson(state: GameState): string {
    // Every join path (draft, trades, signings…) is covered here.
    const stateJson = serializeGameState(reconcileJerseyNumbers(state));
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
      ownerUserId: row.ownerUserId,
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
          ownerUserId: row.ownerUserId,
        }));
    },

    async create(input: {
      id: string;
      name: string;
      state: GameState;
      ownerUserId?: string | null;
    }): Promise<LoadedSaveGame> {
      if (rows.has(input.id)) {
        throw new Error(`SaveGame "${input.id}" already exists.`);
      }
      const stateJson = prepareStateJson(storeHistory(input.id, input.state));
      const now = new Date();
      const row: MemorySaveRow = {
        id: input.id,
        name: input.name,
        schemaVersion: GAME_STATE_SCHEMA_VERSION,
        stateJson,
        createdAt: now,
        updatedAt: now,
        ownerUserId: input.ownerUserId ?? null,
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

    async loadHistory(id: string): Promise<SaveHistory> {
      const stored = historyBySave.get(id);
      if (stored === undefined) {
        return mergeSaveHistory([]);
      }
      return mergeSaveHistory(
        [...stored.keys()]
          .sort()
          .map((chunkId) => JSON.parse(stored.get(chunkId)!) as SaveHistory),
      );
    },

    async save(input: {
      id: string;
      state: GameState;
      ifUpdatedAt?: Date;
    }): Promise<LoadedSaveGame> {
      const existing = rows.get(input.id);
      if (!existing) {
        throw new Error(`SaveGame "${input.id}" not found.`);
      }
      if (
        input.ifUpdatedAt != null &&
        !sameUpdatedAt(existing.updatedAt, input.ifUpdatedAt)
      ) {
        throw new SaveVersionConflictError(input.id);
      }
      const stateJson = prepareStateJson(storeHistory(input.id, input.state));
      const row: MemorySaveRow = {
        ...existing,
        schemaVersion: GAME_STATE_SCHEMA_VERSION,
        stateJson,
        updatedAt: new Date(),
      };
      rows.set(input.id, row);
      return toLoaded(row);
    },

    async delete(id: string): Promise<boolean> {
      historyBySave.delete(id);
      return rows.delete(id);
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
        ownerUserId: input.ownerUserId ?? null,
      });
    },
  };
}
