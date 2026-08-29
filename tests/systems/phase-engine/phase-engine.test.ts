import { describe, expect, it } from "vitest";
import { createCblInitialGameState } from "@/state/create-initial-state";
import { asSaveId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  advanceLeaguePhase,
  processOffseasonLifecycle,
} from "@/systems/simulation/offseason-lifecycle";
import { enterOffseasonFromPostseason } from "@/systems/simulation/season-lifecycle";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import {
  canAdvancePhase,
  evaluatePhaseTasks,
  getActivePhaseId,
  previewAdvance,
  setActivePhase,
  tryAdvanceUserManagedPhase,
} from "@/systems/phase-engine";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { serializeGameState, deserializeGameState } from "@/persistence/mappers/game-state-mapper";

function bootState() {
  let state = createCblInitialGameState({
    saveId: asSaveId("phase_engine_test"),
    rngSeed: 42,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  return {
    state: {
      ...state,
      meta: { ...state.meta, rngState: rng.getState() },
    },
    rng,
  };
}

describe("phase-engine", () => {
  it("starts new saves in preseason.preparation", () => {
    const { state } = bootState();
    expect(getActivePhaseId(state)).toBe("preseason.preparation");
    expect(state.competition.phase.activePhaseId).toBe("preseason.preparation");
    expect(state.user.franchisePhaseState[state.user.activeOwnerTeamId]).toEqual({
      dismissed: [],
    });
  });

  it("does not auto-advance user-controlled preseason on daily sim", () => {
    const { state, rng } = bootState();
    expect(getActivePhaseId(state)).toBe("preseason.preparation");
    const advanced = advanceSimulation(state, rng, { days: 3 });
    expect(getActivePhaseId(advanced.state)).toBe("preseason.preparation");
    expect(advanced.state.competition.season.phase).toBe("preseason");
  });

  it("advances preseason to regular via user advance", () => {
    const { state, rng } = bootState();
    expect(canAdvancePhase(state)).toBe(true);
    const next = advanceLeaguePhase(state, rng).state;
    expect(getActivePhaseId(next)).toBe("regular");
    expect(next.competition.season.phase).toBe("regular");
  });

  it("runs season_transition automatically into roster_decisions", () => {
    const { state, rng } = bootState();
    let current = setActivePhase(
      {
        ...state,
        competition: {
          ...state.competition,
          season: {
            ...state.competition.season,
            phase: "postseason",
            offseasonStage: "none",
          },
        },
      },
      "postseason.season_review",
    );
    current = enterOffseasonFromPostseason(current).state;
    expect(getActivePhaseId(current)).toBe("offseason.season_transition");
    const processed = processOffseasonLifecycle(current, rng);
    expect(getActivePhaseId(processed.state)).toBe("offseason.roster_decisions");
  });

  it("uses draft-before-free-agency order", () => {
    const { state } = bootState();
    let current = setActivePhase(state, "offseason.roster_decisions");
    expect(previewAdvance(current).toPhaseId).toBe(
      "offseason.draft_preparation",
    );
    current = setActivePhase(current, "offseason.draft_preparation");
    expect(previewAdvance(current).toPhaseId).toBe("offseason.draft");
    current = setActivePhase(current, "offseason.draft");
    expect(previewAdvance(current).toPhaseId).toBe("offseason.free_agency");
    current = setActivePhase(current, "offseason.free_agency");
    expect(previewAdvance(current).toPhaseId).toBe(
      "offseason.staff_development",
    );
  });

  it("does not block advance on recommended-only tasks", () => {
    const { state } = bootState();
    const current = setActivePhase(state, "offseason.free_agency");
    const summary = evaluatePhaseTasks(current);
    expect(summary.counts.required).toBe(0);
    expect(canAdvancePhase(current)).toBe(true);
  });

  it("harness helper advances user phases without required blockers", () => {
    const { state, rng } = bootState();
    const next = tryAdvanceUserManagedPhase(state, rng);
    expect(next).not.toBeNull();
    expect(getActivePhaseId(next!)).toBe("regular");
  });

  it("round-trips schema v49 phase fields through serialize/deserialize", () => {
    const { state } = bootState();
    expect(state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    const json = serializeGameState(state);
    const restored = deserializeGameState(json);
    expect(restored.competition.phase.activePhaseId).toBe(
      state.competition.phase.activePhaseId,
    );
    expect(restored.user.franchisePhaseState).toEqual(
      state.user.franchisePhaseState,
    );
  });
});
