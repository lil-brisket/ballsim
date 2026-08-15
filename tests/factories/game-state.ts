import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  createInitialGameState,
  type CreateInitialGameStateInput,
} from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

export type CreateTestGameStateInput = Partial<CreateInitialGameStateInput> & {
  saveId?: string;
};

/**
 * Thin wrapper around createInitialGameState that always supplies
 * deterministic saveId, rngSeed, and nowIso unless overridden.
 * Defaults to CBL (12-team) settings for fast tests; pass settings for other shapes.
 */
export function createTestGameState(
  input: CreateTestGameStateInput = {},
): GameState {
  return createInitialGameState({
    saveId: input.saveId ?? "save_test",
    rngSeed: input.rngSeed ?? TEST_RNG_SEED,
    nowIso: input.nowIso ?? TEST_NOW_ISO,
    settings: input.settings ?? CBL_GAME_SETTINGS,
  });
}
