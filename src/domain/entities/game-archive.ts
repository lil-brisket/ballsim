import type { Game } from "@/domain/entities/game";
import type { GameId } from "@/domain/ids";

/**
 * Authoritative store of completed games across seasons.
 * Keyed by gameId. Does not replace competition.games (current season).
 */
export type GameArchive = Record<string, Game>;

export function createEmptyGameArchive(): GameArchive {
  return {};
}

/**
 * Inserts a finalized game if not already present (idempotent).
 * Does not overwrite existing entries.
 */
export function archiveGameIfAbsent(
  archive: GameArchive,
  game: Game,
): GameArchive {
  if (archive[game.id] !== undefined) {
    return archive;
  }
  return {
    ...archive,
    [game.id]: game,
  };
}

export function getArchivedGame(
  archive: GameArchive,
  gameId: GameId,
): Game | undefined {
  return archive[gameId];
}
