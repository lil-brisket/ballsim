import { createGame, type Game, type GameInput } from "@/domain/entities/game";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";

const DEFAULT_HOME = asTeamId("team_validation_home");
const DEFAULT_AWAY = asTeamId("team_validation_away");
const DEFAULT_SEASON = asSeasonId("season_validation");

export function createLabScheduledGame(
  overrides: Partial<GameInput> = {},
): Game {
  return createGame({
    competitionType: "regular_season",
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
    id: asGameId("val_game_0"),
    seasonId: DEFAULT_SEASON,
    homeTeamId: DEFAULT_HOME,
    awayTeamId: DEFAULT_AWAY,
    date: "2026-10-15",
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
    ...overrides,
  });
}
