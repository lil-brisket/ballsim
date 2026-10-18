import { describe, expect, it, vi } from "vitest";

// Force the date-sync fallback path: advanceLeaguePhase rejects after
// canAdvancePhase already passed.
vi.mock("@/systems/simulation/offseason-lifecycle", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/systems/simulation/offseason-lifecycle")
    >();
  return {
    ...actual,
    advanceLeaguePhase: () => {
      throw new Error("forced advance failure");
    },
  };
});

import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { getExpectedPhaseWindow } from "@/systems/league-rules/league-calendar";
import {
  canAdvancePhase,
  getActivePhaseId,
  setActivePhase,
} from "@/systems/phase-engine";
import { syncPhaseForward } from "@/systems/simulation/phase-lifecycle";
import type { GameState } from "@/state/game-state";

describe("syncPhaseForward fallback", () => {
  it("moves the phase pointer when advanceLeaguePhase throws", () => {
    const initial = createInitialGameState({
      saveId: "phase_fallback",
      rngSeed: 5,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(initial.meta.rngState);
    const bootstrapped = bootstrapWorld(initial, rng).state;

    const from = "offseason.roster_decisions" as const;
    const to = "offseason.draft_preparation" as const;
    let state: GameState = setActivePhase(bootstrapped, from);
    const window = getExpectedPhaseWindow(state, to);
    expect(window).not.toBeNull();
    state = {
      ...state,
      world: {
        ...state.world,
        calendar: { ...state.world.calendar, currentDate: window!.start },
      },
    };
    expect(canAdvancePhase(state)).toBe(true);

    const result = syncPhaseForward(state, rng, { allowAiAssist: false });

    expect(result.transitioned).toBe(true);
    expect(result.stopMessage).toBe("forced advance failure");
    expect(getActivePhaseId(result.state)).toBe(to);
    expect(result.toPhaseId).toBe(to);
  });
});
