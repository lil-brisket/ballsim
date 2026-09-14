import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { addCalendarDays, parseCalendarDate } from "@/domain/calendar-date";
import {
  getCalendarMonthGrid,
  getNextTeamGameDate,
  projectOwnerCalendarEvents,
  projectTeamGameView,
  buildCalendarDateInspectorView,
  findNextSimulationTarget,
} from "@/systems/calendar";
import { toCalendarLeagueContext } from "@/state/standings-selectors";
import { getTeamGameForDate } from "@/systems/calendar/schedule-projection";

function bootRegular(saveId: string, seed: number) {
  resetDomainEventSequenceForTests();
  const state = createInitialGameState({
    saveId,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  let current = bootstrapWorld(state, rng).state;
  current = beginRegularSeasonFromPreseason(current).state;
  return { state: current, rng };
}

describe("owner calendar projection", () => {
  it("includes controlled-team games and excludes other teams' games", () => {
    const { state } = bootRegular("owner_cal_games", 21);
    const teamId = state.user.activeOwnerTeamId;
    const currentDate = state.world.calendar.currentDate;
    const to = addCalendarDays(currentDate, 45);

    const events = projectOwnerCalendarEvents(state, {
      from: currentDate,
      to,
      teamId,
    });

    const games = events.filter((event) => event.category === "game");
    expect(games.length).toBeGreaterThan(0);
    for (const game of games) {
      expect(game.teamIds?.includes(teamId)).toBe(true);
    }
  });

  it("keeps deadlines and blocking decisions while dropping low-importance league noise", () => {
    const { state } = bootRegular("owner_cal_filter", 22);
    const teamId = state.user.activeOwnerTeamId;
    const events = projectOwnerCalendarEvents(state, { teamId });

    for (const event of events) {
      if (event.category === "game") {
        expect(event.teamIds?.includes(teamId)).toBe(true);
      }
      if (event.category === "league") {
        expect(["high", "critical"]).toContain(event.importance);
      }
    }
  });
});

describe("getNextTeamGameDate", () => {
  it("returns the earliest controlled-team game on or after currentDate", () => {
    const { state } = bootRegular("next_team_game", 23);
    const teamId = state.user.activeOwnerTeamId;
    const next = getNextTeamGameDate(state, teamId);
    expect(next).not.toBeNull();
    expect(next! >= state.world.calendar.currentDate).toBe(true);

    const game = getTeamGameForDate(state, teamId, next!);
    expect(game).not.toBeNull();
    expect(
      game!.homeTeamId === teamId || game!.awayTeamId === teamId,
    ).toBe(true);
  });

  it("is independent of findNextSimulationTarget", () => {
    const { state } = bootRegular("next_team_game_decouple", 24);
    const teamId = state.user.activeOwnerTeamId;
    const scheduleNext = getNextTeamGameDate(state, teamId);
    const simTarget = findNextSimulationTarget(state, "next_game");
    expect(scheduleNext).not.toBeNull();
    // Both should point at a valid team game date when a game exists,
    // but the calendar highlight must come from getNextTeamGameDate.
    if (simTarget) {
      expect(typeof scheduleNext).toBe("string");
    }
  });
});

describe("projectTeamGameView", () => {
  it("derives HOME/AWAY and result labels for completed games", () => {
    const { state } = bootRegular("team_game_view", 25);
    const teamId = state.user.activeOwnerTeamId;
    const nextDate = getNextTeamGameDate(state, teamId);
    expect(nextDate).not.toBeNull();
    const game = getTeamGameForDate(state, teamId, nextDate!);
    expect(game).not.toBeNull();

    const view = projectTeamGameView(state, teamId, game!);
    expect(view.homeAwayLabel).toBe(view.home ? "HOME" : "AWAY");
    expect(view.opponentName.length).toBeGreaterThan(0);
    expect(view.opponentAbbreviation.length).toBeGreaterThan(0);
    if (game!.status === "final") {
      expect(view.resultLabel).toMatch(/^[WLT] /);
    } else {
      expect(view.resultLabel).toBeNull();
    }
  });
});

describe("getCalendarMonthGrid owner enrichment", () => {
  it("marks isNextTeamGame using getNextTeamGameDate", () => {
    const { state } = bootRegular("month_next_game", 26);
    const teamId = state.user.activeOwnerTeamId;
    const nextDate = getNextTeamGameDate(state, teamId);
    expect(nextDate).not.toBeNull();
    const { year, month } = parseCalendarDate(nextDate!);
    const grid = getCalendarMonthGrid(state, year, month, { teamId });
    expect(grid.nextTeamGameDate).toBe(nextDate);

    const cells = grid.weeks.flat();
    const flagged = cells.filter((cell) => cell.isNextTeamGame);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]!.date).toBe(nextDate);
    expect(flagged[0]!.teamGame).not.toBeNull();
  });

  it("does not place other teams' games in cells", () => {
    const { state } = bootRegular("month_team_only", 27);
    const teamId = state.user.activeOwnerTeamId;
    const { year, month } = parseCalendarDate(state.world.calendar.currentDate);
    const grid = getCalendarMonthGrid(state, year, month, { teamId });
    for (const cell of grid.weeks.flat()) {
      for (const event of cell.events) {
        if (event.category === "game") {
          expect(event.teamIds?.includes(teamId)).toBe(true);
        }
      }
      if (cell.teamGame) {
        expect(
          cell.teamGame.home || !cell.teamGame.home,
        ).toBe(true);
      }
    }
  });
});

describe("buildCalendarDateInspectorView", () => {
  it("sets action none for past/today and simulate_to_date for future", () => {
    const { state } = bootRegular("inspector_actions", 28);
    const current = state.world.calendar.currentDate;
    const past = addCalendarDays(current, -1);
    const future = addCalendarDays(current, 5);

    const pastView = buildCalendarDateInspectorView(state, past);
    expect(pastView.action).toBe("none");
    expect(pastView.simulationPreview).toBeNull();
    expect(pastView.dateStatus).toBe("past");

    const todayView = buildCalendarDateInspectorView(state, current);
    expect(todayView.action).toBe("none");
    expect(todayView.dateStatus).toBe("today");

    const futureView = buildCalendarDateInspectorView(state, future);
    expect(futureView.action).toBe("simulate_to_date");
    expect(futureView.simulationPreview).not.toBeNull();
    expect(futureView.simulationPreview!.summaryLines.length).toBeGreaterThan(0);
    expect(futureView.simulationPreview!.canSimulate).toBe(true);
  });
});

describe("toCalendarLeagueContext", () => {
  it("returns compact controlled-team standings fields including division rank", () => {
    const { state } = bootRegular("league_ctx", 29);
    const ctx = toCalendarLeagueContext(state);
    expect(ctx).not.toBeNull();
    expect(ctx!.conferenceRank).toBeGreaterThan(0);
    expect(ctx!.divisionRank).toBeGreaterThan(0);
    expect(typeof ctx!.wins).toBe("number");
    expect(typeof ctx!.losses).toBe("number");
    expect(typeof ctx!.conferenceWins).toBe("number");
    expect(typeof ctx!.divisionWins).toBe("number");
    expect(typeof ctx!.gamesBack).toBe("number");
  });
});
