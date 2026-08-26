import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState, createFourTeamInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { updateStandings } from "@/systems/standings";
import {
  isRegularSeasonComplete,
  processSeasonLifecycle,
  enterOffseasonFromPostseason,
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
import { createDefaultOwnershipConfidence } from "@/domain/entities/ownership-confidence";
import { createPhaseEBusinessDefaults } from "@/state/phase-e-defaults";

describe("season lifecycle", () => {
  it("transitions preseason → regular and generates a same-day opener schedule", () => {
    const state = createInitialGameState({
    saveId: "life_pre", rngSeed: 1,
    settings: CBL_GAME_SETTINGS,
  });
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
    let state = createInitialGameState({
    saveId: "life_empty",
    settings: CBL_GAME_SETTINGS,
  });
    state = transitionPhase(state, "regular").state;
    expect(isRegularSeasonComplete(state)).toBe(false);
    const result = processSeasonLifecycle(state);
    expect(result.state.competition.season.phase).toBe("regular");
  });

  it("moves regular → playoffs for four-team leagues (field size 4)", () => {
    const { state: rostered, rng } = (() => {
      const state = createFourTeamInitialGameState({
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
    expect(result.state.competition.season.phase).toBe("playoffs");
    expect(result.state.competition.playoffs.fieldSize).toBe(4);
  });

  it("holds on postseason until enterOffseasonFromPostseason", () => {
    let state = createInitialGameState({
    saveId: "life_off",
    settings: CBL_GAME_SETTINGS,
  });
    state = transitionPhase(state, "regular").state;
    state = transitionPhase(state, "postseason").state;
    const held = processSeasonLifecycle(state);
    expect(held.state.competition.season.phase).toBe("postseason");

    const entered = enterOffseasonFromPostseason(held.state);
    expect(entered.state.competition.season.phase).toBe("offseason");
    expect(entered.state.competition.season.offseasonStage).toBe(
      "season_finalization",
    );
  });

  it("records regularSeasonStartDate when leaving preseason", () => {
    const state = createInitialGameState({
      saveId: "life_start_date",
      rngSeed: 3,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng).state;
    const result = processSeasonLifecycle(bootstrapped);
    expect(result.state.competition.season.phase).toBe("regular");
    expect(result.state.competition.season.regularSeasonStartDate).toBe(
      bootstrapped.world.calendar.currentDate,
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
          booksByMonth: {},
          cashLedgerByMonth: {},
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
      settings: {
        ...CBL_GAME_SETTINGS,
        league: {
          teamCount: 16,
          conferenceCount: 2,
          divisionsEnabled: true,
        },
        regularSeason: {
          gamesPerTeam: 30,
          tradeDeadlineRule: {
            kind: "fraction_of_season_span",
            seasonSpanFraction: 0.55,
          },
        },
        playoffs: {
          playoffTeams: 8,
          seriesLength: 7,
          playInEnabled: false,
        },
      },
      world: {
        calendar: {
          currentDate: "2026-10-01",
          lastSimulatedDate: null,
          lastSimulatedWeekId: null,
          lastSimulatedMonthId: null,
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
          regularSeasonStartDate: null,
          offseasonStageEnteredDate: null,
          freeAgencyExtendedUntil: null,
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
        ...createPhaseEBusinessDefaults(
          generated.teams.map((team) => team.id as TeamId),
        ),
      },
      user: {
        controlledTeamId: generated.teams[0]!.id as TeamId,
        mode: "owner",
        citySelectionConfirmed: true,
        ownerStartSeasonYear: 2026,
        ownerPhilosophy: "balanced",
        ownerPatience: 55,
        ownershipConfidence: createDefaultOwnershipConfidence("2026-10-01"),
        objectives: [],
        notifications: [],
        eventLog: [],
        appliedGameplayConsequenceKeys: {},
        explicitDecisions: {},
        phaseSkips: [],
        aiAssistState: {
          resolvedNeeds: {},
          seasonCounters: {
            seasonYear: 0,
            decisions: 0,
            rosterMoves: 0,
            freeAgentSignings: 0,
          },
        },
        pendingOwnerDecisions: [],
        ownerDecisionHistory: [],
        narrative: { situations: [], snapshots: [], cooldowns: {} },
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
