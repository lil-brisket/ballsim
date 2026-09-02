/**
 * Schedule-authoritative team game lookups for the calendar.
 * The calendar never invents games — it only projects existing Game objects.
 */

import type { Game } from "@/domain/entities/game";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/**
 * All games involving `teamId` on `date` (supports doubleheaders).
 */
export function getTeamGamesForDate(
  state: GameState,
  teamId: TeamId,
  date: string,
): Game[] {
  const byDate = state.competition.schedule.gameIdsByDate?.[date];
  const candidateIds =
    byDate ??
    state.competition.schedule.gameIds.filter((gameId) => {
      const game = state.competition.games[gameId];
      return game?.date === date;
    });

  const games: Game[] = [];
  for (const gameId of candidateIds) {
    const game = state.competition.games[gameId];
    if (!game) continue;
    if (game.homeTeamId === teamId || game.awayTeamId === teamId) {
      games.push(game);
    }
  }
  return games;
}

/**
 * Primary team game for a date, or null when the team is idle.
 */
export function getTeamGameForDate(
  state: GameState,
  teamId: TeamId,
  date: string,
): Game | null {
  return getTeamGamesForDate(state, teamId, date)[0] ?? null;
}
