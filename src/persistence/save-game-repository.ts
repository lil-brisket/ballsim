import "server-only";

import type { GameState } from "@/state/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { prisma } from "@/persistence/prisma";

export type SaveGameSummary = {
  id: string;
  name: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LoadedSaveGame = SaveGameSummary & {
  state: GameState;
};

export async function listSaveGames(): Promise<SaveGameSummary[]> {
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
}

export async function createSaveGame(input: {
  id: string;
  name: string;
  state: GameState;
}): Promise<LoadedSaveGame> {
  const schemaVersion = input.state.meta.schemaVersion;
  const stateJson = serializeGameState(input.state);

  const row = await prisma.saveGame.create({
    data: {
      id: input.id,
      name: input.name,
      schemaVersion,
      stateJson,
    },
  });

  return {
    id: row.id,
    name: row.name,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    state: deserializeGameState(row.stateJson),
  };
}

export async function getSaveGame(id: string): Promise<LoadedSaveGame | null> {
  const row = await prisma.saveGame.findUnique({ where: { id } });
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    state: deserializeGameState(row.stateJson),
  };
}

export async function updateSaveGameState(input: {
  id: string;
  state: GameState;
}): Promise<LoadedSaveGame> {
  const stateJson = serializeGameState(input.state);
  const row = await prisma.saveGame.update({
    where: { id: input.id },
    data: {
      schemaVersion: input.state.meta.schemaVersion,
      stateJson,
    },
  });

  return {
    id: row.id,
    name: row.name,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    state: deserializeGameState(row.stateJson),
  };
}
