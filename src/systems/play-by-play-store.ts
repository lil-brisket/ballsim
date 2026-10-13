import type { PlayByPlayLog } from "@/domain/entities/play-by-play";
import type { GameState } from "@/state/game-state";

/**
 * Writes play-by-play logs into competition.playByPlay (owner games of the
 * current season). Retention is the season itself: the map is cleared at
 * season rollover, so no per-insert pruning is needed. Returns the same state
 * when there is nothing to store.
 */
export function storePlayByPlayLogs(
  state: GameState,
  logs: Readonly<Record<string, PlayByPlayLog>>,
): GameState {
  const gameIds = Object.keys(logs);
  if (gameIds.length === 0) {
    return state;
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      playByPlay: { ...state.competition.playByPlay, ...logs },
    },
  };
}
