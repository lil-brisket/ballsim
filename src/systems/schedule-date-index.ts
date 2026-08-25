import type { Game } from "@/domain/entities/game";
import type { GameId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/**
 * Builds date → gameId[] index from schedule order.
 * Only includes games present in the games map.
 */
export function buildGameIdsByDate(
  games: Readonly<Record<string, Game>>,
  gameIds: readonly GameId[],
): Record<string, GameId[]> {
  const byDate: Record<string, GameId[]> = {};
  for (const gameId of gameIds) {
    const game = games[gameId];
    if (game == null) {
      continue;
    }
    const existing = byDate[game.date];
    if (existing == null) {
      byDate[game.date] = [gameId];
    } else {
      existing.push(gameId);
    }
  }
  return byDate;
}

/**
 * Returns scheduled game IDs for a date using the schedule index when present,
 * otherwise falls back to a full schedule scan.
 */
export function scheduledGameIdsForDate(
  state: GameState,
  date: string,
): readonly GameId[] {
  const indexed = state.competition.schedule.gameIdsByDate?.[date];
  if (indexed != null) {
    return indexed;
  }

  const fallback: GameId[] = [];
  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (game != null && game.date === date) {
      fallback.push(gameId);
    }
  }
  return fallback;
}
