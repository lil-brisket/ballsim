import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import {
  beginRegularSeasonFromPreseason,
  isRegularSeasonComplete,
  processSeasonLifecycle,
} from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

/**
 * validateGameSettings currently forces playInEnabled=false, so startPlayoffs
 * does not consume rng on the CBL path. Reconstruction still forked a clone
 * and stamped meta.rngState from it while advanceSimulation kept consuming
 * the live object. Inject live Rng so lifecycle/weekly share the same stream.
 */
function bootRegularSeason(seed: number) {
  resetDomainEventSequenceForTests();
  const state = createInitialGameState({
    saveId: `rng_desync_${seed}`,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  let next = bootstrapWorld(state, rng).state;
  next = beginRegularSeasonFromPreseason(next).state;
  next = {
    ...next,
    meta: { ...next.meta, rngState: rng.getState() },
  };
  return { state: next, rng };
}

describe("season RNG reconstruction", () => {
  it("injected rng stays aligned with meta.rngState at playoff start", () => {
    const { state, rng } = bootRegularSeason(7);
    let current = state;
    const live = rng;
    let playoffsStarted = false;
    for (let day = 0; day < 400; day += 1) {
      if (
        current.competition.season.phase === "regular" &&
        isRegularSeasonComplete(current)
      ) {
        const reconstructed = processSeasonLifecycle(current);
        expect(live.getState()).toBe(current.meta.rngState);
        expect(reconstructed.state.meta.rngState).toBe(current.meta.rngState);

        const life = processSeasonLifecycle(current, live);
        playoffsStarted = life.state.competition.season.phase === "playoffs";
        expect(live.getState()).toBe(life.state.meta.rngState);
        break;
      }
      const advanced = advanceSimulation(current, live, { days: 1 });
      current = {
        ...advanced.state,
        meta: { ...advanced.state.meta, rngState: live.getState() },
      };
    }
    expect(playoffsStarted).toBe(true);
  }, 120_000);
});
