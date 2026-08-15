import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { getIsoWeekId } from "@/domain/calendar-date";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

describe("advanceSimulation", () => {
  it("advances one day, sims the opener on the first preseason advance, and reports metadata", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "adv_opener",
      rngSeed: 7,
    });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng).state;

    expect(bootstrapped.competition.season.phase).toBe("preseason");

    const result = advanceSimulation(bootstrapped, rng, { days: 1 });

    expect(result.previousDate).toBe("2026-10-01");
    expect(result.currentDate).toBe("2026-10-02");
    expect(result.daysAdvanced).toBe(1);
    expect(result.phaseBefore).toBe("preseason");
    expect(result.phaseAfter).toBe("regular");
    expect(result.phaseChanged).toBe(true);
    expect(result.gamesSimulated).toBeGreaterThan(0);
    expect(result.state.world.calendar.lastSimulatedDate).toBe("2026-10-01");

    const openers = Object.values(result.state.competition.games).filter(
      (game) => game.date === "2026-10-01",
    );
    expect(openers.length).toBeGreaterThan(0);
    expect(openers.every((game) => game.status === "final")).toBe(true);
  });

  it("rejects re-simulating the same calendar date", () => {
    const state = createInitialGameState({ saveId: "adv_twice", rngSeed: 8 });
    const rng = createSeededRng(state.meta.rngState);
    let current = bootstrapWorld(state, rng).state;
    current = advanceSimulation(current, rng).state;

    const stuck = {
      ...current,
      world: {
        ...current.world,
        calendar: {
          ...current.world.calendar,
          currentDate: current.world.calendar.lastSimulatedDate!,
        },
      },
    };
    expect(() => advanceSimulation(stuck, rng)).toThrow(
      /Daily simulation already completed/,
    );
  });

  it("runs the weekly pipeline only when crossing into a new ISO week", () => {
    resetDomainEventSequenceForTests();
    // Sunday 2026-08-09 → Monday 2026-08-10 crosses weeks.
    let state = createInitialGameState({
      saveId: "adv_week",
      rngSeed: 9,
    });
    state = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          currentDate: "2026-08-09",
          lastSimulatedDate: null,
          lastSimulatedWeekId: null,
          lastSimulatedMonthId: null,
        },
      },
    };
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const sundayWeek = getIsoWeekId("2026-08-09");
    const result = advanceSimulation(state, rng);
    expect(result.currentDate).toBe("2026-08-10");
    expect(result.weeklyPipelineRan).toBe(true);
    expect(result.state.world.calendar.lastSimulatedWeekId).toBe(sundayWeek);

    const second = advanceSimulation(result.state, rng);
    // Monday → Tuesday same ISO week — weekly should not re-run for a new week.
    expect(getIsoWeekId("2026-08-10")).toBe(getIsoWeekId("2026-08-11"));
    expect(second.weeklyPipelineRan).toBe(false);
    expect(second.state.world.calendar.lastSimulatedWeekId).toBe(sundayWeek);
  });

  it("rejects non-positive day counts", () => {
    const state = createInitialGameState({ saveId: "adv_bad_days" });
    const rng = createSeededRng(state.meta.rngState);
    expect(() => advanceSimulation(state, rng, { days: 0 })).toThrow(
      /days must be an integer >= 1/,
    );
  });
});
