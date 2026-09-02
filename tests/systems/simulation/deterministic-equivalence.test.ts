import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

function bootRegularSeason(seed: number) {
  resetDomainEventSequenceForTests();
  const state = createInitialGameState({
    saveId: `det_${seed}`,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  let next = bootstrapWorld(state, rng).state;
  next = beginRegularSeasonFromPreseason(next).state;
  return { state: next, rng };
}

describe("calendar-driven deterministic equivalence", () => {
  it("1×N day advances match a single N-day advance", () => {
    const days = 5;
    const seed = 42;

    const a = bootRegularSeason(seed);
    let oneByOne = a.state;
    const rngA = createSeededRng(a.state.meta.rngState);
    for (let i = 0; i < days; i += 1) {
      oneByOne = advanceSimulation(oneByOne, rngA, { days: 1 }).state;
    }

    const b = bootRegularSeason(seed);
    const rngB = createSeededRng(b.state.meta.rngState);
    const bulk = advanceSimulation(b.state, rngB, { days }).state;

    expect(bulk.world.calendar.currentDate).toBe(
      oneByOne.world.calendar.currentDate,
    );
    expect(bulk.meta.rngState).toEqual(oneByOne.meta.rngState);
    expect(getActivePhaseSafe(bulk)).toBe(getActivePhaseSafe(oneByOne));
  });
});

function getActivePhaseSafe(state: {
  competition: { season: { phase: string } };
}): string {
  return state.competition.season.phase;
}
