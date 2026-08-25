import { describe, expect, it } from "vitest";
import {
  checkPlayerPointsEqualScore,
  checkShootingStatInvariants,
} from "@/domain/entities/game-stat-invariants";
import {
  assertCompletedGameBoxScore,
  validateCompletedGameBoxScore,
} from "@/domain/entities/game-box-score";
import {
  createGame,
  type GameInput,
  type GamePlayerStats,
} from "@/domain/entities/game";
import {
  asGameId,
  asPlayerId,
  asSeasonId,
  asTeamId,
} from "@/domain/ids";

const HOME = asTeamId("team_home");
const AWAY = asTeamId("team_away");

function playerRow(
  overrides: Partial<GamePlayerStats> & { playerId: ReturnType<typeof asPlayerId> },
): GamePlayerStats {
  return {
    teamId: HOME,
    firstName: "Test",
    lastName: "Player",
    minutes: 30,
    points: 0,
    rebounds: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    touches: 0,
    ...overrides,
  };
}

function finalGameInput(
  overrides: Partial<GameInput> = {},
): GameInput {
  const homePlayer = playerRow({
    playerId: asPlayerId("p_home"),
    teamId: HOME,
    points: 20,
    fieldGoalsMade: 8,
    fieldGoalsAttempted: 15,
    threePointersMade: 2,
    threePointersAttempted: 5,
    freeThrowsMade: 2,
    freeThrowsAttempted: 2,
    rebounds: 5,
    offensiveRebounds: 2,
    defensiveRebounds: 3,
  });
  const awayPlayer = playerRow({
    playerId: asPlayerId("p_away"),
    teamId: AWAY,
    firstName: "Away",
    lastName: "Star",
    points: 18,
    fieldGoalsMade: 7,
    fieldGoalsAttempted: 14,
    threePointersMade: 2,
    threePointersAttempted: 4,
    freeThrowsMade: 2,
    freeThrowsAttempted: 2,
    rebounds: 4,
    offensiveRebounds: 1,
    defensiveRebounds: 3,
  });
  return {
    id: asGameId("game_box_1"),
    seasonId: asSeasonId("season_1"),
    homeTeamId: HOME,
    awayTeamId: AWAY,
    date: "2032-03-14",
    competitionType: "regular_season",
    status: "final",
    score: { home: 20, away: 18 },
    periodScores: [
      { home: 5, away: 4 },
      { home: 5, away: 5 },
      { home: 5, away: 4 },
      { home: 5, away: 5 },
    ],
    events: [],
    playerStats: [homePlayer, awayPlayer],
    homeTeamSnapshot: {
      teamId: HOME,
      city: "Boston",
      name: "Celtics",
      abbreviation: "BOS",
    },
    awayTeamSnapshot: {
      teamId: AWAY,
      city: "New York",
      name: "Knicks",
      abbreviation: "NYK",
    },
    ...overrides,
  };
}

describe("game-stat-invariants", () => {
  it("rejects FGM greater than FGA", () => {
    const failures = checkShootingStatInvariants("home", {
      points: 6,
      fieldGoalsMade: 4,
      fieldGoalsAttempted: 3,
      threePointersMade: 0,
      threePointersAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      rebounds: 0,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
    });
    expect(failures.some((f) => f.rule === "FGM_LE_FGA")).toBe(true);
  });

  it("rejects player points that do not match score", () => {
    const failures = checkPlayerPointsEqualScore(
      "home",
      [playerRow({ playerId: asPlayerId("p1"), points: 10 })],
      12,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]!.rule).toBe("POINTS_EQ_SCORE");
  });
});

describe("validateCompletedGameBoxScore", () => {
  it("passes a reconcilable finalized game", () => {
    const game = createGame(finalGameInput());
    expect(validateCompletedGameBoxScore(game)).toEqual([]);
    expect(() => assertCompletedGameBoxScore(game)).not.toThrow();
  });

  it("rejects ties", () => {
    const game = createGame(
      finalGameInput({
        score: { home: 18, away: 18 },
        playerStats: [
          playerRow({
            playerId: asPlayerId("p_home"),
            teamId: HOME,
            points: 18,
            fieldGoalsMade: 7,
            fieldGoalsAttempted: 14,
            threePointersMade: 2,
            threePointersAttempted: 4,
            freeThrowsMade: 2,
            freeThrowsAttempted: 2,
            rebounds: 4,
            offensiveRebounds: 1,
            defensiveRebounds: 3,
          }),
          playerRow({
            playerId: asPlayerId("p_away"),
            teamId: AWAY,
            points: 18,
            fieldGoalsMade: 7,
            fieldGoalsAttempted: 14,
            threePointersMade: 2,
            threePointersAttempted: 4,
            freeThrowsMade: 2,
            freeThrowsAttempted: 2,
            rebounds: 4,
            offensiveRebounds: 1,
            defensiveRebounds: 3,
          }),
        ],
      }),
    );
    const failures = validateCompletedGameBoxScore(game);
    expect(failures.some((f) => f.rule === "NO_TIE")).toBe(true);
  });

  it("rejects duplicate players", () => {
    const row = playerRow({
      playerId: asPlayerId("dup"),
      teamId: HOME,
      points: 20,
      fieldGoalsMade: 8,
      fieldGoalsAttempted: 15,
      threePointersMade: 2,
      threePointersAttempted: 5,
      freeThrowsMade: 2,
      freeThrowsAttempted: 2,
      rebounds: 5,
      offensiveRebounds: 2,
      defensiveRebounds: 3,
    });
    const game = createGame(
      finalGameInput({
        playerStats: [row, { ...row }],
        score: { home: 40, away: 18 },
      }),
    );
    expect(
      validateCompletedGameBoxScore(game).some(
        (f) => f.rule === "DUPLICATE_PLAYER",
      ),
    ).toBe(true);
  });
});
