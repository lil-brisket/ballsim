import "server-only";

import { gunzipSync, gzipSync } from "node:zlib";

import type { PrismaClient } from "@/generated/prisma/client";
import type { GameState } from "@/state/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { projectSaveEntities } from "@/persistence/mappers/save-projection-mapper";
import { getPrisma } from "@/persistence/prisma";
import {
  mergeSaveHistory,
  splitColdHistory,
  type SaveHistory,
  type SaveHistoryChunk,
} from "@/persistence/save-history";
import { validateGameState } from "@/persistence/validate-game-state";
import { reconcileJerseyNumbers } from "@/systems/jersey-numbers";
import type {
  LoadedSaveGame,
  SaveGameStore,
  SaveGameSummary,
} from "@/persistence/save-game-store";
import { SaveVersionConflictError } from "@/persistence/save-version-conflict";

/**
 * Serialize + validate a clone before write. Does not mutate input state.
 * Treats each save as a single database write (create or update).
 */
function prepareStateJson(state: GameState): string {
  // Every join path (draft, trades, signings…) is covered here.
  const stateJson = serializeGameState(reconcileJerseyNumbers(state));
  const clone: unknown = JSON.parse(stateJson);
  validateGameState(clone);
  return stateJson;
}

/**
 * Saves are stored gzipped: the JSON compresses about tenfold, and the
 * fastest level costs ~35 ms for a 20 MB league. `stateJson` is left empty.
 */
function compressStateJson(stateJson: string): {
  stateJson: string;
  stateGzip: Uint8Array<ArrayBuffer>;
} {
  const gz = gzipSync(stateJson, { level: 1 });
  return { stateJson: "", stateGzip: new Uint8Array(gz) };
}

/** The stored snapshot: compressed when written by this version, else legacy JSON. */
function storedStateJson(row: {
  stateJson: string;
  stateGzip: Uint8Array | null;
}): string {
  return row.stateGzip !== null
    ? gunzipSync(row.stateGzip).toString("utf8")
    : row.stateJson;
}

function toLoaded(
  row: {
    id: string;
    name: string;
    schemaVersion: number;
    createdAt: Date;
    updatedAt: Date;
    ownerUserId: string | null;
  },
  stateJson: string,
): LoadedSaveGame {
  return {
    id: row.id,
    name: row.name,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ownerUserId: row.ownerUserId,
    state: deserializeGameState(stateJson),
  };
}

const SAVE_METADATA = {
  id: true,
  name: true,
  schemaVersion: true,
  createdAt: true,
  updatedAt: true,
  ownerUserId: true,
} as const;

type ProjectionClient = Pick<PrismaClient, "saveTeam" | "savePlayer">;

type HistoryClient = Pick<PrismaClient, "saveHistoryChunk">;

/**
 * Stores the history chunks this save does not have yet. Chunks are
 * immutable (a finished season does not change), so existing ones are
 * never rewritten.
 */
async function writeNewHistoryChunks(
  db: HistoryClient,
  saveGameId: string,
  chunks: readonly SaveHistoryChunk[],
): Promise<void> {
  if (chunks.length === 0) return;
  const existing = await db.saveHistoryChunk.findMany({
    where: { saveGameId, chunkId: { in: chunks.map((c) => c.chunkId) } },
    select: { chunkId: true },
  });
  const stored = new Set(existing.map((row) => row.chunkId));
  const fresh = chunks.filter((chunk) => !stored.has(chunk.chunkId));
  if (fresh.length === 0) return;
  await db.saveHistoryChunk.createMany({
    data: fresh.map((chunk) => ({
      saveGameId,
      chunkId: chunk.chunkId,
      payloadGzip: new Uint8Array(
        gzipSync(JSON.stringify(chunk.history), { level: 1 }),
      ),
    })),
  });
}

/**
 * Replace query projections for a save. Call inside the same transaction as
 * the stateJson write so blob and tables cannot diverge on commit.
 */
export async function replaceSaveProjections(
  db: ProjectionClient,
  saveGameId: string,
  state: GameState,
): Promise<void> {
  const { teams, players } = projectSaveEntities(state);
  await db.saveTeam.deleteMany({ where: { saveGameId } });
  await db.savePlayer.deleteMany({ where: { saveGameId } });
  if (teams.length > 0) {
    await db.saveTeam.createMany({
      data: teams.map((team) => ({ saveGameId, ...team })),
    });
  }
  if (players.length > 0) {
    await db.savePlayer.createMany({
      data: players.map((player) => ({ saveGameId, ...player })),
    });
  }
}

