import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

describe("season RNG week advance", () => {
  it("advances eight days from a booted regular season", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "rng_week",
      rngSeed: 42,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    let next = bootstrapWorld(state, rng).state;
    next = beginRegularSeasonFromPreseason(next).state;
    const result = advanceSimulation(next, rng, { days: 8 });
    expect(result.daysAdvanced).toBeGreaterThan(0);
  }, 60_000);
});
