import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { parseCalendarDate } from "@/domain/calendar-date";
import {
  getCalendarMonthGrid,
  getLeagueMilestoneMarkersForRange,
  indexLeagueMilestoneMarkersByDate,
} from "@/systems/calendar";
import { getLeagueMilestones } from "@/systems/league-rules/calendar-events";

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
  return current;
}

describe("league milestone calendar markers", () => {
  it("maps season start and playoffs onto month grid cells", () => {
    const state = bootRegular("milestone_grid", 51);
    const milestones = getLeagueMilestones(state);
    const seasonStart = milestones.find((m) => m.key === "regularSeasonStart");
    const playoffs = milestones.find((m) => m.key === "playoffsStart");

    expect(seasonStart?.date).toBeTruthy();
    expect(playoffs?.date).toBeTruthy();

    const { year, month } = parseCalendarDate(seasonStart!.date!);
    const grid = getCalendarMonthGrid(state, year, month);
    const seasonCell = grid.weeks
      .flat()
      .find((cell) => cell.date === seasonStart!.date);

    expect(seasonCell).toBeDefined();
    expect(
      seasonCell!.leagueMilestones.some((m) => m.key === "regularSeasonStart"),
    ).toBe(true);
  });

  it("indexes milestone markers by date within a range", () => {
    const state = bootRegular("milestone_index", 52);
    const currentDate = state.world.calendar.currentDate;
    const markers = getLeagueMilestoneMarkersForRange(
      state,
      currentDate,
      currentDate.slice(0, 8) + "31",
    );
    const byDate = indexLeagueMilestoneMarkersByDate(markers);

    for (const marker of markers) {
      expect(byDate.get(marker.date)?.some((m) => m.key === marker.key)).toBe(
        true,
      );
    }
  });

  it("does not invent milestone dates before the regular season begins", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "milestone_preseason",
      rngSeed: 53,
      settings: CBL_GAME_SETTINGS,
    });
    const bootstrapped = bootstrapWorld(
      state,
      createSeededRng(state.meta.rngState),
    ).state;
    const seasonStart = getLeagueMilestones(bootstrapped).find(
      (m) => m.key === "regularSeasonStart",
    );

    expect(seasonStart?.date).toBeNull();
  });
});
