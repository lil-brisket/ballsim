import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { GameState } from "@/state/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { projectSaveEntities } from "@/persistence/mappers/save-projection-mapper";
import { getPrisma } from "@/persistence/prisma";
import { validateGameState } from "@/persistence/validate-game-state";
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

type ProjectionClient = Pick<PrismaClient, "saveTeam" | "savePlayer">;

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
      const row = await db().$transaction(async (tx) => {
        const created = await tx.saveGame.create({
          data: {
            id: input.id,
            name: input.name,
            schemaVersion: GAME_STATE_SCHEMA_VERSION,
            stateJson,
          },
        });
        await replaceSaveProjections(tx, created.id, input.state);
        return created;
      });
      return toLoaded(row);
    },

    async load(id: string): Promise<LoadedSaveGame | null> {
      const row = await db().saveGame.findUnique({ where: { id } });
      if (!row) {
        return null;
      }
      const loaded = toLoaded(row);
      await backfillProjectionsIfMissing(db(), id, loaded.state);
      return loaded;
    },

    async save(input: {
      id: string;
      state: GameState;
      ifUpdatedAt?: Date;
    }): Promise<LoadedSaveGame> {
      const stateJson = prepareStateJson(input.state);
      const row = await db().$transaction(async (tx) => {
        if (input.ifUpdatedAt != null) {
          const result = await tx.saveGame.updateMany({
            where: { id: input.id, updatedAt: input.ifUpdatedAt },
            data: {
              schemaVersion: GAME_STATE_SCHEMA_VERSION,
              stateJson,
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
              stateJson,
            },
          });
        }
        await replaceSaveProjections(tx, input.id, input.state);
        const updated = await tx.saveGame.findUnique({
          where: { id: input.id },
        });
        if (!updated) {
          throw new SaveVersionConflictError(input.id);
        }
        return updated;
      });
      return toLoaded(row);
    },

    async delete(id: string): Promise<boolean> {
      const result = await db().$transaction(async (tx) => {
        await tx.saveTeam.deleteMany({ where: { saveGameId: id } });
        await tx.savePlayer.deleteMany({ where: { saveGameId: id } });
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
