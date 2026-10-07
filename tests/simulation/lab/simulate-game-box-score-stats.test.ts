import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asSeasonId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { generateValidationRosters } from "@/simulation/validation";
import { simulateGame } from "@/systems/game-simulation";

const SEASON_ID = asSeasonId("season_box_score_stats");
const GAME_COUNT = 5000;
const FIELD_GOAL_PCT_MIN = 0.42;
const FIELD_GOAL_PCT_MAX = 0.48;
const THREE_POINT_PCT_MIN = 0.33;
const THREE_POINT_PCT_MAX = 0.38;
const TEST_TIMEOUT_MS = 1_200_000;

function scheduledGame(
  gameIndex: number,
  homeTeamId: TeamId,
  awayTeamId: TeamId,
) {
  return createGame({
    competitionType: "regular_season",
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
    id: asGameId(`box_score_stats_game_${gameIndex}`),
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

describe("simulateGame box-score stats", () => {
  it("keeps pooled FG% and 3P% in band and never ties across 5000 seeds", () => {
    let fieldGoalsMade = 0;
    let fieldGoalsAttempted = 0;
    let threePointersMade = 0;
    let threePointersAttempted = 0;

    for (let seed = 0; seed < GAME_COUNT; seed += 1) {
      const rng = createSeededRng(seed);
      const { homePlayers, awayPlayers } = generateValidationRosters(rng);
      const result = simulateGame(
        scheduledGame(seed, homePlayers[0]!.teamId!, awayPlayers[0]!.teamId!),
        { homePlayers, awayPlayers },
        rng,
      );

      expect(result.score.home).not.toBe(result.score.away);

      for (const team of [result.teamStats.home, result.teamStats.away]) {
        fieldGoalsMade += team.fieldGoalsMade;
        fieldGoalsAttempted += team.fieldGoalsAttempted;
        threePointersMade += team.threePointersMade;
        threePointersAttempted += team.threePointersAttempted;
      }
    }

    expect(fieldGoalsAttempted).toBeGreaterThan(0);
    expect(threePointersAttempted).toBeGreaterThan(0);

    const fieldGoalPct = fieldGoalsMade / fieldGoalsAttempted;
    const threePointPct = threePointersMade / threePointersAttempted;

    expect(fieldGoalPct).toBeGreaterThanOrEqual(FIELD_GOAL_PCT_MIN);
    expect(fieldGoalPct).toBeLessThanOrEqual(FIELD_GOAL_PCT_MAX);
    expect(threePointPct).toBeGreaterThanOrEqual(THREE_POINT_PCT_MIN);
    expect(threePointPct).toBeLessThanOrEqual(THREE_POINT_PCT_MAX);
  }, TEST_TIMEOUT_MS);
});
