import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createInitialGameState } from "@/state/create-initial-state";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { runOwnerGameplay } from "@/systems/simulation/owner-gameplay";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

describe("owner gameplay integration", () => {
  it("generates objectives when advancing from preseason", () => {
    resetDomainEventSequenceForTests();
    let state = createInitialGameState({ saveId: "gp_obj", rngSeed: 31 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const result = advanceSimulation(state, rng, { days: 1 });
    expect(result.state.competition.season.phase).toBe("regular");
    expect(
      result.state.user.objectives.some(
        (objective) =>
          objective.status === "active" &&
          objective.seasonYear === result.state.competition.season.year,
      ),
    ).toBe(true);
    expect(result.state.user.notifications.length).toBeGreaterThanOrEqual(0);
  });

  it("persists gameplay state through save/load", () => {
    resetDomainEventSequenceForTests();
    let state = createInitialGameState({ saveId: "gp_persist", rngSeed: 32 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = advanceSimulation(state, rng, { days: 1 }).state;
    const json = serializeGameState(state);
    const restored = deserializeGameState(json);
    expect(restored.user.objectives).toEqual(state.user.objectives);
    expect(restored.user.notifications).toEqual(state.user.notifications);
    expect(restored.user.appliedGameplayConsequenceKeys).toEqual(
      state.user.appliedGameplayConsequenceKeys,
    );
  });

  it("is idempotent when runOwnerGameplay is invoked twice on the same day", () => {
    resetDomainEventSequenceForTests();
    let state = createInitialGameState({ saveId: "gp_idem", rngSeed: 33 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = advanceSimulation(state, rng, { days: 1 }).state;

    // Rewind lastSimulatedDate so we can call gameplay on a frozen day snapshot
    // without advancing the calendar (simulate repeated evaluation).
    const frozen = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: state.world.calendar.lastSimulatedDate!,
          lastSimulatedDate: null,
        },
      },
    };

    const first = runOwnerGameplay(frozen, createSeededRng(99));
    const second = runOwnerGameplay(first.state, createSeededRng(99));

    expect(second.state.user.notifications).toHaveLength(
      first.state.user.notifications.length,
    );
    expect(second.state.user.objectives).toEqual(first.state.user.objectives);
    expect(second.state.user.appliedGameplayConsequenceKeys).toEqual(
      first.state.user.appliedGameplayConsequenceKeys,
    );
    expect(second.state.business.finances).toEqual(first.state.business.finances);
  });
});
