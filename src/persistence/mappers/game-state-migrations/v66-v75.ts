import { DEFAULT_PARTICIPATION_STATE } from "@/domain/participation";
import type { GameState } from "@/state/game-state";

export type GameStateV66 = Omit<GameState, "meta" | "user" | "competition"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 66 };
  user: Omit<GameState["user"], "participation">;
  competition: Omit<GameState["competition"], "aiTradeSearch">;
};

export type GameStateV67 = Omit<GameState, "meta" | "competition"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 67 };
  competition: Omit<GameState["competition"], "aiTradeSearch">;
};

/**
 * Deterministic v66 → v67: add user.participation. Every pre-existing save is
 * single-player, so all owned teams stay with the one human owner.
 */
export function migrateV66ToV67(state: GameStateV66): GameStateV67 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 67,
    },
    user: {
      ...state.user,
      participation: { ...DEFAULT_PARTICIPATION_STATE },
    },
  };
}

/**
 * Deterministic v67 → v68: add competition.aiTradeSearch. Empty memory means
 * every CPU team runs its trade search on the next day, exactly as before.
 */
export function migrateV67ToV68(state: GameStateV67): GameState {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 68,
    },
    competition: {
      ...state.competition,
      aiTradeSearch: { byTeamId: {} },
    },
  };
}
