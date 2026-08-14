import { describe, expect, it } from "vitest";
import {
  createGame,
  type GameEvent,
  type GameInput,
  type GamePlayerStats,
} from "@/domain/entities/game";
import {
  asGameId,
  asPlayerId,
  asSeasonId,
  asTeamId,
} from "@/domain/ids";

function validInput(overrides: Partial<GameInput> = {}): GameInput {
  return {
    id: asGameId("game_1"),
    seasonId: asSeasonId("season_1"),
    homeTeamId: asTeamId("team_home"),
    awayTeamId: asTeamId("team_away"),
    date: "2026-10-15",
    score: { home: 0, away: 0 },
    status: "scheduled",
    periodScores: [],
    events: [],
    playerStats: [],
    ...overrides,
  };
}

function sampleEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    sequence: 0,
    type: "shot_made",
    playerId: asPlayerId("player_1"),
    teamId: asTeamId("team_home"),
    ...overrides,
  };
}

function sampleStats(overrides: Partial<GamePlayerStats> = {}): GamePlayerStats {
  return {
    playerId: asPlayerId("player_1"),
    minutes: 32,
    points: 18,
    rebounds: 5,
    offensiveRebounds: 2,
    defensiveRebounds: 3,
    assists: 4,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    fouls: 3,
    fieldGoalsMade: 7,
    fieldGoalsAttempted: 14,
    threePointersMade: 2,
    threePointersAttempted: 5,
    freeThrowsMade: 2,
    freeThrowsAttempted: 2,
    touches: 0,
    ...overrides,
  };
}

