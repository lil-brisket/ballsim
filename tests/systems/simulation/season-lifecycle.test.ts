import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { updateStandings } from "@/systems/standings";
import {
  isRegularSeasonComplete,
  processSeasonLifecycle,
} from "@/systems/simulation/season-lifecycle";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { simulatePlayoffs } from "@/systems/playoff-simulation";
import { generateLeague } from "@/systems/league-generation";
import { generateRosters } from "@/systems/roster-generation";
import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import {
  asSaveId,
  asSeasonId,
  type TeamId,
} from "@/domain/ids";
import { GAME_STATE_SCHEMA_VERSION, type GameState } from "@/state/game-state";
import { createEmptyTeamFinanceBooks } from "@/domain/entities/finances";

describe("season lifecycle", () => {
  it("transitions preseason → regular and generates a same-day opener schedule", () => {
    const state = createInitialGameState({ saveId: "life_pre", rngSeed: 1 });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng).state;

    const result = processSeasonLifecycle(bootstrapped);
    expect(result.state.competition.season.phase).toBe("regular");
    expect(result.state.competition.schedule.gameIds.length).toBeGreaterThan(0);

    const openers = Object.values(result.state.competition.games).filter(
      (game) => game.date === bootstrapped.world.calendar.currentDate,
    );
    expect(openers.length).toBeGreaterThan(0);
  });

  it("does not treat an empty schedule as a completed regular season", () => {
    let state = createInitialGameState({ saveId: "life_empty" });
    state = transitionPhase(state, "regular").state;
    expect(isRegularSeasonComplete(state)).toBe(false);
    const result = processSeasonLifecycle(state);
    expect(result.state.competition.season.phase).toBe("regular");
  });

  it("moves regular → postseason when playoff field size is 0", () => {
    const { state: rostered, rng } = (() => {
      const state = createInitialGameState({
        saveId: "life_post_4",
        rngSeed: 11,
      });
      const rng = createSeededRng(state.meta.rngState);
      return { state: bootstrapWorld(state, rng).state, rng };
    })();

    let current = processSeasonLifecycle(rostered).state;
    expect(current.competition.season.phase).toBe("regular");

    const dates = [
      ...new Set(
        Object.values(current.competition.games).map((game) => game.date),
      ),
    ].sort();
    for (const date of dates) {
      current = simulateGamesForDate(current, rng, date).state;
    }
    current = updateStandings(current).state;
    expect(isRegularSeasonComplete(current)).toBe(true);

    const result = processSeasonLifecycle(current);
    expect(result.state.competition.season.phase).toBe("postseason");
  });

  it("moves postseason → offseason with season_finalization stage", () => {
    let state = createInitialGameState({ saveId: "life_off" });
    state = transitionPhase(state, "regular").state;
    state = transitionPhase(state, "postseason").state;
    const result = processSeasonLifecycle(state);
    expect(result.state.competition.season.phase).toBe("offseason");
    expect(result.state.competition.season.offseasonStage).toBe(
      "season_finalization",
    );
  });

  it("moves regular → playoffs when the league is large enough", () => {
    const rng = createSeededRng(42);
    const generated = generateLeague(
      {
        leagueName: "Big League",
        conferenceCount: 2,
        divisionsPerConference: 2,
        teamsPerDivision: 4,
      },
      rng,
    );

    const teams = Object.fromEntries(
      generated.teams.map((team) => [team.id, team]),
    );
    const conferences = Object.fromEntries(
      generated.conferences.map((conference) => [conference.id, conference]),
    );
    const divisions = Object.fromEntries(
      generated.divisions.map((division) => [division.id, division]),
    );
    const seasonId = asSeasonId("season_big");
    const standings = {
      byTeamId: Object.fromEntries(
        generated.teams.map((team) => [
          team.id,
          createEmptyTeamStanding(team.id as TeamId),
        ]),
      ),
    };
    const finances = Object.fromEntries(
      generated.teams.map((team) => [
        team.id,
        {
          teamId: team.id as TeamId,
          cash: 0,
          payroll: 0,
          booksByYear: { "2026": createEmptyTeamFinanceBooks() },
        },
      ]),
    );

    let state: GameState = {
      meta: {
        saveId: asSaveId("life_playoffs"),
        schemaVersion: GAME_STATE_SCHEMA_VERSION,
        createdAt: "2026-08-13T12:00:00.000Z",
        updatedAt: "2026-08-13T12:00:00.000Z",
        rngSeed: 42,
        rngState: rng.getState(),
      },
      world: {
        calendar: {
          currentDate: "2026-10-01",
          lastSimulatedDate: null,
          lastSimulatedWeekId: null,
        },
        league: generated.league,
        conferences,
        divisions,
        teams,
        players: {},
        coaches: {},
        staff: {},
        draftPicks: {},
        drafts: {},
        scheduledEvents: {},
      },
      competition: {
        season: {
          id: seasonId,
          year: 2026,
          phase: "preseason",
          offseasonStage: "none",
        },
        schedule: { seasonId, gameIds: [] },
        games: {},
        standings,
        playoffs: createEmptyPlayoffTournament(),
      },
      business: {
        contracts: {},
        finances,
        freeAgency: { offers: {} },
        tradeBlocks: {},
      },
      user: {
        controlledTeamId: generated.teams[0]!.id as TeamId,
        mode: "owner",
        objectives: [],
      },
    };

    state = generateRosters(state, rng).state;
    state = processSeasonLifecycle(state).state;
    expect(state.competition.season.phase).toBe("regular");

    const dates = [
      ...new Set(
        Object.values(state.competition.games).map((game) => game.date),
      ),
    ].sort();
    for (const date of dates) {
      state = simulateGamesForDate(state, rng, date).state;
    }
    state = updateStandings(state).state;

    const result = processSeasonLifecycle(state);
    expect(result.state.competition.season.phase).toBe("playoffs");
    expect(result.state.competition.playoffs.status).toBe("in_progress");

    const finished = simulatePlayoffs(result.state, rng).state;
    const afterPlayoffs = processSeasonLifecycle(finished);
    expect(afterPlayoffs.state.competition.season.phase).toBe("postseason");
  });
});
