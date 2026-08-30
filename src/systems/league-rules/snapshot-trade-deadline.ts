/**
 * Begin regular season helpers — snapshot trade deadline from schedule span.
 */
import type { GameState } from "@/state/game-state";
import { resolveHardLockTradeDeadlineDate } from "@/systems/league-rules/trade-rules";

export function snapshotTradeDeadline(state: GameState): GameState {
  if (state.competition.season.tradeDeadlineDate != null) {
    return state;
  }
  let earliest: string | null =
    state.competition.season.regularSeasonStartDate;
  let latest: string | null = null;
  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (!game) continue;
    if (earliest === null || game.date < earliest) earliest = game.date;
    if (latest === null || game.date > latest) latest = game.date;
  }
  const deadline = resolveHardLockTradeDeadlineDate(earliest, latest);
  if (deadline === null) {
    return state;
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        tradeDeadlineDate: deadline,
      },
    },
  };
}
