import { describe, expect, it } from "vitest";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  isValidPhaseTransition,
  transitionPhase,
  VALID_PHASE_TRANSITIONS,
} from "@/systems/simulation/phase-machine";
import type { SeasonPhase } from "@/domain/entities/season";
import { SEASON_PHASES } from "@/domain/entities/season";

describe("phase machine", () => {
  it("starts new saves in preseason", () => {
    const state = createInitialGameState({ saveId: "phase_initial" });
    expect(state.competition.season.phase).toBe("preseason");
    expect(state.competition.season.offseasonStage).toBe("none");
  });

  it("allows only the closed adjacency map", () => {
    expect(VALID_PHASE_TRANSITIONS.preseason).toEqual(["regular"]);
    expect(VALID_PHASE_TRANSITIONS.regular).toEqual([
      "playoffs",
      "postseason",
    ]);
    expect(VALID_PHASE_TRANSITIONS.playoffs).toEqual(["postseason"]);
    expect(VALID_PHASE_TRANSITIONS.postseason).toEqual(["offseason"]);
    expect(VALID_PHASE_TRANSITIONS.offseason).toEqual(["preseason"]);
  });

  it("succeeds for each allowed transition", () => {
    let state = createInitialGameState({ saveId: "phase_ok" });
    const path: SeasonPhase[] = [
      "regular",
      "playoffs",
      "postseason",
      "offseason",
      "preseason",
    ];
    for (const next of path) {
      state = transitionPhase(state, next).state;
      expect(state.competition.season.phase).toBe(next);
    }
  });

  it("allows regular → postseason structurally", () => {
    let state = createInitialGameState({ saveId: "phase_skip_playoffs" });
    state = transitionPhase(state, "regular").state;
    state = transitionPhase(state, "postseason").state;
    expect(state.competition.season.phase).toBe("postseason");
  });

  it("rejects illegal transitions", () => {
    const state = createInitialGameState({ saveId: "phase_bad" });
    expect(() => transitionPhase(state, "playoffs")).toThrow(
      /Invalid season phase transition/,
    );
    expect(isValidPhaseTransition("offseason", "regular")).toBe(false);
    expect(isValidPhaseTransition("playoffs", "regular")).toBe(false);
    expect(isValidPhaseTransition("preseason", "offseason")).toBe(false);
  });

  it("no-ops when already in the target phase", () => {
    const state = createInitialGameState({ saveId: "phase_noop" });
    const result = transitionPhase(state, "preseason");
    expect(result.state).toBe(state);
  });

  it("does not encode competition-size rules in the adjacency map", () => {
    // Every phase pair is either allowed or not — no playoff field size imports.
    for (const from of SEASON_PHASES) {
      for (const to of SEASON_PHASES) {
        const allowed = VALID_PHASE_TRANSITIONS[from].includes(to);
        expect(isValidPhaseTransition(from, to)).toBe(allowed);
      }
    }
  });
});
