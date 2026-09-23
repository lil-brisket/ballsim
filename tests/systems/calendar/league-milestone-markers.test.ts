import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  beginRegularSeasonFromPreseason,
  derivePlannedPreseasonStartDate,
  derivePlannedRegularSeasonStartDate,
} from "@/systems/simulation/season-lifecycle";
import { generateSchedule } from "@/systems/schedule-generation";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { addCalendarDays, parseCalendarDate } from "@/domain/calendar-date";
import {
  getCalendarMonthGrid,
  getLeagueMilestoneMarkersForRange,
  indexLeagueMilestoneMarkersByDate,
} from "@/systems/calendar";
import { getLeagueMilestones } from "@/systems/league-rules/calendar-events";
import { resolveSeasonAnchors } from "@/systems/league-rules/league-calendar";
import { PRESEASON_LENGTH_DAYS } from "@/systems/simulation/offseason-calendar-config";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";

function bootPreseason(saveId: string, seed: number) {
  resetDomainEventSequenceForTests();
  const state = createInitialGameState({
    saveId,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

function bootRegular(saveId: string, seed: number) {
  let current = bootPreseason(saveId, seed);
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

  it("shows planned preseason and opener on a fresh save before schedule exists", () => {
    const state = bootPreseason("milestone_preseason", 53);
    // Strip any schedule materialization from bootstrap for this unit case.
    const noSchedule = {
      ...state,
      competition: {
        ...state.competition,
        schedule: { ...state.competition.schedule, gameIds: [], gameIdsByDate: {} },
        games: {},
      },
    };

    const plannedOpener = derivePlannedRegularSeasonStartDate(noSchedule);
    const plannedPreseason = derivePlannedPreseasonStartDate(noSchedule);
    expect(plannedPreseason).toBe(noSchedule.world.calendar.currentDate);
    expect(plannedOpener).toBe(
      addCalendarDays(plannedPreseason!, PRESEASON_LENGTH_DAYS),
    );
    expect(plannedOpener).toBe("2026-10-01");

    const milestones = getLeagueMilestones(noSchedule);
    const seasonStart = milestones.find((m) => m.key === "regularSeasonStart");
    const preseason = milestones.find((m) => m.key === "preseasonStart");

    expect(seasonStart?.date).toBe(plannedOpener);
    expect(preseason?.date).toBe(plannedPreseason);

    const anchors = resolveSeasonAnchors(noSchedule);
    expect(anchors.regularSeasonStart).toBe(plannedOpener);
    expect(anchors.preseasonStart).toBe(plannedPreseason);
  });

  it("keeps planned dates when schedule is generated but still in preseason", () => {
    let state = bootPreseason("milestone_sched_pre", 54);
    state = generateSchedule(state).state;
    expect(state.competition.season.phase).toBe("preseason");
    expect(state.competition.schedule.gameIds.length).toBeGreaterThan(0);

    const plannedOpener = derivePlannedRegularSeasonStartDate(state);
    const milestones = getLeagueMilestones(state);
    const seasonStart = milestones.find((m) => m.key === "regularSeasonStart");
    const preseason = milestones.find((m) => m.key === "preseasonStart");

    expect(seasonStart?.date).toBe(plannedOpener);
    expect(preseason?.date).toBe(
      addCalendarDays(plannedOpener!, -PRESEASON_LENGTH_DAYS),
    );
  });

  it("uses committed anchors after regular season initialization", () => {
    const state = bootRegular("milestone_regular", 55);
    expect(state.competition.season.phase).toBe("regular");
    expect(state.competition.season.regularSeasonStartDate).toBeTruthy();
    expect(derivePlannedPreseasonStartDate(state)).toBeNull();

    const milestones = getLeagueMilestones(state);
    const seasonStart = milestones.find((m) => m.key === "regularSeasonStart");
    const preseason = milestones.find((m) => m.key === "preseasonStart");
    const anchors = resolveSeasonAnchors(state);

    expect(seasonStart?.date).toBe(
      state.competition.season.regularSeasonStartDate,
    );
    expect(preseason?.date).toBe(anchors.preseasonStart);
    expect(preseason?.date).toBe(
      addCalendarDays(
        state.competition.season.regularSeasonStartDate!,
        -PRESEASON_LENGTH_DAYS,
      ),
    );
  });

  it("does not drift preseason markers after the season progresses", () => {
    let state = bootRegular("milestone_progressed", 56);
    const committedOpener = state.competition.season.regularSeasonStartDate!;
    const committedPreseason = addCalendarDays(
      committedOpener,
      -PRESEASON_LENGTH_DAYS,
    );

    const rng = createSeededRng(state.meta.rngState);
    // Play opener day so we leave opening night.
    state = advanceSimulation(state, rng, { days: 1 }).state;
    expect(state.world.calendar.currentDate > committedOpener).toBe(true);

    const milestones = getLeagueMilestones(state);
    const seasonStart = milestones.find((m) => m.key === "regularSeasonStart");
    const preseason = milestones.find((m) => m.key === "preseasonStart");

    expect(seasonStart?.date).toBe(committedOpener);
    expect(preseason?.date).toBe(committedPreseason);
    expect(derivePlannedPreseasonStartDate(state)).toBeNull();
  });
});
