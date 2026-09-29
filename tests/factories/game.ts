import { createLabScheduledGame } from "@/simulation/lab/create-lab-game";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";
import type { Game, GameInput } from "@/domain/entities/game";

/**
 * Deterministic scheduled Game for tests. Defaults match Lab scheduled games.
 */
export function createTestGame(overrides: Partial<GameInput> = {}): Game {
  return createLabScheduledGame({
    id: asGameId("game_test_1"),
    seasonId: asSeasonId("season_test"),
    homeTeamId: asTeamId("team_home"),
    awayTeamId: asTeamId("team_away"),
    ...overrides,
  });
}
