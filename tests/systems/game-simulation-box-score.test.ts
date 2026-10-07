import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { assertCompletedGameBoxScore } from "@/domain/entities/game-box-score";
import type { Player } from "@/domain/entities/player";
import {
  asGameId,
  asPlayerId,
  asSeasonId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";
import { createTestGameState } from "../factories/game-state";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { simulateGameBoxScore } from "@/systems/game-simulation-box-score";
import {
  simulateGame,
  simulateScheduledGame,
} from "@/systems/game-simulation";

const HOME = asTeamId("team_home");
const AWAY = asTeamId("team_away");

function makeRoster(teamId: TeamId, prefix: string, count: number): Player[] {
  const positions = ["PG", "SG", "SF", "PF", "C"] as const;
  return Array.from({ length: count }, (_, index) =>
    createPlayer({
      id: asPlayerId(`${prefix}_${index + 1}`),
      teamId,
      position: positions[index % positions.length]!,
      firstName: prefix,
      lastName: `P${index + 1}`,
    }),
  );
}

function scheduledGame() {
  return createGame({
    competitionType: "regular_season",
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
    id: asGameId("game_box_1"),
    seasonId: asSeasonId("season_1"),
    homeTeamId: HOME,
    awayTeamId: AWAY,
    date: "2026-10-15",
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
  });
}

describe("simulateGameBoxScore", () => {
  it("produces a valid non-tied box score with conserved points", () => {
    const home = makeRoster(HOME, "home", 10);
    const away = makeRoster(AWAY, "away", 10);
    const result = simulateGameBoxScore(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away },
      createTestRng(42),
    );

    expect(result.status).toBe("final");
    expect(result.score.home).not.toBe(result.score.away);
    expect(result.events).toEqual([]);
    expect(result.periodScores).toHaveLength(4);
    const summed = result.periodScores.reduce(
      (acc, period) => ({
        home: acc.home + period.home,
        away: acc.away + period.away,
      }),
      { home: 0, away: 0 },
    );
    expect(summed).toEqual(result.score);

    const homePoints = result.playerStats
      .filter((row) => row.teamId === HOME)
      .reduce((sum, row) => sum + row.points, 0);
    const awayPoints = result.playerStats
      .filter((row) => row.teamId === AWAY)
      .reduce((sum, row) => sum + row.points, 0);
    expect(homePoints).toBe(result.score.home);
    expect(awayPoints).toBe(result.score.away);
  });

  it("is deterministic for a fixed seed", () => {
    const home = makeRoster(HOME, "home", 8);
    const away = makeRoster(AWAY, "away", 8);
    const a = simulateGameBoxScore(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away },
      createTestRng(99),
    );
    const b = simulateGameBoxScore(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away },
      createTestRng(99),
    );
    expect(a.score).toEqual(b.score);
    expect(a.playerStats).toEqual(b.playerStats);
  });

  it("gives assists to passers and rebounds/blocks to bigs", () => {
    const home = [
      createPlayer({
        id: asPlayerId("home_pg"),
        teamId: HOME,
        position: "PG",
        firstName: "Pass",
        lastName: "First",
        attributes: {
          passing: 95,
          ballHandling: 92,
          finishing: 70,
          midRange: 70,
          threePoint: 70,
          rebounding: 40,
          steal: 88,
          block: 35,
        },
      }),
      ...makeRoster(HOME, "home", 9).slice(1),
    ];
    home[1] = createPlayer({
      id: asPlayerId("home_c"),
      teamId: HOME,
      position: "C",
      firstName: "Rim",
      lastName: "Protect",
      attributes: {
        passing: 38,
        ballHandling: 40,
        finishing: 78,
        midRange: 55,
        threePoint: 32,
        rebounding: 95,
        steal: 40,
        block: 94,
        interiorDefense: 90,
      },
    });
    const away = makeRoster(AWAY, "away", 10);
    const result = simulateGameBoxScore(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away },
      createTestRng(7),
    );
    const pg = result.playerStats.find((row) => row.playerId === "home_pg");
    const center = result.playerStats.find((row) => row.playerId === "home_c");
    expect(pg).toBeDefined();
    expect(center).toBeDefined();
    expect(pg!.assists).toBeGreaterThan(center!.assists);
    expect(center!.rebounds).toBeGreaterThan(pg!.rebounds);
    expect(center!.blocks).toBeGreaterThan(pg!.blocks);
    expect(pg!.steals).toBeGreaterThanOrEqual(center!.steals);
  });

  it("is faster than a short possession sim on the same rosters", () => {
    const home = makeRoster(HOME, "home", 10);
    const away = makeRoster(AWAY, "away", 10);
    const game = scheduledGame();
    const context = { homePlayers: home, awayPlayers: away };

    simulateGameBoxScore(game, context, createTestRng(1));
    simulateGame(game, context, createTestRng(1));

    const boxStart = performance.now();
    for (let index = 0; index < 20; index += 1) {
      simulateGameBoxScore(game, context, createTestRng(index + 2));
    }
    const boxMs = performance.now() - boxStart;

    const possStart = performance.now();
    simulateGame(
      game,
      {
        ...context,
        config: {
          regulationPeriodSeconds: 120,
          overtimePeriodSeconds: 30,
        },
      },
      createTestRng(7),
    );
    const possMs = performance.now() - possStart;

    expect(boxMs / 20).toBeLessThan(possMs);
  });
});

describe("simulateScheduledGame box_score fidelity", () => {
  it("finalizes CPU games with valid box scores and no play-by-play", () => {
    let state = createTestGameState({ saveId: "box_sched" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamIds = Object.keys(state.world.teams);
    const homeTeamId = asTeamId(teamIds[0]!);
    const awayTeamId = asTeamId(teamIds[1]!);
    const game = createGame({
      id: asGameId("game_box_sched_1"),
      seasonId: state.competition.season.id,
      date: state.world.calendar.currentDate,
      homeTeamId,
      awayTeamId,
      competitionType: "regular_season",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    state = {
      ...state,
      competition: {
        ...state.competition,
        games: { [game.id]: game },
      },
    };

    const { finalGame } = simulateScheduledGame(state, game, createTestRng(11), {
      fidelity: "box_score",
      ownerTeamId: asTeamId("team_someone_else"),
    });
    expect(finalGame.status).toBe("final");
    expect(finalGame.events).toEqual([]);
    expect(() => assertCompletedGameBoxScore(finalGame)).not.toThrow();
  });

  it("keeps possession engine for the owner team", () => {
    let state = createTestGameState({ saveId: "box_owner" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamIds = Object.keys(state.world.teams);
    const homeTeamId = asTeamId(teamIds[0]!);
    const awayTeamId = asTeamId(teamIds[1]!);
    const game = createGame({
      id: asGameId("game_box_owner_1"),
      seasonId: state.competition.season.id,
      date: state.world.calendar.currentDate,
      homeTeamId,
      awayTeamId,
      competitionType: "regular_season",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    state = {
      ...state,
      competition: {
        ...state.competition,
        games: { [game.id]: game },
      },
    };

    const { finalGame } = simulateScheduledGame(state, game, createTestRng(12), {
      fidelity: "box_score",
      ownerTeamId: homeTeamId,
    });
    expect(finalGame.events.length).toBeGreaterThan(0);
  });
});
