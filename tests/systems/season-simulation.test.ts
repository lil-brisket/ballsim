import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asPlayerId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { generateRosters } from "@/systems/roster-generation";
import { generateSchedule } from "@/systems/schedule-generation";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { simulateSeason } from "@/systems/season-simulation";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

function bootstrapRosters(saveId: string, rngSeed: number) {
  const state = createInitialGameState({
    saveId,
    rngSeed,
    nowIso: "2026-08-13T12:00:00.000Z",
  });
  const rng = createSeededRng(state.meta.rngState);
  const afterRosters = generateRosters(state, rng);
  return { state: afterRosters.state, rng };
}

function scheduleRegularSeason(state: ReturnType<typeof createInitialGameState>) {
  const phased = transitionPhase(state, "regular").state;
  return generateSchedule(phased).state;
}

function snapshotScheduledGames(state: ReturnType<typeof createInitialGameState>) {
  return state.competition.schedule.gameIds.map((gameId) => {
    const game = state.competition.games[gameId]!;
    return structuredClone({
      id: game.id,
      status: game.status,
      score: game.score,
      events: game.events,
      playerStats: game.playerStats,
      periodScores: game.periodScores,
    });
  });
}

describe("simulateSeason", () => {
  it("generates a schedule from preseason and finals every game with matching standings", () => {
    resetDomainEventSequenceForTests();
    const { state, rng } = bootstrapRosters("save_season_happy", 101);

    expect(state.competition.season.phase).toBe("preseason");
    expect(state.competition.schedule.gameIds).toHaveLength(0);

    const result = simulateSeason(state, rng);
    const teamCount = Object.keys(state.world.teams).length;
    const expectedGames = teamCount * (teamCount - 1);

    expect(result.state.competition.season.phase).toBe("regular");
    expect(result.state.competition.schedule.gameIds).toHaveLength(expectedGames);

    for (const gameId of result.state.competition.schedule.gameIds) {
      const game = result.state.competition.games[gameId]!;
      expect(game.status).toBe("final");
      expect(game.events.length).toBeGreaterThan(0);
      expect(game.playerStats.length).toBeGreaterThan(0);
      expect(game.score.home).not.toBe(game.score.away);
    }

    const standings = result.state.competition.standings.byTeamId;
    expect(Object.keys(standings)).toHaveLength(teamCount);

    let sumWinsLosses = 0;
    for (const teamId of Object.keys(state.world.teams)) {
      const row = standings[teamId]!;
      expect(row).toBeDefined();
      const gamesPlayed = result.state.competition.schedule.gameIds.filter(
        (gameId) => {
          const game = result.state.competition.games[gameId]!;
          return (
            game.status === "final" &&
            (game.homeTeamId === teamId || game.awayTeamId === teamId)
          );
        },
      ).length;
      expect(row.wins + row.losses).toBe(gamesPlayed);
      sumWinsLosses += row.wins + row.losses;
    }

    const completedFinalGames = result.state.competition.schedule.gameIds.filter(
      (gameId) => result.state.competition.games[gameId]?.status === "final",
    ).length;
    expect(sumWinsLosses).toBe(2 * completedFinalGames);
  });

  it("simulates only remaining scheduled games in a partial season", () => {
    resetDomainEventSequenceForTests();
    const { state: rostered, rng } = bootstrapRosters("save_season_partial", 102);
    const scheduled = scheduleRegularSeason(rostered);

    const firstFourIds = scheduled.competition.schedule.gameIds.slice(0, 4);
    const dates = [
      ...new Set(
        firstFourIds.map((id) => scheduled.competition.games[id]!.date),
      ),
    ];

    let current = scheduled;
    for (const date of dates) {
      current = simulateGamesForDate(current, rng, date).state;
    }

    for (const gameId of firstFourIds) {
      expect(current.competition.games[gameId]?.status).toBe("final");
    }
    const remainingScheduled = current.competition.schedule.gameIds.filter(
      (gameId) => current.competition.games[gameId]?.status === "scheduled",
    );
    expect(remainingScheduled).toHaveLength(8);

    const firstFourSnapshot = firstFourIds.map((gameId) =>
      structuredClone(current.competition.games[gameId]!),
    );

    const result = simulateSeason(current, rng);

    for (let index = 0; index < firstFourIds.length; index += 1) {
      const gameId = firstFourIds[index]!;
      expect(result.state.competition.games[gameId]).toEqual(
        firstFourSnapshot[index],
      );
    }

    for (const gameId of result.state.competition.schedule.gameIds) {
      expect(result.state.competition.games[gameId]?.status).toBe("final");
    }
  });

  it("is idempotent: second call leaves finals unchanged and emits no GameCompleted", () => {
    resetDomainEventSequenceForTests();
    const { state, rng } = bootstrapRosters("save_season_idempotent", 103);

    const first = simulateSeason(state, rng);
    const gamesSnapshot = snapshotScheduledGames(first.state);
    const rngBeforeSecond = rng.getState();

    const second = simulateSeason(first.state, rng);

    expect(snapshotScheduledGames(second.state)).toEqual(gamesSnapshot);
    expect(
      second.events.filter((event) => event.type === "GameCompleted"),
    ).toHaveLength(0);
    expect(rng.getState()).toBe(rngBeforeSecond);
  });

  it("throws on an unknown home team reference", () => {
    const { state: rostered, rng } = bootstrapRosters("save_season_bad_team", 104);
    const scheduled = scheduleRegularSeason(rostered);
    const gameId = scheduled.competition.schedule.gameIds[0]!;
    const game = scheduled.competition.games[gameId]!;

    const corrupted = {
      ...scheduled,
      competition: {
        ...scheduled.competition,
        games: {
          ...scheduled.competition.games,
          [gameId]: createGame({
            ...game,
            homeTeamId: asTeamId("team_missing_home"),
          }),
        },
      },
    };

    expect(() => simulateSeason(corrupted, rng)).toThrow(/unknown home team/);
  });

  it("throws when a scheduled game id is missing from games", () => {
    const { state: rostered, rng } = bootstrapRosters(
      "save_season_missing_game",
      105,
    );
    const scheduled = scheduleRegularSeason(rostered);
    const gameId = scheduled.competition.schedule.gameIds[0]!;
    const { [gameId]: _removed, ...remainingGames } = scheduled.competition.games;

    const corrupted = {
      ...scheduled,
      competition: {
        ...scheduled.competition,
        games: remainingGames,
      },
    };

    expect(() => simulateSeason(corrupted, rng)).toThrow(/missing from competition.games/);
  });

  it("throws when preseason already has a schedule", () => {
    const { state: rostered, rng } = bootstrapRosters(
      "save_season_preseason_sched",
      106,
    );
    const scheduled = generateSchedule(rostered).state;
    const inconsistent = {
      ...scheduled,
      competition: {
        ...scheduled.competition,
        season: {
          ...scheduled.competition.season,
          phase: "preseason" as const,
        },
      },
    };

    expect(() => simulateSeason(inconsistent, rng)).toThrow(/preseason/);
  });

  it("throws when a team roster references a missing player", () => {
    const { state: rostered, rng } = bootstrapRosters(
      "save_season_dangling_roster",
      107,
    );
    const scheduled = scheduleRegularSeason(rostered);
    const teamId = Object.keys(scheduled.world.teams)[0]!;
    const team = scheduled.world.teams[teamId]!;

    const corrupted = {
      ...scheduled,
      world: {
        ...scheduled.world,
        teams: {
          ...scheduled.world.teams,
          [teamId]: {
            ...team,
            roster: [asPlayerId("player_missing_dangling")],
          },
        },
      },
    };

    expect(() => simulateSeason(corrupted, rng)).toThrow(/missing player/);
  });

  it("does not mutate the caller-provided state on validation failure", () => {
    const { state: rostered, rng } = bootstrapRosters(
      "save_season_atomic",
      108,
    );
    const scheduled = scheduleRegularSeason(rostered);
    const snapshot = structuredClone(scheduled);
    const gameId = scheduled.competition.schedule.gameIds[0]!;
    const game = scheduled.competition.games[gameId]!;

    const corrupted = {
      ...scheduled,
      competition: {
        ...scheduled.competition,
        games: {
          ...scheduled.competition.games,
          [gameId]: createGame({
            ...game,
            awayTeamId: asTeamId("team_missing_away"),
          }),
        },
      },
    };

    expect(() => simulateSeason(corrupted, rng)).toThrow(/unknown away team/);
    expect(scheduled).toEqual(snapshot);
  });
});
