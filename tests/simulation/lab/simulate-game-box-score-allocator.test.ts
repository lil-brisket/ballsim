import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asSeasonId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { generateValidationRosters } from "@/simulation/validation";
import { simulateGameBoxScore } from "@/systems/game-simulation-box-score";

const SEASON_ID = asSeasonId("season_box_score_allocator");
const GAME_COUNT = 800;
const FIELD_GOAL_PCT_MIN = 0.42;
const FIELD_GOAL_PCT_MAX = 0.48;
const THREE_POINT_PCT_MIN = 0.33;
const THREE_POINT_PCT_MAX = 0.38;
const FREE_THROW_PCT_MIN = 0.72;
const FREE_THROW_PCT_MAX = 0.8;
const TEAM_AST_MIN = 18;
const TEAM_AST_MAX = 32;
const TEAM_REB_MIN = 36;
const TEAM_REB_MAX = 56;
const TEAM_TO_MIN = 10;
const TEAM_TO_MAX = 20;
const TEST_TIMEOUT_MS = 120_000;

function scheduledGame(
  gameIndex: number,
  homeTeamId: TeamId,
  awayTeamId: TeamId,
) {
  return createGame({
    competitionType: "regular_season",
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
    id: asGameId(`box_score_allocator_game_${gameIndex}`),
    seasonId: SEASON_ID,
    homeTeamId,
    awayTeamId,
    date: "2026-10-15",
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
  });
}

describe("simulateGameBoxScore calibration", () => {
  it("keeps pooled FG/3P/FT and team AST/REB/TO in band without ties", () => {
    let fieldGoalsMade = 0;
    let fieldGoalsAttempted = 0;
    let threePointersMade = 0;
    let threePointersAttempted = 0;
    let freeThrowsMade = 0;
    let freeThrowsAttempted = 0;
    let assists = 0;
    let rebounds = 0;
    let turnovers = 0;
    let teamGames = 0;

    for (let seed = 0; seed < GAME_COUNT; seed += 1) {
      const rng = createSeededRng(seed);
      const { homePlayers, awayPlayers } = generateValidationRosters(rng);
      const result = simulateGameBoxScore(
        scheduledGame(seed, homePlayers[0]!.teamId!, awayPlayers[0]!.teamId!),
        { homePlayers, awayPlayers },
        rng,
      );

      expect(result.score.home).not.toBe(result.score.away);
      expect(result.events).toEqual([]);

      for (const team of [result.teamStats.home, result.teamStats.away]) {
        fieldGoalsMade += team.fieldGoalsMade;
        fieldGoalsAttempted += team.fieldGoalsAttempted;
        threePointersMade += team.threePointersMade;
        threePointersAttempted += team.threePointersAttempted;
        freeThrowsMade += team.freeThrowsMade;
        freeThrowsAttempted += team.freeThrowsAttempted;
        assists += team.assists;
        rebounds += team.rebounds;
        turnovers += team.turnovers;
        teamGames += 1;
      }
    }

    expect(fieldGoalsAttempted).toBeGreaterThan(0);
    expect(threePointersAttempted).toBeGreaterThan(0);
    expect(freeThrowsAttempted).toBeGreaterThan(0);

    const fieldGoalPct = fieldGoalsMade / fieldGoalsAttempted;
    const threePointPct = threePointersMade / threePointersAttempted;
    const freeThrowPct = freeThrowsMade / freeThrowsAttempted;
    const astPerTeam = assists / teamGames;
    const rebPerTeam = rebounds / teamGames;
    const toPerTeam = turnovers / teamGames;

    expect(fieldGoalPct).toBeGreaterThanOrEqual(FIELD_GOAL_PCT_MIN);
    expect(fieldGoalPct).toBeLessThanOrEqual(FIELD_GOAL_PCT_MAX);
    expect(threePointPct).toBeGreaterThanOrEqual(THREE_POINT_PCT_MIN);
    expect(threePointPct).toBeLessThanOrEqual(THREE_POINT_PCT_MAX);
    expect(freeThrowPct).toBeGreaterThanOrEqual(FREE_THROW_PCT_MIN);
    expect(freeThrowPct).toBeLessThanOrEqual(FREE_THROW_PCT_MAX);
    expect(astPerTeam).toBeGreaterThanOrEqual(TEAM_AST_MIN);
    expect(astPerTeam).toBeLessThanOrEqual(TEAM_AST_MAX);
    expect(rebPerTeam).toBeGreaterThanOrEqual(TEAM_REB_MIN);
    expect(rebPerTeam).toBeLessThanOrEqual(TEAM_REB_MAX);
    expect(toPerTeam).toBeGreaterThanOrEqual(TEAM_TO_MIN);
    expect(toPerTeam).toBeLessThanOrEqual(TEAM_TO_MAX);
  }, TEST_TIMEOUT_MS);
});
