import type { Game } from "@/domain/entities/game";
import type { PlayerId, SeasonId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/**
 * Centralized access to current-season games + archived games.
 * Archive wins on duplicate gameId. All profile selectors must use these helpers.
 */

function mergeGamesById(
  current: Record<string, Game>,
  archive: Record<string, Game>,
): Map<string, Game> {
  const byId = new Map<string, Game>();
  for (const game of Object.values(current)) {
    byId.set(game.id, game);
  }
  for (const game of Object.values(archive)) {
    byId.set(game.id, game);
  }
  return byId;
}

/** All games from competition.games, DL games, and business.gameArchive (archive wins on conflict). */
export function getAllAvailableGames(state: GameState): Game[] {
  const current = {
    ...state.competition.games,
    ...(state.competition.developmentLeague?.games ?? {}),
  };
  return [...mergeGamesById(current, state.business.gameArchive).values()];
}

/** Finalized games only (current + archived). */
export function getAllFinalGames(state: GameState): Game[] {
  return getAllAvailableGames(state).filter((game) => game.status === "final");
}

/** Games where the player has a playerStats row (any status). */
export function getPlayerGames(state: GameState, playerId: PlayerId): Game[] {
  return getAllAvailableGames(state).filter((game) =>
    game.playerStats.some((row) => row.playerId === playerId),
  );
}

/** Finalized games for a player in a specific season. */
export function getPlayerSeasonGames(
  state: GameState,
  playerId: PlayerId,
  seasonId: SeasonId,
): Game[] {
  return getPlayerGames(state, playerId).filter(
    (game) => game.seasonId === seasonId && game.status === "final",
  );
}

/** All games (current + archived) for a season, deduped by gameId. */
export function getGamesForSeason(
  state: GameState,
  seasonId: SeasonId,
): Game[] {
  return getAllAvailableGames(state).filter((game) => game.seasonId === seasonId);
}

/** Finalized games for a season. */
export function getFinalGamesForSeason(
  state: GameState,
  seasonId: SeasonId,
): Game[] {
  return getGamesForSeason(state, seasonId).filter(
    (game) => game.status === "final",
  );
}
