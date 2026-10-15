import { DEFAULT_PARTICIPATION_STATE } from "@/domain/participation";
import type { GameState } from "@/state/game-state";

export type GameStateV66 = Omit<GameState, "meta" | "user"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 66 };
  user: Omit<GameState["user"], "participation">;
};

/**
 * Deterministic v66 → v67: add user.participation. Every pre-existing save is
 * single-player, so all owned teams stay with the one human owner.
 */
export function migrateV66ToV67(state: GameStateV66): GameState {
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
