import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  resolvePhaseResolution,
  getExpectedPhaseWindow,
  resolveSeasonAnchors,
} from "@/systems/league-rules/league-calendar";
import { getActivePhaseId } from "@/systems/phase-engine";
import { syncPhaseForward } from "@/systems/simulation/phase-lifecycle";
import { PHASE_ORDER } from "@/systems/league-rules/league-calendar";

describe("league-calendar phase resolution", () => {
  it("returns a resolution with expected window for the active date", () => {
    const state = createInitialGameState({
      saveId: "cal_res",
      rngSeed: 3,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng).state;
    const date = bootstrapped.world.calendar.currentDate;
    const resolution = resolvePhaseResolution(bootstrapped, date);
    expect(resolution.phaseId).toBeTruthy();
    expect(resolution.reason).toBeTruthy();
    const anchors = resolveSeasonAnchors(bootstrapped);
    expect(anchors).toBeTruthy();
    const window = getExpectedPhaseWindow(bootstrapped, resolution.phaseId);
    // Window may be null for in-season phases without offseason config.
    expect(window === null || typeof window.start === "string").toBe(true);
  });
});

describe("phase-lifecycle syncPhaseForward", () => {
  it("advances at most one phase per call", () => {
    const state = createInitialGameState({
      saveId: "phase_sync",
      rngSeed: 11,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng).state;
    const before = getActivePhaseId(bootstrapped);
    const result = syncPhaseForward(bootstrapped, rng, { allowAiAssist: false });
    const after = getActivePhaseId(result.state);
    if (result.transitioned) {
      expect(after).not.toBe(before);
      expect(result.fromPhaseId).toBe(before);
      expect(result.toPhaseId).toBe(after);
    } else {
      expect(after).toBe(before);
    }
  });

  it("never skips intermediate phases in a single sync call", () => {
    const state = createInitialGameState({
      saveId: "phase_no_skip",
      rngSeed: 11,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng).state;
    const before = getActivePhaseId(bootstrapped);
    const result = syncPhaseForward(bootstrapped, rng, { allowAiAssist: true });
    const after = getActivePhaseId(result.state);
    const fromIndex = PHASE_ORDER.indexOf(before);
    const toIndex = PHASE_ORDER.indexOf(after);
    if (result.transitioned && fromIndex >= 0 && toIndex >= 0) {
      expect(toIndex - fromIndex).toBeLessThanOrEqual(1);
    }
  });
});
