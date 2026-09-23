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

import { addCalendarDays } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { needsRegularSeasonInitialization } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { advanceOwnerTime } from "@/application/game-service";
import { getActivePhaseId } from "@/systems/phase-engine";

describe("preseason → regular phase-boundary simulation", () => {
  it("initializes regular season without simulating the opener", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "boundary_opener",
      rngSeed: 41,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    let current = bootstrapWorld(state, rng).state;

    expect(needsRegularSeasonInitialization(current)).toBe(true);
    expect(current.competition.season.phase).toBe("preseason");
    expect(current.world.calendar.currentDate).toBe("2026-09-10");

    // Stand on the planned opener so the next advance opens regular season.
    current = {
      ...current,
      world: {
        ...current.world,
        calendar: {
          ...current.world.calendar,
          currentDate: "2026-10-01",
        },
      },
    };

    const first = advanceSimulation(current, rng, {
      days: 1,
      stopOnPhaseChange: true,
      allowOwnerManagedPhaseTransitions: true,
    });

    expect(first.stopReason).toBe("phase_change");
    expect(first.phaseChanged).toBe(true);
    expect(first.gamesSimulated).toBe(0);
    expect(first.state.competition.season.phase).toBe("regular");
    expect(getActivePhaseId(first.state)).toBe("regular");
    expect(first.state.competition.schedule.gameIds.length).toBeGreaterThan(0);
    expect(first.state.competition.season.regularSeasonStartDate).toBe(
      "2026-10-01",
    );
    expect(first.state.world.calendar.currentDate).toBe(
      first.state.competition.season.regularSeasonStartDate,
    );

    const openers = Object.values(first.state.competition.games).filter(
      (g) =>
        g.competitionType === "regular_season" &&
        g.date === first.state.competition.season.regularSeasonStartDate,
    );
    expect(openers.length).toBeGreaterThan(0);
    expect(openers.every((g) => g.status === "scheduled")).toBe(true);

    const second = advanceSimulation(first.state, rng, {
      days: 1,
      allowOwnerManagedPhaseTransitions: true,
    });
    expect(second.gamesSimulated).toBeGreaterThan(0);
    const played = Object.values(second.state.competition.games).filter(
      (g) =>
        g.competitionType === "regular_season" &&
        g.date === first.state.competition.season.regularSeasonStartDate,
    );
    expect(played.every((g) => g.status === "final")).toBe(true);
  });

  it("simulateToDate stops at opener with phase_change, not at target date", async () => {
    resetDomainEventSequenceForTests();
    const store = createMemorySaveGameStore();
    let state = createInitialGameState({
      saveId: "sim_to_date_pre",
      rngSeed: 55,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    // Start one day before the planned opener so simulate-to-date hits the boundary quickly.
    state = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: "2026-09-30",
        },
      },
      meta: { ...state.meta, rngState: rng.getState() },
    };
    await store.create({
      id: "sim_to_date_pre",
      name: "sim_to_date_pre",
      state,
    });

    const from = state.world.calendar.currentDate;
    const target = addCalendarDays(from, 5);
    expect(target).not.toBe(from);

    const result = await advanceOwnerTime(
      "sim_to_date_pre",
      { targetDate: target },
      store,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.simulation.stopReason).toBe("phase_change");
    expect(result.simulation.phaseChanged).toBe(true);
    expect(result.simulation.gamesSimulated).toBe(0);
    expect(result.simulation.currentDate).not.toBe(target);

    const reloaded = await store.load("sim_to_date_pre");
    expect(reloaded).not.toBeNull();
    const after = reloaded!.state;
    expect(result.simulation.currentDate).toBe(
      after.competition.season.regularSeasonStartDate,
    );
    expect(after.competition.season.phase).toBe("regular");
    expect(after.competition.schedule.gameIds.length).toBeGreaterThan(0);

    const openers = Object.values(after.competition.games).filter(
      (g) =>
        g.date === after.competition.season.regularSeasonStartDate &&
        g.competitionType === "regular_season",
    );
    expect(openers.every((g) => g.status === "scheduled")).toBe(true);
  });

  it("does not mutate state when regular-season gates fail", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "boundary_blocked",
      rngSeed: 61,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    let current = bootstrapWorld(state, rng).state;

    // Empty all team rosters so canBeginRegularSeason fails.
    const emptiedTeams = { ...current.world.teams };
    for (const teamId of Object.keys(emptiedTeams)) {
      emptiedTeams[teamId] = {
        ...emptiedTeams[teamId]!,
        roster: [],
      };
    }
    // Jump to the planned opener so the advance attempts to open regular season.
    current = {
      ...current,
      world: {
        ...current.world,
        teams: emptiedTeams,
        calendar: {
          ...current.world.calendar,
          currentDate: "2026-10-01",
        },
      },
    };

    const beforeDate = current.world.calendar.currentDate;
    const beforePhase = current.competition.season.phase;
    const beforeScheduleLen = current.competition.schedule.gameIds.length;

    expect(() =>
      advanceSimulation(current, rng, {
        days: 5,
        stopOnPhaseChange: true,
        allowOwnerManagedPhaseTransitions: true,
      }),
    ).toThrow(/Cannot begin regular season/i);

    expect(current.world.calendar.currentDate).toBe(beforeDate);
    expect(current.competition.season.phase).toBe(beforePhase);
    expect(current.competition.schedule.gameIds.length).toBe(
      beforeScheduleLen,
    );
  });

  it("does not open regular season without allowOwnerManagedPhaseTransitions", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "boundary_no_owner",
      rngSeed: 71,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const current = bootstrapWorld(state, rng).state;

    const result = advanceSimulation(current, rng, {
      days: 1,
      allowOwnerManagedPhaseTransitions: false,
    });

    expect(result.state.competition.season.phase).toBe("preseason");
    expect(result.state.competition.schedule.gameIds.length).toBeGreaterThan(0);
    expect(needsRegularSeasonInitialization(result.state)).toBe(true);
  });
});
