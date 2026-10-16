import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld, runWorldPipeline } from "@/systems/world-pipeline";

describe("world pipeline advanceDay", () => {
  it("continues the RNG stream across advances via getState", () => {
    const state = createInitialGameState({
      saveId: "save_rng_cont",
      rngSeed: 7,
      settings: CBL_GAME_SETTINGS,
    });
    const rngA = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rngA).state;
    const first = runWorldPipeline(bootstrapped, rngA, { type: "advanceDay" });
    const midState = rngA.getState();

    const rngB = createSeededRng(midState);
    const second = runWorldPipeline(first.state, rngB, { type: "advanceDay" });

    const rngReplay = createSeededRng(state.meta.rngState);
    const replayBoot = bootstrapWorld(state, rngReplay).state;
    const replayFirst = runWorldPipeline(replayBoot, rngReplay, {
      type: "advanceDay",
    });
    const replaySecond = runWorldPipeline(replayFirst.state, rngReplay, {
      type: "advanceDay",
    });

    expect(second.state.world.calendar.currentDate).toBe(
      replaySecond.state.world.calendar.currentDate,
    );
    expect(second.state.competition.standings).toEqual(
      replaySecond.state.competition.standings,
    );
  });
});
