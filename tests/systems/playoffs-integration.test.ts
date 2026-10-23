import { DEFAULT_PAYROLL_RULE_SETTINGS } from "@/domain/game-settings";
import { describe, expect, it } from "vitest";
import { DEFAULT_SEASON_EVENTS_SETTINGS } from "@/domain/game-settings";
import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptySeasonEventsState } from "@/domain/entities/season-events";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { asSaveId, asSeasonId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createFourTeamInitialGameState } from "@/state/create-initial-state";
import { GAME_STATE_SCHEMA_VERSION, type GameState } from "@/state/game-state";
import { generateLeague } from "@/systems/league-generation";
import { generateRosters } from "@/systems/roster-generation";
import {
  getPlayoffTeamCount,
  SERIES_WINS_TO_CLINCH,
} from "@/systems/playoff-config";
import {
  simulateNextPlayoffGame,
  simulatePlayoffDay,
  startPlayoffs,
} from "@/systems/playoff-simulation";
import { addCalendarDays } from "@/domain/calendar-date";
import { simulateSeason } from "@/systems/season-simulation";
import { updateStandings } from "@/systems/standings";
import { createPhaseEBusinessDefaults } from "@/state/phase-e-defaults";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

function createEightTeamGameState(
  rngSeed: number,
  shape: { teamsPerDivision: number; playoffTeams: number } = {
    teamsPerDivision: 2,
    playoffTeams: 8,
  },
): {
  state: GameState;
  rng: ReturnType<typeof createSeededRng>;
} {
  const rng = createSeededRng(rngSeed);
  const generated = generateLeague(
    {
      leagueId: "league_playoff_e2e",
      leagueName: "Playoff Test League",
      conferenceCount: 2,
      divisionsPerConference: 2,
      teamsPerDivision: shape.teamsPerDivision,
      rosterSize: 10,
    },
    rng,
  );

  const seasonId = asSeasonId("season_playoff_e2e");
  const teams = Object.fromEntries(
    generated.teams.map((team) => [team.id, team]),
  );
  const players = Object.fromEntries(
    generated.players.map((player) => [player.id, player]),
  );
  const conferences = Object.fromEntries(
    generated.conferences.map((conference) => [conference.id, conference]),
  );
  const divisions = Object.fromEntries(
    generated.divisions.map((division) => [division.id, division]),
  );

  const finances = Object.fromEntries(
    generated.teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        businessFunds: 50_000_000,
        payroll: 0,
        booksByYear: {},
        attendanceByYear: {},
        booksByMonth: {},
        businessFundsLedgerByMonth: {},
      },
    ]),
  );

  const standings = {
    byTeamId: Object.fromEntries(
      generated.teams.map((team) => [
        team.id,
        createEmptyTeamStanding(team.id),
      ]),
    ),
  };

  const controlledTeamId = generated.teams[0]!.id as TeamId;

  const state: GameState = {
    meta: {
      saveId: asSaveId("save_playoff_e2e"),
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      createdAt: TEST_NOW_ISO,
      updatedAt: TEST_NOW_ISO,
      rngSeed,
      rngState: rng.getState(),
    },
    settings: {
      league: {
        teamCount: 4 * shape.teamsPerDivision,
        conferenceCount: 2,
        divisionsEnabled: true,
        area: "north_america",
      },
      injuryFrequency: "medium",
      ownership: { controlledTeamCount: 1 },
      regularSeason: {
        gamesPerTeam: 14,
        tradeDeadlineRule: {
          kind: "fraction_of_season_span",
          seasonSpanFraction: 0.55,
        },
      },
      playoffs: {
        playoffTeams: shape.playoffTeams,
        seriesLength: 7,
        playInEnabled: false,
      },
      simulation: { frequency: "daily" },
      seasonEvents: { ...DEFAULT_SEASON_EVENTS_SETTINGS },
      ai: {
        difficulty: "normal",
        managementPreset: "continuity",
        assistance: {
          injuriesEmergencyRoster: "continuity",
          rotationsDepthChart: "continuity",
          freeAgency: "continuity",
          trades: "off",
          waiversReleases: "continuity",
          contracts: "off",
          draftScouting: "off",
          draftSelection: "off",
          coachingStaff: "continuity",
          frontOfficeStaff: "continuity",
          strategicRosterDecisions: "off",
          longTermPlanning: "off",
        },
      },
      financialRules: {
        salaryCapEnabled: true,
        salaryCap: 100_000_000,
        staffBudget: 12_000_000,
        luxuryTaxEnabled: true,
        revenueSharingEnabled: true,
        ...DEFAULT_PAYROLL_RULE_SETTINGS,
      },
      draft: {
        mode: "standard",
        type: "snake",
        timerSeconds: null,
        orderMode: "random",
        userPickPosition: null,
        randomizeUserPick: false,
      },
      history: { mode: "new" },
      offseason: {
        freeAgency: { durationDays: 30, allowExtension: true },
        restrictedFreeAgency: true,
      },
      draftLottery: { enabled: true, oddsPreset: "flattened", picksDrawn: 4 },
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
      players,
      coaches: {},
      staff: {},
      staffMarket: { offers: {} },
      draftPicks: {},
      drafts: {},
      fantasyDraft: null,
      scheduledEvents: {},
      playerPortraits: {},
    },
    competition: {
      season: {
        id: seasonId,
        year: 2026,
        phase: "preseason",
        offseasonStage: "none",
        regularSeasonStartDate: null,
        tradeDeadlineDate: null,
        rfaQualificationComplete: false,
        offseasonStageEnteredDate: null,
        freeAgencyExtendedUntil: null,
      },
      phase: {
        activePhaseId: "preseason.preparation",
        enteredDate: "2026-10-01",
      },
      schedule: {
        seasonId,
        gameIds: [],
      },
      games: {},
      playByPlay: {},
      aiTradeSearch: { byTeamId: {} },
      standings,
      playoffs: createEmptyPlayoffTournament(),
      developmentLeague: {
        schedule: { seasonId, gameIds: [], gameIdsByDate: {} },
        games: {},
        standings: { byTeamId: {} },
      },
      seasonEventLog: [],
      seasonEvents: createEmptySeasonEventsState(),
    },
    business: {
      contracts: {},
      finances,
      freeAgency: {
        offers: {},
      },
      rfaStatuses: {},
      deadMoney: {},
      extensionTalks: {},
      payrollAssessments: {},
      playerMorale: {},
      tradeBlocks: {},
      ...createPhaseEBusinessDefaults(
        generated.teams.map((team) => team.id as TeamId),
      ),
    },
    user: {
      ownedTeamIds: [controlledTeamId],
      activeOwnerTeamId: controlledTeamId,
      ownedFranchises: {
        [controlledTeamId]: createDefaultOwnedFranchiseState({
          seasonYear: 2026,
          currentDate: "2026-10-01",
          citySelectionConfirmed: true,
          franchiseIdentityConfirmed: true,
        }),
      },
      mode: "owner",
      pendingOwnerDecisions: [],
      ownerDecisionHistory: [],
      participation: { mode: "single" },
      pendingDraftClassDecisions: {},
      franchisePhaseState: {
        [controlledTeamId]: { dismissed: [] },
      },
    },
  };

  return { state, rng };
}