async function backfillProjectionsIfMissing(
  db: PrismaClient,
  saveGameId: string,
  state: GameState,
): Promise<void> {
  const projected = projectSaveEntities(state);
  if (projected.teams.length === 0 && projected.players.length === 0) {
    return;
  }
  const [teamCount, playerCount] = await Promise.all([
    db.saveTeam.count({ where: { saveGameId } }),
    db.savePlayer.count({ where: { saveGameId } }),
  ]);
  const needsTeams = teamCount === 0 && projected.teams.length > 0;
  const needsPlayers = playerCount === 0 && projected.players.length > 0;
  if (!needsTeams && !needsPlayers) {
    return;
  }
  await db.$transaction(async (tx) => {
    await replaceSaveProjections(tx, saveGameId, state);
  });
}

/**
 * Production SaveGameStore. `stateJson` is the authoritative GameState snapshot.
 * SaveTeam / SavePlayer rows are listing projections written in the same
 * transaction as the blob.
 */
export function createPrismaSaveGameStore(
  client?: PrismaClient,
): SaveGameStore {
  const db = (): PrismaClient => client ?? getPrisma();

  return {
    async list(): Promise<SaveGameSummary[]> {
      const rows = await db().saveGame.findMany({
        orderBy: { updatedAt: "desc" },
        select: SAVE_METADATA,
      });
      return rows;
    },

    async create(input: {
      id: string;
      name: string;
      state: GameState;
      ownerUserId?: string | null;
    }): Promise<LoadedSaveGame> {
      const { hot, chunks } = splitColdHistory(input.state);
      const stateJson = prepareStateJson(hot);
      const row = await db().$transaction(async (tx) => {
        const created = await tx.saveGame.create({
          data: {
            id: input.id,
            name: input.name,
            ownerUserId: input.ownerUserId ?? null,
            schemaVersion: GAME_STATE_SCHEMA_VERSION,
            ...compressStateJson(stateJson),
          },
          select: SAVE_METADATA,
        });
        await writeNewHistoryChunks(tx, created.id, chunks);
        await replaceSaveProjections(tx, created.id, input.state);
        return created;
      });
      return toLoaded(row, stateJson);
    },

    async load(id: string): Promise<LoadedSaveGame | null> {
      const row = await db().saveGame.findUnique({ where: { id } });
      if (!row) {
        return null;
      }
      const loaded = toLoaded(row, storedStateJson(row));
      await backfillProjectionsIfMissing(db(), id, loaded.state);
      return loaded;
    },

    async loadHistory(id: string): Promise<SaveHistory> {
      const rows = await db().saveHistoryChunk.findMany({
        where: { saveGameId: id },
        orderBy: { chunkId: "asc" },
        select: { payloadGzip: true },
      });
      return mergeSaveHistory(
        rows.map(
          (row) =>
            JSON.parse(
              gunzipSync(row.payloadGzip).toString("utf8"),
            ) as SaveHistory,
        ),
      );
    },

    async save(input: {
      id: string;
      state: GameState;
      ifUpdatedAt?: Date;
    }): Promise<LoadedSaveGame> {
      const { hot, chunks } = splitColdHistory(input.state);
      const stateJson = prepareStateJson(hot);
      const row = await db().$transaction(async (tx) => {
        if (input.ifUpdatedAt != null) {
          const result = await tx.saveGame.updateMany({
            where: { id: input.id, updatedAt: input.ifUpdatedAt },
            data: {
              schemaVersion: GAME_STATE_SCHEMA_VERSION,
              ...compressStateJson(stateJson),
            },
          });
          if (result.count === 0) {
            throw new SaveVersionConflictError(input.id);
          }
        } else {
          await tx.saveGame.update({
            where: { id: input.id },
            data: {
              schemaVersion: GAME_STATE_SCHEMA_VERSION,
              ...compressStateJson(stateJson),
            },
          });
        }
        await writeNewHistoryChunks(tx, input.id, chunks);
        await replaceSaveProjections(tx, input.id, input.state);
        // Metadata only: the state just written is already in memory, and
        // reading the whole snapshot back costs as much as writing it.
        const updated = await tx.saveGame.findUnique({
          where: { id: input.id },
          select: SAVE_METADATA,
        });
        if (!updated) {
          throw new SaveVersionConflictError(input.id);
        }
        return updated;
      });
      return toLoaded(row, stateJson);
    },

    async delete(id: string): Promise<boolean> {
      const result = await db().$transaction(async (tx) => {
        await tx.saveTeam.deleteMany({ where: { saveGameId: id } });
        await tx.savePlayer.deleteMany({ where: { saveGameId: id } });
        await tx.saveHistoryChunk.deleteMany({ where: { saveGameId: id } });
        return tx.saveGame.deleteMany({ where: { id } });
      });
      return result.count > 0;
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

export async function deleteSaveGame(id: string): Promise<boolean> {
  return defaultStore.delete(id);
}

export type { LoadedSaveGame, SaveGameSummary, SaveGameStore };
export { defaultStore as prismaSaveGameStore };
