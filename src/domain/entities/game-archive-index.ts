import type { Game } from "@/domain/entities/game";
import type { GameArchive } from "@/domain/entities/game-archive";

/**
 * Secondary indexes so player/season game lookups do not scan the world archive.
 * Values are gameId arrays, sorted for determinism.
 */
export type GameArchiveIndex = {
  byPlayerId: Record<string, string[]>;
  bySeasonId: Record<string, string[]>;
};

export function createEmptyGameArchiveIndex(): GameArchiveIndex {
  return { byPlayerId: {}, bySeasonId: {} };
}

function pushSorted(
  map: Record<string, string[]>,
  key: string,
  gameId: string,
): void {
  const existing = map[key];
  if (!existing) {
    map[key] = [gameId];
    return;
  }
  if (existing.includes(gameId)) {
    return;
  }
  existing.push(gameId);
  existing.sort();
}

export function buildGameArchiveIndex(archive: GameArchive): GameArchiveIndex {
  const byPlayerId: Record<string, string[]> = {};
  const bySeasonId: Record<string, string[]> = {};
  const gameIds = Object.keys(archive).sort();
  for (const gameId of gameIds) {
    const game = archive[gameId];
    if (!game) continue;
    pushSorted(bySeasonId, game.seasonId, game.id);
    const seenPlayers = new Set<string>();
    for (const row of game.playerStats) {
      if (seenPlayers.has(row.playerId)) continue;
      seenPlayers.add(row.playerId);
      pushSorted(byPlayerId, row.playerId, game.id);
    }
  }
  return { byPlayerId, bySeasonId };
}

export function indexArchivedGame(
  index: GameArchiveIndex,
  game: Game,
): GameArchiveIndex {
  const byPlayerId = { ...index.byPlayerId };
  const bySeasonId = { ...index.bySeasonId };
  pushSorted(bySeasonId, game.seasonId, game.id);
  const seenPlayers = new Set<string>();
  for (const row of game.playerStats) {
    if (seenPlayers.has(row.playerId)) continue;
    seenPlayers.add(row.playerId);
    const next = [...(byPlayerId[row.playerId] ?? [])];
    byPlayerId[row.playerId] = next;
    pushSorted(byPlayerId, row.playerId, game.id);
  }
  return { byPlayerId, bySeasonId };
}
