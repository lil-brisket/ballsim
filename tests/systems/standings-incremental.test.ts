import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import {
  rebuildStandings,
  updateStandingsIncremental,
} from "@/systems/standings";
import { buildGameIdsByDate } from "@/systems/schedule-date-index";

describe("incremental standings parity", () => {
  it("matches rebuildStandings after applying newly finalized games", () => {
    let state = createInitialGameState({
      saveId: "standings_parity",
      rngSeed: 7,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = beginRegularSeasonFromPreseason(state).state;

    // Advance one day: openers simulated
    const advanced = advanceSimulation(state, rng, { days: 1 });
    state = advanced.state;
    expect(advanced.gamesSimulated).toBeGreaterThan(0);

    const newlyFinalized = Object.values(state.competition.games).filter(
      (game) => game.status === "final",
    );
    expect(newlyFinalized.length).toBeGreaterThan(0);

    // Reset standings to empty rows, then apply incrementally
    const byTeamId: Record<string, ReturnType<typeof createEmptyTeamStanding>> =
      {};
    for (const team of Object.values(state.world.teams)) {
      byTeamId[team.id] = createEmptyTeamStanding(team.id);
    }
    const withEmptyStandings = {
      ...state,
      competition: {
        ...state.competition,
        standings: { byTeamId },
      },
    };

    // Apply in schedule order
    const ordered = state.competition.schedule.gameIds
      .map((id) => newlyFinalized.find((game) => game.id === id))
      .filter((game): game is NonNullable<typeof game> => game != null);

    const incremental = updateStandingsIncremental(
      withEmptyStandings,
      ordered,
    ).state;
    const rebuilt = rebuildStandings(state).state;

    expect(incremental.competition.standings.byTeamId).toEqual(
      rebuilt.competition.standings.byTeamId,
    );
  });
});

describe("schedule date index", () => {
  it("indexes games by date in schedule order", () => {
    const home = asTeamId("t1");
    const away = asTeamId("t2");
    const g1 = createGame({
      id: asGameId("g1"),
      seasonId: asSeasonId("s1"),
      date: "2026-10-01",
      homeTeamId: home,
      awayTeamId: away,
      competitionType: "regular_season",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    const g2 = createGame({
      id: asGameId("g2"),
      seasonId: asSeasonId("s1"),
      date: "2026-10-01",
      homeTeamId: away,
      awayTeamId: home,
      competitionType: "regular_season",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    const g3 = createGame({
      id: asGameId("g3"),
      seasonId: asSeasonId("s1"),
      date: "2026-10-02",
      homeTeamId: home,
      awayTeamId: away,
      competitionType: "regular_season",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    const byDate = buildGameIdsByDate(
      { g1, g2, g3 },
      [g1.id, g2.id, g3.id],
    );
    expect(byDate["2026-10-01"]).toEqual([g1.id, g2.id]);
    expect(byDate["2026-10-02"]).toEqual([g3.id]);
  });
});
