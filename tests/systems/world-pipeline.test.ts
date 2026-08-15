import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld, runWorldPipeline } from "@/systems/world-pipeline";
import { generateRosters } from "@/systems/roster-generation";
import { generateSchedule } from "@/systems/schedule-generation";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import {
  isPlayerNationality,
  PLAYER_NATIONALITIES,
} from "@/domain/entities/player-nationality";

describe("roster and schedule generation", () => {
  it("fills players and contracts for every team", () => {
    const state = createInitialGameState({
      saveId: "save_roster",
      rngSeed: 11,
      nowIso: "2026-08-13T12:00:00.000Z",
    });
    const rng = createSeededRng(state.meta.rngState);
    const result = generateRosters(state, rng);

    const teamCount = Object.keys(state.world.teams).length;
    expect(Object.keys(result.state.world.players)).toHaveLength(teamCount * 10);
    expect(Object.keys(result.state.business.contracts)).toHaveLength(
      teamCount * 10,
    );
  });

  it("assigns a valid nationality to every generated player", () => {
    const state = createInitialGameState({
      saveId: "save_roster_nationality",
      rngSeed: 19,
      nowIso: "2026-08-13T12:00:00.000Z",
    });
    const rng = createSeededRng(state.meta.rngState);
    const result = generateRosters(state, rng);

    const players = Object.values(result.state.world.players);
    expect(players.length).toBeGreaterThan(0);
    for (const player of players) {
      expect(isPlayerNationality(player.nationality)).toBe(true);
      expect(PLAYER_NATIONALITIES).toContain(player.nationality);
      expect(player.firstName.length).toBeGreaterThan(0);
      expect(player.lastName.length).toBeGreaterThan(0);
    }
  });

  it("is idempotent when players already exist", () => {
    const state = createInitialGameState({
      saveId: "save_roster_once",
      rngSeed: 12,
    });
    const rng = createSeededRng(state.meta.rngState);
    const first = generateRosters(state, rng);
    const second = generateRosters(first.state, rng);
    expect(second.state.world.players).toEqual(first.state.world.players);
  });

  it("writes Team.roster so player.teamId and roster membership stay consistent", () => {
    const state = createInitialGameState({
      saveId: "save_roster_dual",
      rngSeed: 21,
      nowIso: "2026-08-13T12:00:00.000Z",
    });
    const rng = createSeededRng(state.meta.rngState);
    const result = generateRosters(state, rng);

    for (const team of Object.values(result.state.world.teams)) {
      expect(team.roster).toHaveLength(10);
      for (const playerId of team.roster) {
        const player = result.state.world.players[playerId];
        expect(player).toBeDefined();
        expect(player!.teamId).toBe(team.id);
      }
    }

    for (const player of Object.values(result.state.world.players)) {
      expect(player.teamId).not.toBeNull();
      const team = result.state.world.teams[player.teamId!];
      expect(team).toBeDefined();
      expect(team!.roster).toContain(player.id);
    }
  });

  it("builds a double round-robin and moves season to regular", () => {
    const state = createInitialGameState({
      saveId: "save_sched",
      rngSeed: 13,
      nowIso: "2026-08-13T12:00:00.000Z",
    });
    const result = generateSchedule(state);
    const teamCount = Object.keys(state.world.teams).length;
    const expectedGames = teamCount * (teamCount - 1);

    expect(result.state.competition.schedule.gameIds).toHaveLength(expectedGames);
    expect(result.state.competition.season.phase).toBe("regular");
    expect(
      Object.values(result.state.competition.games).every(
        (game) =>
          game.status === "scheduled" && game.playerStats.length === 0,
      ),
    ).toBe(true);

    // First round games share one calendar date (day after currentDate)
    const firstDate = "2026-10-02";
    const firstRoundGames = Object.values(result.state.competition.games).filter(
      (game) => game.date === firstDate,
    );
    expect(firstRoundGames.length).toBe(teamCount / 2);
  });

  it("throws when the empty schedule has fewer than two teams", () => {
    const state = createInitialGameState({
      saveId: "save_sched_empty",
      rngSeed: 14,
      nowIso: "2026-08-13T12:00:00.000Z",
    });
    const emptyTeams = {
      ...state,
      world: {
        ...state.world,
        teams: {},
      },
      competition: {
        ...state.competition,
        schedule: {
          seasonId: state.competition.season.id,
          gameIds: [],
        },
        games: {},
      },
    };
    expect(() => generateSchedule(emptyTeams)).toThrow(/at least 2 teams/);
  });
});

describe("world pipeline advanceDay", () => {
  it("bootstraps, sims games on current date when any exist, then advances calendar", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "save_advance",
      rngSeed: 42,
      nowIso: "2026-08-13T12:00:00.000Z",
    });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng);

    // Move a scheduled game onto the current date so the first advance sims it.
    const firstGameId = bootstrapped.state.competition.schedule.gameIds[0]!;
    const firstGame = bootstrapped.state.competition.games[firstGameId]!;
    const prepared = {
      ...bootstrapped.state,
      competition: {
        ...bootstrapped.state.competition,
        games: {
          ...bootstrapped.state.competition.games,
          [firstGameId]: {
            ...firstGame,
            date: bootstrapped.state.world.calendar.currentDate,
          },
        },
      },
    };

    const advanced = runWorldPipeline(prepared, rng, { type: "advanceDay" });

    expect(advanced.state.world.calendar.currentDate).toBe("2026-10-02");
    expect(advanced.state.competition.games[firstGameId]?.status).toBe("final");
    expect(
      advanced.events.some((event) => event.type === "GameCompleted"),
    ).toBe(true);

    const standing = Object.values(advanced.state.competition.standings.byTeamId);
    const totalDecisions = standing.reduce(
      (acc, row) => acc + row.wins + row.losses,
      0,
    );
    expect(totalDecisions).toBe(2);
  });

  it("continues the RNG stream across advances via getState", () => {
    const state = createInitialGameState({
      saveId: "save_rng_cont",
      rngSeed: 7,
    });
    const rngA = createSeededRng(state.meta.rngState);
    const first = runWorldPipeline(state, rngA, { type: "advanceDay" });
    const midState = rngA.getState();

    const rngB = createSeededRng(midState);
    const second = runWorldPipeline(first.state, rngB, { type: "advanceDay" });

    const rngReplay = createSeededRng(state.meta.rngState);
    const replayFirst = runWorldPipeline(state, rngReplay, {
      type: "advanceDay",
    });
    const replaySecond = runWorldPipeline(replayFirst.state, rngReplay, {
      type: "advanceDay",
    });

    expect(second.state.world.calendar.currentDate).toBe(
      replaySecond.state.world.calendar.currentDate,
    );
    expect(second.state.competition.standings).toEqual(
      replaySecond.state.competition.standings,
    );
  });
});
