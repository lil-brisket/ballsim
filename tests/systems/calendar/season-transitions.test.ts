import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { projectCalendarEvents, getCalendarMonthGrid } from "@/systems/calendar";
import { parseCalendarDate } from "@/domain/calendar-date";
import { getLeagueMilestones } from "@/systems/league-rules/calendar-events";
import { getCalendarContext } from "@/systems/simulation/calendar-context";

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

describe("calendar season transitions", () => {
  it("exposes trade deadline as a scheduled milestone during regular season", () => {
    const { state } = bootRegular("cal_deadline", 41);
    const milestones = getLeagueMilestones(state);
    const deadline = milestones.find((m) => m.key === "tradeDeadline");
    expect(deadline).toBeDefined();

    if (deadline?.date) {
      const events = projectCalendarEvents(state, {
        from: deadline.date,
        to: deadline.date,
        filter: "deadline",
      });
      expect(
        events.some(
          (e) =>
            e.source.type === "milestone" && e.source.key === "tradeDeadline",
        ),
      ).toBe(true);
    }
  });

  it("keeps month grid stable across a multi-day advance within the same month", () => {
    const { state, rng } = bootRegular("cal_month_stable", 42);
    const before = parseCalendarDate(state.world.calendar.currentDate);
    const gridBefore = getCalendarMonthGrid(state, before.year, before.month);

    const advanced = advanceSimulation(state, rng, { days: 5 }).state;
    const after = parseCalendarDate(advanced.world.calendar.currentDate);

    if (after.year === before.year && after.month === before.month) {
      const gridAfter = getCalendarMonthGrid(
        advanced,
        after.year,
        after.month,
      );
      expect(gridAfter.weeks.length).toBe(gridBefore.weeks.length);
      const todayAfter = gridAfter.weeks.flat().filter((c) => c.isToday);
      expect(todayAfter).toHaveLength(1);
      expect(todayAfter[0]?.date).toBe(advanced.world.calendar.currentDate);
    }
  });

  it("calendar context remains readable after several days of simulation", () => {
    const { state, rng } = bootRegular("cal_context", 43);
    const advanced = advanceSimulation(state, rng, { days: 10 }).state;
    const ctx = getCalendarContext(advanced);
    expect(ctx.lifecyclePhase).toBeTruthy();
    expect(ctx.displayLabel.length).toBeGreaterThan(0);
  });

  it("year/month boundary: grid for adjacent month has no isToday when viewing other month", () => {
    const { state } = bootRegular("cal_adj_month", 44);
    const { year, month } = parseCalendarDate(
      state.world.calendar.currentDate,
    );
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const grid = getCalendarMonthGrid(state, nextYear, nextMonth);
    const todays = grid.weeks.flat().filter((c) => c.isToday && c.inMonth);
    expect(todays).toHaveLength(0);
  });
});