describe("createGame", () => {
  it("creates a valid scheduled game from GameInput", () => {
    const game = createGame(validInput());
    expect(game.id).toBe("game_1");
    expect(game.seasonId).toBe("season_1");
    expect(game.homeTeamId).toBe("team_home");
    expect(game.awayTeamId).toBe("team_away");
    expect(game.date).toBe("2026-10-15");
    expect(game.score).toEqual({ home: 0, away: 0 });
    expect(game.status).toBe("scheduled");
    expect(game.events).toEqual([]);
    expect(game.playerStats).toEqual([]);
  });

  it("preserves home and away team IDs", () => {
    const game = createGame(
      validInput({
        homeTeamId: asTeamId("team_a"),
        awayTeamId: asTeamId("team_b"),
      }),
    );
    expect(game.homeTeamId).toBe("team_a");
    expect(game.awayTeamId).toBe("team_b");
  });

  it("preserves season ID and date", () => {
    const game = createGame(
      validInput({
        seasonId: asSeasonId("season_2027"),
        date: "2027-01-05",
      }),
    );
    expect(game.seasonId).toBe("season_2027");
    expect(game.date).toBe("2027-01-05");
  });

  it("preserves score, status, events, and playerStats", () => {
    const events = [sampleEvent({ sequence: 1, type: "assist" })];
    const playerStats = [sampleStats()];
    const game = createGame(
      validInput({
        score: { home: 98, away: 95 },
        status: "final",
        events,
        playerStats,
      }),
    );
    expect(game.score).toEqual({ home: 98, away: 95 });
    expect(game.status).toBe("final");
    expect(game.events).toEqual(events);
    expect(game.playerStats).toEqual(playerStats);
  });

  it("accepts in_progress status", () => {
    expect(createGame(validInput({ status: "in_progress" })).status).toBe(
      "in_progress",
    );
  });

  it("accepts duplicate player IDs in playerStats", () => {
    const game = createGame(
      validInput({
        playerStats: [
          sampleStats({ playerId: asPlayerId("player_1"), points: 10 }),
          sampleStats({ playerId: asPlayerId("player_1"), points: 5 }),
        ],
      }),
    );
    expect(game.playerStats).toHaveLength(2);
    expect(game.playerStats[0]!.points).toBe(10);
    expect(game.playerStats[1]!.points).toBe(5);
  });

  it("returns a distinct object from input", () => {
    const input = validInput({
      events: [sampleEvent()],
      playerStats: [sampleStats()],
    });
    const game = createGame(input);
    expect(game).not.toBe(input);
    expect(game.score).not.toBe(input.score);
    expect(game.events).not.toBe(input.events);
    expect(game.playerStats).not.toBe(input.playerStats);
  });

  it("does not mutate the input object", () => {
    const input = validInput({
      events: [sampleEvent()],
      playerStats: [sampleStats()],
    });
    const snapshot = structuredClone(input);
    createGame(input);
    expect(input).toEqual(snapshot);
  });

  it("produces equivalent output for the same valid input", () => {
    const input = validInput({
      events: [sampleEvent()],
      playerStats: [sampleStats()],
    });
    expect(createGame(input)).toEqual(createGame(input));
  });

  it("does not mutate game when input score changes after creation", () => {
    const input = validInput();
    const game = createGame(input);
    input.score.home = 50;
    expect(game.score).toEqual({ home: 0, away: 0 });
  });

  it("does not mutate game when input events array changes after creation", () => {
    const input = validInput({ events: [sampleEvent()] });
    const game = createGame(input);
    input.events.push(sampleEvent({ sequence: 1 }));
    expect(game.events).toHaveLength(1);
  });

  it("does not mutate game when an input event object changes after creation", () => {
    const event = sampleEvent();
    const input = validInput({ events: [event] });
    const game = createGame(input);
    event.sequence = 99;
    event.type = "foul";
    expect(game.events[0]).toEqual(sampleEvent());
  });

  it("does not mutate game when input playerStats array changes after creation", () => {
    const input = validInput({ playerStats: [sampleStats()] });
    const game = createGame(input);
    input.playerStats.push(sampleStats({ playerId: asPlayerId("player_2") }));
    expect(game.playerStats).toHaveLength(1);
  });

  it("does not mutate game when an input player-stat object changes after creation", () => {
    const stats = sampleStats();
    const input = validInput({ playerStats: [stats] });
    const game = createGame(input);
    stats.points = 99;
    expect(game.playerStats[0]!.points).toBe(18);
  });

  it("rejects empty game id", () => {
    expect(() => createGame(validInput({ id: asGameId("") }))).toThrow(/id/);
  });

  it("rejects empty season id", () => {
    expect(() =>
      createGame(validInput({ seasonId: asSeasonId("") })),
    ).toThrow(/seasonId/);
  });

  it("rejects empty home team id", () => {
    expect(() =>
      createGame(validInput({ homeTeamId: asTeamId("") })),
    ).toThrow(/homeTeamId/);
  });

  it("rejects empty away team id", () => {
    expect(() =>
      createGame(validInput({ awayTeamId: asTeamId("") })),
    ).toThrow(/awayTeamId/);
  });

  it("rejects identical home and away teams", () => {
    expect(() =>
      createGame(
        validInput({
          homeTeamId: asTeamId("team_same"),
          awayTeamId: asTeamId("team_same"),
        }),
      ),
    ).toThrow(/homeTeamId and awayTeamId must be different/);
  });

  it("rejects invalid date", () => {
    expect(() => createGame(validInput({ date: "not-a-date" }))).toThrow(
      /date/,
    );
    expect(() => createGame(validInput({ date: "2026-13-01" }))).toThrow(
      /date/,
    );
  });

  it("rejects negative scores", () => {
    expect(() =>
      createGame(validInput({ score: { home: -1, away: 0 } })),
    ).toThrow(/score\.home/);
    expect(() =>
      createGame(validInput({ score: { home: 0, away: -5 } })),
    ).toThrow(/score\.away/);
  });

  it("rejects non-integer scores", () => {
    expect(() =>
      createGame(validInput({ score: { home: 1.5, away: 0 } })),
    ).toThrow(/score\.home/);
    expect(() =>
      createGame(validInput({ score: { home: 0, away: Number.NaN } })),
    ).toThrow(/score\.away/);
  });

  it("rejects invalid status", () => {
    expect(() =>
      createGame(
        validInput({ status: "cancelled" as GameInput["status"] }),
      ),
    ).toThrow(/status/);
  });

  it("rejects non-array events", () => {
    expect(() =>
      createGame({
        ...validInput(),
        events: "not-an-array" as unknown as GameEvent[],
      }),
    ).toThrow(/events must be an array/);
  });

  it("rejects invalid event type", () => {
    expect(() =>
      createGame(
        validInput({
          events: [
            sampleEvent({ type: "timeout" as GameEvent["type"] }),
          ],
        }),
      ),
    ).toThrow(/events\[0\]\.type/);
  });

  it("rejects invalid event sequence", () => {
    expect(() =>
      createGame(validInput({ events: [sampleEvent({ sequence: -1 })] })),
    ).toThrow(/events\[0\]\.sequence/);
    expect(() =>
      createGame(validInput({ events: [sampleEvent({ sequence: 1.5 })] })),
    ).toThrow(/events\[0\]\.sequence/);
  });

  it("rejects empty event player ID when provided", () => {
    expect(() =>
      createGame(
        validInput({
          events: [sampleEvent({ playerId: asPlayerId("") })],
        }),
      ),
    ).toThrow(/events\[0\]\.playerId/);
  });

  it("rejects empty event team ID when provided", () => {
    expect(() =>
      createGame(
        validInput({
          events: [sampleEvent({ teamId: asTeamId("") })],
        }),
      ),
    ).toThrow(/events\[0\]\.teamId/);
  });

  it("accepts null event player and team IDs", () => {
    const game = createGame(
      validInput({
        events: [sampleEvent({ playerId: null, teamId: null })],
      }),
    );
    expect(game.events[0]!.playerId).toBeNull();
    expect(game.events[0]!.teamId).toBeNull();
  });

  it("rejects non-array playerStats", () => {
    expect(() =>
      createGame({
        ...validInput(),
        playerStats: "not-an-array" as unknown as GamePlayerStats[],
      }),
    ).toThrow(/playerStats must be an array/);
  });

  it("rejects empty player ID in playerStats", () => {
    expect(() =>
      createGame(
        validInput({
          playerStats: [sampleStats({ playerId: asPlayerId("") })],
        }),
      ),
    ).toThrow(/playerStats\[0\]\.playerId/);
  });

  it("rejects negative player statistics", () => {
    expect(() =>
      createGame(
        validInput({ playerStats: [sampleStats({ minutes: -1 })] }),
      ),
    ).toThrow(/playerStats\[0\]\.minutes/);
    expect(() =>
      createGame(
        validInput({ playerStats: [sampleStats({ points: -1 })] }),
      ),
    ).toThrow(/playerStats\[0\]\.points/);
    expect(() =>
      createGame(
        validInput({ playerStats: [sampleStats({ rebounds: -1 })] }),
      ),
    ).toThrow(/playerStats\[0\]\.rebounds/);
    expect(() =>
      createGame(
        validInput({ playerStats: [sampleStats({ assists: -1 })] }),
      ),
    ).toThrow(/playerStats\[0\]\.assists/);
    expect(() =>
      createGame(
        validInput({ playerStats: [sampleStats({ steals: -1 })] }),
      ),
    ).toThrow(/playerStats\[0\]\.steals/);
    expect(() =>
      createGame(
        validInput({ playerStats: [sampleStats({ blocks: -1 })] }),
      ),
    ).toThrow(/playerStats\[0\]\.blocks/);
    expect(() =>
      createGame(
        validInput({ playerStats: [sampleStats({ turnovers: -1 })] }),
      ),
    ).toThrow(/playerStats\[0\]\.turnovers/);
    expect(() =>
      createGame(
        validInput({ playerStats: [sampleStats({ fouls: -1 })] }),
      ),
    ).toThrow(/playerStats\[0\]\.fouls/);
  });

  it("rejects non-integer player statistics", () => {
    expect(() =>
      createGame(
        validInput({ playerStats: [sampleStats({ points: 1.5 })] }),
      ),
    ).toThrow(/playerStats\[0\]\.points/);
    expect(() =>
      createGame(
        validInput({
          playerStats: [sampleStats({ minutes: Number.NaN })],
        }),
      ),
    ).toThrow(/playerStats\[0\]\.minutes/);
  });
});
