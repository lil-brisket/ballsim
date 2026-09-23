import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import { advanceOwnerTime, loadCalendarPageView } from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { getActivePhaseId } from "@/systems/phase-engine";
import {
  derivePlannedPreseasonStartDate,
  derivePlannedRegularSeasonStartDate,
} from "@/systems/simulation/season-lifecycle";
import { FIXTURE_PRESEASON_START, FIXTURE_SEASON_START } from "../fixtures/dates";

/**
 * End-to-end contract for calendar visibility + two-simulation opener.
 */
describe("calendar preseason → opener progression", () => {
  it("shows preseason and opponent before any sim, then two advances play opener", async () => {
    resetDomainEventSequenceForTests();
    const store = createMemorySaveGameStore();
    let state = createInitialGameState({
      saveId: "cal_progression",
      rngSeed: 88,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = {
      ...state,
      meta: { ...state.meta, rngState: rng.getState() },
    };
    await store.create({
      id: "cal_progression",
      name: "cal_progression",
      state,
    });

    // --- Fresh save (preseason start) ---
    const fresh = await loadCalendarPageView("cal_progression", {}, store);
    expect(fresh).not.toBeNull();
    expect(fresh!.seasonInitializationRequired).toBe(true);
    expect(fresh!.openingDayPending).toBe(false);
    expect(getActivePhaseId(state)).toBe("preseason.preparation");
    expect(state.competition.season.phase).toBe("preseason");
    expect(state.world.calendar.currentDate).toBe(FIXTURE_PRESEASON_START);

    const plannedPreseason = derivePlannedPreseasonStartDate(state);
    const opener = derivePlannedRegularSeasonStartDate(state);
    expect(plannedPreseason).toBe(FIXTURE_PRESEASON_START);
    expect(opener).toBe(FIXTURE_SEASON_START);
    expect(fresh!.month).toBe(9);
    expect(fresh!.selectedDate).toBe(FIXTURE_PRESEASON_START);

    const preseasonCell = fresh!.monthGrid.weeks
      .flat()
      .find((cell) => cell.date === plannedPreseason);
    expect(preseasonCell).toBeDefined();
    expect(
      preseasonCell!.leagueMilestones.some((m) => m.key === "preseasonStart"),
    ).toBe(true);

    // Next game is the first preseason exhibition (before the October opener).
    expect(fresh!.nextTeamGameDate).toBe(plannedPreseason);
    const octoberGrid = await loadCalendarPageView(
      "cal_progression",
      { year: 2026, month: 10 },
      store,
    );
    const openerCell = octoberGrid!.monthGrid.weeks
      .flat()
      .find((cell) => cell.date === opener);
    expect(openerCell?.teamGame).not.toBeNull();
    expect(
      Object.values(state.competition.games).every((g) => g.status === "scheduled"),
    ).toBe(true);

    // Stand on opening night so the next advance opens regular season.
    const loaded = await store.load("cal_progression");
    await store.save({
      ...loaded!,
      state: {
        ...loaded!.state,
        world: {
          ...loaded!.state.world,
          calendar: {
            ...loaded!.state.world.calendar,
            currentDate: opener!,
          },
        },
      },
    });

    // --- Simulate #1: phase → regular, no games played ---
    const first = await advanceOwnerTime("cal_progression", { days: 1 }, store);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect(first.simulation.phaseChanged).toBe(true);
    expect(first.simulation.gamesSimulated).toBe(0);
    expect(first.dashboard.seasonPhase).toBe("regular");

    const afterFirst = await store.load("cal_progression");
    expect(afterFirst!.state.competition.season.phase).toBe("regular");
    expect(afterFirst!.state.world.calendar.currentDate).toBe(opener);
    const openersAfterFirst = Object.values(afterFirst!.state.competition.games).filter(
      (g) =>
        g.competitionType === "regular_season" &&
        g.date === opener,
    );
    expect(openersAfterFirst.length).toBeGreaterThan(0);
    expect(openersAfterFirst.every((g) => g.status === "scheduled")).toBe(true);

    const mid = await loadCalendarPageView("cal_progression", {}, store);
    expect(mid!.seasonInitializationRequired).toBe(false);
    expect(mid!.openingDayPending).toBe(true);

    // --- Simulate #2: opener played ---
    const second = await advanceOwnerTime("cal_progression", { days: 1 }, store);
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.simulation.gamesSimulated).toBeGreaterThan(0);

    const afterSecond = await store.load("cal_progression");
    const openersAfterSecond = Object.values(
      afterSecond!.state.competition.games,
    ).filter(
      (g) => g.competitionType === "regular_season" && g.date === opener,
    );
    expect(openersAfterSecond.every((g) => g.status === "final")).toBe(true);

    const done = await loadCalendarPageView(
      "cal_progression",
      { year: 2026, month: 10, selectedDate: opener! },
      store,
    );
    expect(done!.openingDayPending).toBe(false);
    expect(done!.seasonInitializationRequired).toBe(false);
    const resultCell = done!.monthGrid.weeks
      .flat()
      .find((cell) => cell.date === opener);
    expect(resultCell?.teamGame?.resultLabel).toMatch(/^[WLT] /);
  });
});
