import { describe, expect, it } from "vitest";
import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { asSaveId, asSeasonId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createFourTeamInitialGameState } from "@/state/create-initial-state";
import {
  GAME_STATE_SCHEMA_VERSION,
  type GameState,
} from "@/state/game-state";
import { generateLeague } from "@/systems/league-generation";
import { generateRosters } from "@/systems/roster-generation";
import {
  getPlayoffTeamCount,
  SERIES_WINS_TO_CLINCH,
} from "@/systems/playoff-config";
import { simulateSeason } from "@/systems/season-simulation";
import { updateStandings } from "@/systems/standings";
import { createPhaseEBusinessDefaults } from "@/state/phase-e-defaults";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

function createEightTeamGameState(rngSeed: number): {
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
      teamsPerDivision: 2,
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
      { teamId: team.id, cash: 50_000_000, payroll: 0, booksByYear: {}, booksByMonth: {}, cashLedgerByMonth: {} },
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
        teamCount: 8,
        conferenceCount: 2,
        divisionsEnabled: true,
      },
      regularSeason: { gamesPerTeam: 14 },
      playoffs: {
        playoffTeams: 8,
        seriesLength: 7,
        playInEnabled: false,
      },
      simulation: { frequency: "daily" },
      ai: { difficulty: "normal" },
      financialRules: {
        salaryCapEnabled: true,
        luxuryTaxEnabled: true,
        revenueSharingEnabled: true,
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
      players,
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
      schedule: {
        seasonId,
        gameIds: [],
      },
      games: {},
      standings,
      playoffs: createEmptyPlayoffTournament(),
    },
    business: {
      contracts: {},
      finances,
      freeAgency: {
        offers: {},
      },
      tradeBlocks: {},
      ...createPhaseEBusinessDefaults(
        generated.teams.map((team) => team.id as TeamId),
      ),
    },
    user: {
      controlledTeamId,
      mode: "owner",
      ownerPhilosophy: "balanced",
      ownerPatience: 55,
      objectives: [],
      notifications: [],
      eventLog: [],
      appliedGameplayConsequenceKeys: {},
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
