import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import {
  getCalendarMonthGrid,
  projectCalendarEvents,
  findNextSimulationTarget,
  summarizeSimulationRange,
} from "@/systems/calendar";
import { parseCalendarDate, addCalendarDays } from "@/domain/calendar-date";
import { getDomainEventPolicy } from "@/systems/event-registry";

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

describe("event registry", () => {
  it("defines policies for trade and injury events", () => {
    const trade = getDomainEventPolicy("PlayerTraded");
    expect(trade.calendar.show).toBe(true);
    expect(trade.calendar.lifecycle).toBe("occurred");
    expect(trade.media.generate).toBe(true);
    expect(trade.media.importance).toBe("high");

    const injury = getDomainEventPolicy("PlayerInjured");
    expect(injury.calendar.category).toBe("injury");
    expect(injury.notification.generate).toBe(true);
  });

  it("does not generate media for low-noise finance events", () => {
    const revenue = getDomainEventPolicy("RevenueRecorded");
    expect(revenue.media.generate).toBe(false);
    expect(revenue.calendar.show).toBe(false);
  });
});

describe("calendar projection lifecycle", () => {
  it("shows scheduled games on future dates without inventing occurred transactions", () => {
    const { state } = bootRegular("cal_lifecycle", 11);
    const currentDate = state.world.calendar.currentDate;
    const future = addCalendarDays(currentDate, 7);

    const events = projectCalendarEvents(state, {
      from: future,
      to: future,
    });

    for (const event of events) {
      expect(["scheduled", "action_required"]).toContain(event.lifecycle);
      expect(event.lifecycle).not.toBe("occurred");
      if (event.category === "transaction" || event.category === "injury") {
        throw new Error(
          `Future date must not show occurred ${event.category}: ${event.title}`,
        );
      }
    }

    const games = events.filter((e) => e.category === "game");
    // May or may not have games on that exact day; if present they are scheduled.
    for (const game of games) {
      expect(game.lifecycle).toBe("scheduled");
      expect(game.completed).toBe(false);
    }
  });

  it("marks completed games as occurred after simulation", () => {
    const { state, rng } = bootRegular("cal_occurred", 12);
    const simDate = state.world.calendar.currentDate;
    const advanced = advanceSimulation(state, rng, { days: 1 }).state;

    const events = projectCalendarEvents(advanced, {
      from: simDate,
      to: simDate,
      filter: "game",
    });
    const completed = events.filter((e) => e.lifecycle === "occurred");
    expect(completed.length).toBeGreaterThan(0);
    expect(completed.every((e) => e.completed)).toBe(true);
  });

  it("builds a month grid with today marked", () => {
    const { state } = bootRegular("cal_month", 13);
    const { year, month } = parseCalendarDate(state.world.calendar.currentDate);
    const grid = getCalendarMonthGrid(state, year, month);
    expect(grid.year).toBe(year);
    expect(grid.month).toBe(month);
    expect(grid.weeks.length).toBeGreaterThanOrEqual(4);

    const todayCells = grid.weeks.flat().filter((c) => c.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0]?.date).toBe(state.world.calendar.currentDate);
  });

  it("filters by category", () => {
    const { state } = bootRegular("cal_filter", 14);
    const games = projectCalendarEvents(state, { filter: "game" });
    expect(games.every((e) => e.category === "game")).toBe(true);

    const deadlines = projectCalendarEvents(state, { filter: "deadline" });
    expect(deadlines.every((e) => e.category === "deadline")).toBe(true);
  });

  it("finds next user team game target", () => {
    const { state } = bootRegular("cal_next_game", 15);
    const target = findNextSimulationTarget(state, "next_game");
    expect(target).not.toBeNull();
    expect(target!.daysUntil).toBeGreaterThanOrEqual(0);
    expect(target!.date >= state.world.calendar.currentDate).toBe(true);
  });

  it("summarizes a simulation range without going backward", () => {
    const { state } = bootRegular("cal_preview", 16);
    const target = addCalendarDays(state.world.calendar.currentDate, 5);
    const preview = summarizeSimulationRange(state, target);
    expect(preview.days).toBe(5);
    expect(preview.fromDate).toBe(state.world.calendar.currentDate);
    expect(preview.toDate).toBe(target);
    expect(preview.systemsProcessing.length).toBeGreaterThan(0);

    expect(() =>
      summarizeSimulationRange(
        state,
        addCalendarDays(state.world.calendar.currentDate, -1),
      ),
    ).toThrow(/before currentDate/);
  });
});
