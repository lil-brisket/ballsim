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
 *
 * Note: createInitialGameState still uses crypto.randomUUID for league/team
 * IDs (production bootstrap). Prefer createPlayer / createTeam for stable
 * entity fixtures in unit tests.
 */
export function createTestGameState(
  input: CreateTestGameStateInput = {},
): GameState {
  return createInitialGameState({
    saveId: input.saveId ?? "save_test",
    rngSeed: input.rngSeed ?? TEST_RNG_SEED,
    nowIso: input.nowIso ?? TEST_NOW_ISO,
  });
}
