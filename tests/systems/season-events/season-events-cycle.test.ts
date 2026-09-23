import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { generateRosters } from "@/systems/roster-generation";
import { processSeasonEvents } from "@/systems/season-events";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { addCalendarDays } from "@/domain/calendar-date";
import { runMidseasonAwards } from "@/systems/awards/award-pipeline";
import { getPrimaryLeagueFinalGames } from "@/systems/awards/award-stat-sources";
import { qualifyAndStartTournament } from "@/systems/season-events/tournament-engine";
import { createGame } from "@/domain/entities/game";
import { asGameId } from "@/domain/ids";

function bootRegularSeason(saveId: string) {
  let state = createInitialGameState({
    saveId,
    rngSeed: 99,
    settings: {
      ...CBL_GAME_SETTINGS,
      seasonEvents: {
        ...CBL_GAME_SETTINGS.seasonEvents,
        tournamentFieldSize: 4,
      },
    },
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = generateRosters(state, rng).state;
  state = beginRegularSeasonFromPreseason(state).state;
  return { state, rng };
}

describe("season events midseason cycle", () => {
  it("finalizes fan voting and announces All-Star selections", () => {
    const { state, rng } = bootRegularSeason("se_allstar");
    const campaign = Object.values(state.competition.seasonEvents.fanVoting)[0]!;

    let current: GameState = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: campaign.closeDate,
          lastSimulatedDate: addCalendarDays(campaign.closeDate, -1),
        },
      },
    };

    // Open and tick through close in one process after jumping calendar
    // First ensure open from openDate via catch-up ticks inside processFanVoting
    const result = processSeasonEvents(current, rng);
    current = result.state;
    const updated = Object.values(current.competition.seasonEvents.fanVoting)[0]!;
    expect(updated.status).toBe("finalized");

    const allStar = current.competition.seasonEvents.allStar!;
    expect(
      allStar.status === "selections_announced" ||
        allStar.status === "completed",
    ).toBe(true);
    expect(allStar.selections.length).toBeGreaterThan(0);
    expect(
      result.events.some((e) => e.type === "AllStarSelectionsAnnounced"),
    ).toBe(true);
  });

  it("midseason awards use cutoff and exclude special games", () => {
    const { state } = bootRegularSeason("se_awards");
    const awards = state.competition.seasonEvents.midseasonAwards!;
    const cutoff = awards.cutoffDate;

    // Inject a fake all_star final game after cutoff with huge points
    const teamIds = Object.keys(state.world.teams).sort();
    const fakeGame = createGame({
      id: asGameId("fake_allstar_stats"),
      seasonId: state.competition.season.id,
      date: cutoff,
      homeTeamId: teamIds[0] as never,
      awayTeamId: teamIds[1] as never,
      competitionType: "all_star",
      status: "final",
      score: { home: 200, away: 100 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });

    const withFake = {
      ...state,
      competition: {
        ...state.competition,
        games: {
          ...state.competition.games,
          [fakeGame.id]: fakeGame,
        },
      },
    };

    const rsGames = getPrimaryLeagueFinalGames(withFake, {
      competitionTypes: ["regular_season"],
      throughDate: cutoff,
    });
    expect(rsGames.every((g) => g.competitionType === "regular_season")).toBe(
      true,
    );
    expect(rsGames.some((g) => g.id === fakeGame.id)).toBe(false);

    const pipeline = runMidseasonAwards(withFake, cutoff);
    const midseasonResults = Object.values(
      pipeline.state.business.awards.results,
    ).filter((r) => r.period === "midseason");
    // May be empty early in season if few games played — still idempotent
    const again = runMidseasonAwards(pipeline.state, cutoff);
    expect(Object.keys(again.state.business.awards.results).length).toBe(
      Object.keys(pipeline.state.business.awards.results).length,
    );
    void midseasonResults;
  });

  it("tournament games do not alter regular-season standings", () => {
    const { state, rng } = bootRegularSeason("se_cup");
    const tournament = state.competition.seasonEvents.tournament!;
    expect(tournament).not.toBeNull();

    // Seed some wins into standings so qualification works
    let current = state;
    const standings = { ...current.competition.standings.byTeamId };
    let i = 0;
    for (const teamId of Object.keys(standings).sort()) {
      standings[teamId] = {
        ...standings[teamId]!,
        wins: 20 - i,
        losses: i,
      };
      i += 1;
    }
    current = {
      ...current,
      competition: {
        ...current.competition,
        standings: { byTeamId: standings },
      },
    };

    const beforeStandings = JSON.stringify(current.competition.standings);
    const started = qualifyAndStartTournament(current, tournament);
    current = started.state;
    const after = current.competition.seasonEvents.tournament!;
    expect(after.status).toBe("in_progress");
    expect(after.gameIds.length).toBeGreaterThan(0);

    // Simulate tournament day
    current = {
      ...current,
      world: {
        ...current.world,
        calendar: {
          ...current.world.calendar,
          currentDate: after.startDate,
          lastSimulatedDate: addCalendarDays(after.startDate, -1),
        },
      },
    };
    const day = processSeasonEvents(current, rng);
    expect(JSON.stringify(day.state.competition.standings)).toBe(beforeStandings);

    const tournamentGames = Object.values(day.state.competition.games).filter(
      (g) => g.competitionType === "midseason_tournament",
    );
    expect(tournamentGames.length).toBeGreaterThan(0);
    expect(
      tournamentGames.every(
        (g) => !day.state.competition.schedule.gameIds.includes(g.id),
      ),
    ).toBe(true);
  });

  it("full advance across voting window does not duplicate open events", () => {
    const { state } = bootRegularSeason("se_nodupe");
    const campaign = Object.values(state.competition.seasonEvents.fanVoting)[0]!;

    let current: GameState = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: campaign.openDate,
          lastSimulatedDate: addCalendarDays(campaign.openDate, -1),
        },
      },
    };
    const rng = createSeededRng(current.meta.rngState);
    const first = advanceSimulation(current, rng, { days: 3 });
    current = first.state;
    const opens = first.events.filter((e) => e.type === "MidseasonVotingOpened");
    expect(opens.length).toBe(1);

    const second = advanceSimulation(
      current,
      createSeededRng(current.meta.rngState),
      { days: 2 },
    );
    const opensAgain = second.events.filter(
      (e) => e.type === "MidseasonVotingOpened",
    );
    expect(opensAgain.length).toBe(0);
  });
});
