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

import { loadCalendarPageView } from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { addCalendarDays } from "@/domain/calendar-date";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

async function seedPreseasonSave(id: string, seed: number) {
  resetDomainEventSequenceForTests();
  const store = createMemorySaveGameStore();
  let state = createInitialGameState({
    saveId: id,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = {
    ...state,
    meta: {
      ...state.meta,
      rngState: rng.getState(),
    },
  };
  await store.create({ id, name: id, state });
  return { store, state };
}

async function seedRegularSave(id: string, seed: number) {
  resetDomainEventSequenceForTests();
  const store = createMemorySaveGameStore();
  let state = createInitialGameState({
    saveId: id,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = beginRegularSeasonFromPreseason(state).state;
  state = {
    ...state,
    meta: {
      ...state.meta,
      rngState: rng.getState(),
    },
  };
  await store.create({ id, name: id, state });
  return { store, state };
}

describe("loadCalendarPageView consolidated shape", () => {
  it("returns inspector + leagueContext without shortcut/filter fields", async () => {
    const { store, state } = await seedRegularSave("cal_page_view", 41);
    const future = addCalendarDays(state.world.calendar.currentDate, 4);
    const view = await loadCalendarPageView(
      "cal_page_view",
      { selectedDate: future },
      store,
    );
    expect(view).not.toBeNull();
    expect(view!.inspector).toBeDefined();
    expect(view!.inspector.date).toBe(future);
    expect(view!.inspector.action).toBe("simulate_to_date");
    expect(view!.inspector.simulationPreview).not.toBeNull();
    expect(view!.leagueContext).not.toBeNull();
    expect(view!.nextTeamGameDate).not.toBeNull();
    expect(view!.monthGrid.nextTeamGameDate).toBe(view!.nextTeamGameDate);

    expect("nextTargets" in view!).toBe(false);
    expect("filter" in view!).toBe(false);
    expect("todayBriefing" in view!).toBe(false);
    expect("simulationPreview" in view!).toBe(false);
    expect("teamGameOnSelectedDate" in view!).toBe(false);
  });

  it("defaults displayed month to preseason while keeping selectedDate on currentDate", async () => {
    const { store, state } = await seedPreseasonSave("cal_preseason_month", 42);
    const view = await loadCalendarPageView("cal_preseason_month", {}, store);
    expect(view).not.toBeNull();
    expect(view!.selectedDate).toBe(state.world.calendar.currentDate);
    expect(view!.month).toBe(9);
    expect(view!.year).toBe(2026);

    const withUrl = await loadCalendarPageView(
      "cal_preseason_month",
      { year: 2026, month: 10 },
      store,
    );
    expect(withUrl!.month).toBe(10);
    expect(withUrl!.year).toBe(2026);
    expect(withUrl!.selectedDate).toBe(state.world.calendar.currentDate);
  });
});