describe("playoffs season integration", () => {
  it("runs regular season → playoffs → champion for an 8-team league", () => {
    resetDomainEventSequenceForTests();
    const { state, rng } = createEightTeamGameState(TEST_RNG_SEED);
    expect(Object.keys(state.world.teams)).toHaveLength(8);
    expect(getPlayoffTeamCount(8)).toBe(8);

    const result = simulateSeason(state, rng);
    const playoffs = result.state.competition.playoffs;

    expect(result.state.competition.season.phase).toBe("playoffs");
    expect(playoffs.status).toBe("complete");
    expect(playoffs.fieldSize).toBe(8);
    expect(playoffs.qualifiedTeams).toHaveLength(8);
    expect(playoffs.series).toHaveLength(7);
    expect(
      playoffs.series.every((series) => series.status === "complete"),
    ).toBe(true);
    expect(playoffs.championTeamId).toBeDefined();

    const final = playoffs.series.find(
      (series) => series.round === 2 && series.slot === 0,
    )!;
    expect(final.winnerTeamId).toBe(playoffs.championTeamId);
    expect(final.wins[final.winnerTeamId!]).toBe(SERIES_WINS_TO_CLINCH);

    // Two conferences: four qualifiers each, kept apart until the Finals.
    const conferenceOf = (teamId: string | null) =>
      result.state.world.teams[teamId!]!.conferenceId;
    for (const series of playoffs.series) {
      const sameConference =
        conferenceOf(series.higherSeedTeamId) ===
        conferenceOf(series.lowerSeedTeamId);
      expect(sameConference).toBe(series.round < 2);
    }

    for (const series of playoffs.series) {
      expect(series.gameIds.length).toBeGreaterThanOrEqual(4);
      expect(series.gameIds.length).toBeLessThanOrEqual(7);
      expect(series.winnerTeamId).toBeDefined();
      const loserId = Object.keys(series.wins).find(
        (teamId) => teamId !== series.winnerTeamId,
      )!;
      expect(series.wins[series.winnerTeamId!]!).toBe(SERIES_WINS_TO_CLINCH);
      expect(series.wins[loserId]!).toBeLessThan(SERIES_WINS_TO_CLINCH);

      for (const gameId of series.gameIds) {
        const game = result.state.competition.games[gameId];
        expect(game?.status).toBe("final");
        expect(result.state.competition.schedule.gameIds).not.toContain(gameId);
      }
    }

    const standingsBeforeRebuild = structuredClone(
      result.state.competition.standings.byTeamId,
    );
    const rebuilt = updateStandings(result.state).state;
    expect(rebuilt.competition.standings.byTeamId).toEqual(
      standingsBeforeRebuild,
    );
  });

  it("runs a 12-team conference bracket with byes to a champion", () => {
    resetDomainEventSequenceForTests();
    const { state, rng } = createEightTeamGameState(TEST_RNG_SEED, {
      teamsPerDivision: 3,
      playoffTeams: 12,
    });
    const result = simulateSeason(state, rng);
    const playoffs = result.state.competition.playoffs;
    const conferenceOf = (teamId: string) =>
      result.state.world.teams[teamId]!.conferenceId;

    expect(playoffs.status).toBe("complete");
    expect(playoffs.series).toHaveLength(11);
    expect(playoffs.series.every((s) => s.status === "complete")).toBe(true);

    // Conference #1 and #2 seeds skip round 0 and enter in round 1.
    const byes = playoffs.series.filter((s) => s.byeParticipant);
    expect(byes).toHaveLength(4);
    for (const series of byes) {
      expect(series.round).toBe(1);
      const byeTeam = series.byeParticipant!.teamId;
      expect([series.higherSeedTeamId, series.lowerSeedTeamId]).toContain(
        byeTeam,
      );
      expect(
        playoffs.series.some(
          (s) =>
            s.round === 0 &&
            (s.higherSeedTeamId === byeTeam || s.lowerSeedTeamId === byeTeam),
        ),
      ).toBe(false);
    }

    for (const series of playoffs.series) {
      const sameConference =
        conferenceOf(series.higherSeedTeamId!) ===
        conferenceOf(series.lowerSeedTeamId!);
      expect(sameConference).toBe(series.round < 3);
    }
    const final = playoffs.series.find((s) => s.round === 3 && s.slot === 0)!;
    expect(final.winnerTeamId).toBe(playoffs.championTeamId);
  });

  it("is deterministic for the same 8-team seed", () => {
    resetDomainEventSequenceForTests();
    const first = createEightTeamGameState(77);
    const second = createEightTeamGameState(77);

    const resultA = simulateSeason(first.state, first.rng);
    resetDomainEventSequenceForTests();
    const resultB = simulateSeason(second.state, second.rng);

    expect(resultA.state.competition.playoffs.championTeamId).toBe(
      resultB.state.competition.playoffs.championTeamId,
    );
    expect(
      resultA.state.competition.playoffs.series.map((series) => ({
        id: series.id,
        winnerTeamId: series.winnerTeamId,
        gameIds: series.gameIds,
        wins: series.wins,
      })),
    ).toEqual(
      resultB.state.competition.playoffs.series.map((series) => ({
        id: series.id,
        winnerTeamId: series.winnerTeamId,
        gameIds: series.gameIds,
        wins: series.wins,
      })),
    );
  });

  it("records play-by-play for every owner playoff game and no other", () => {
    resetDomainEventSequenceForTests();
    const { state, rng } = createEightTeamGameState(TEST_RNG_SEED);
    const playoffTeams = state.settings.playoffs.playoffTeams;
    // playoffTeams = 0 makes simulateSeason stop after the regular season.
    const regular = simulateSeason(
      {
        ...state,
        settings: {
          ...state.settings,
          playoffs: { ...state.settings.playoffs, playoffTeams: 0 },
        },
      },
      rng,
    ).state;
    let current: GameState = {
      ...regular,
      settings: {
        ...regular.settings,
        playoffs: { ...regular.settings.playoffs, playoffTeams },
      },
    };
    const logsBeforePlayoffs = Object.keys(
      current.competition.playByPlay,
    ).length;
    current = startPlayoffs(current, rng).state;
    const owner = current.competition.playoffs.qualifiedTeams[0]!.teamId;

    let guard = 0;
    while (current.competition.playoffs.status !== "complete" && guard < 200) {
      guard += 1;
      current = simulateNextPlayoffGame(current, rng, {
        ownerTeamId: owner,
      }).state;
    }
    expect(current.competition.playoffs.status).toBe("complete");

    const playoffGames = current.competition.playoffs.series.flatMap(
      (series) => series.gameIds,
    );
    const ownerGames = playoffGames.filter((gameId) => {
      const game = current.competition.games[gameId]!;
      return game.homeTeamId === owner || game.awayTeamId === owner;
    });
    expect(ownerGames.length).toBeGreaterThanOrEqual(4);
    const logged = Object.keys(current.competition.playByPlay).filter(
      (gameId) => (playoffGames as string[]).includes(gameId),
    );
    expect(logged.sort()).toEqual([...ownerGames].sort());
    expect(Object.keys(current.competition.playByPlay)).toHaveLength(
      logsBeforePlayoffs + ownerGames.length,
    );
  });

  describe("simulatePlayoffDay", () => {
    function playoffsStarted(): {
      state: GameState;
      rng: ReturnType<typeof createSeededRng>;
    } {
      resetDomainEventSequenceForTests();
      const { state, rng } = createEightTeamGameState(TEST_RNG_SEED);
      const playoffTeams = state.settings.playoffs.playoffTeams;
      const regular = simulateSeason(
        {
          ...state,
          settings: {
            ...state.settings,
            playoffs: { ...state.settings.playoffs, playoffTeams: 0 },
          },
        },
        rng,
      ).state;
      const restored: GameState = {
        ...regular,
        settings: {
          ...regular.settings,
          playoffs: { ...regular.settings.playoffs, playoffTeams },
        },
      };
      return { state: startPlayoffs(restored, rng).state, rng };
    }

    function nextDay(state: GameState): GameState {
      return {
        ...state,
        world: {
          ...state.world,
          calendar: {
            ...state.world.calendar,
            currentDate: addCalendarDays(state.world.calendar.currentDate, 1),
          },
        },
      };
    }

    it("plays one game per active series, dated today", () => {
      const { state, rng } = playoffsStarted();
      const today = state.world.calendar.currentDate;
      const active = state.competition.playoffs.series.filter(
        (series) => series.status === "active",
      );
      expect(active.length).toBeGreaterThan(1);

      const result = simulatePlayoffDay(state, rng);
      const completed = result.events.filter(
        (event) => event.type === "GameCompleted",
      );
      expect(completed).toHaveLength(active.length);
      for (const series of result.state.competition.playoffs.series) {
        if (!active.some((a) => a.id === series.id)) continue;
        expect(series.gameIds).toHaveLength(1);
        const game = result.state.competition.games[series.gameIds[0]!]!;
        expect(game.date).toBe(today);
        expect(game.status).toBe("final");
      }

      // Same date again: nothing more to play today.
      const again = simulatePlayoffDay(result.state, rng);
      expect(again.events).toHaveLength(0);
      expect(again.state).toBe(result.state);
    });

    it("finishes within a series length per round and never doubles up a team", () => {
      const started = playoffsStarted();
      let state = started.state;
      const rng = started.rng;
      const startDate = state.world.calendar.currentDate;
      // Rounds are zero-based.
      const rounds =
        Math.max(
          ...state.competition.playoffs.series.map((series) => series.round),
        ) + 1;
      const seriesLength = state.settings.playoffs.seriesLength;

      let days = 0;
      while (state.competition.playoffs.status !== "complete" && days < 100) {
        state = nextDay(simulatePlayoffDay(state, rng).state);
        days += 1;
      }
      expect(state.competition.playoffs.status).toBe("complete");
      expect(days).toBeLessThanOrEqual(rounds * seriesLength);

      const teamDates = new Set<string>();
      for (const series of state.competition.playoffs.series) {
        for (const gameId of series.gameIds) {
          const game = state.competition.games[gameId]!;
          expect(game.date >= startDate).toBe(true);
          for (const teamId of [game.homeTeamId, game.awayTeamId]) {
            const key = `${teamId}:${game.date}`;
            expect(teamDates.has(key)).toBe(false);
            teamDates.add(key);
          }
        }
      }
    });

    it("waits a day when a playoff game is already dated today (play-in)", () => {
      const { state, rng } = playoffsStarted();
      const today = state.world.calendar.currentDate;
      const someGame = Object.values(state.competition.games)[0]!;
      const withPlayIn: GameState = {
        ...state,
        competition: {
          ...state.competition,
          games: {
            ...state.competition.games,
            [someGame.id]: {
              ...someGame,
              competitionType: "playoffs",
              date: today,
            },
          },
        },
      };
      expect(simulatePlayoffDay(withPlayIn, rng).events).toHaveLength(0);
    });
  });

  it("runs 4-team seasons through playoffs to a champion", () => {
    resetDomainEventSequenceForTests();
    const base = createFourTeamInitialGameState({
      saveId: "save_four_team_playoffs",
      rngSeed: 55,
      nowIso: TEST_NOW_ISO,
    });
    const rng = createSeededRng(base.meta.rngState);
    const rostered = generateRosters(base, rng).state;
    expect(Object.keys(rostered.world.teams)).toHaveLength(4);

    const result = simulateSeason(rostered, rng);
    expect(result.state.competition.season.phase).toBe("playoffs");
    expect(result.state.competition.playoffs.status).toBe("complete");
    expect(result.state.competition.playoffs.fieldSize).toBe(4);
    expect(result.state.competition.playoffs.championTeamId).toBeDefined();
  });
});
