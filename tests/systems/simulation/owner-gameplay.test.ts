import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { asTeamId } from "@/domain/ids";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { runOwnerGameplay } from "@/systems/simulation/owner-gameplay";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import {
  getActiveOwnedFranchise,
  getOwnedTeamIds,
  withAddedOwnedFranchise,
} from "@/state/owner-context";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";

describe("owner gameplay integration", () => {
  it("generates objectives when advancing from preseason", () => {
    resetDomainEventSequenceForTests();
    let state = createInitialGameState({
    saveId: "gp_obj", rngSeed: 31,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = beginRegularSeasonFromPreseason(state).state;
    const result = advanceSimulation(state, rng, { days: 1 });
    expect(result.state.competition.season.phase).toBe("regular");
    expect(
      getActiveOwnedFranchise(result.state).objectives.some(
        (objective) =>
          objective.status === "active" &&
          objective.seasonYear === result.state.competition.season.year,
      ),
    ).toBe(true);
    expect(getActiveOwnedFranchise(result.state).notifications.length).toBeGreaterThanOrEqual(0);
  });

  it("persists gameplay state through save/load", () => {
    resetDomainEventSequenceForTests();
    let state = createInitialGameState({
    saveId: "gp_persist", rngSeed: 32,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = advanceSimulation(state, rng, { days: 1 }).state;
    const json = serializeGameState(state);
    const restored = deserializeGameState(json);
    expect(getActiveOwnedFranchise(restored).objectives).toEqual(getActiveOwnedFranchise(state).objectives);
    expect(getActiveOwnedFranchise(restored).notifications).toEqual(getActiveOwnedFranchise(state).notifications);
    expect(getActiveOwnedFranchise(restored).appliedGameplayConsequenceKeys).toEqual(
      getActiveOwnedFranchise(state).appliedGameplayConsequenceKeys,
    );
  });

  it("is idempotent when runOwnerGameplay is invoked twice on the same day", () => {
    resetDomainEventSequenceForTests();
    let state = createInitialGameState({
    saveId: "gp_idem", rngSeed: 33,
    settings: CBL_GAME_SETTINGS,
  });
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

    expect(getActiveOwnedFranchise(second.state).notifications).toHaveLength(
      getActiveOwnedFranchise(first.state).notifications.length,
    );
    expect(getActiveOwnedFranchise(second.state).objectives).toEqual(getActiveOwnedFranchise(first.state).objectives);
    expect(getActiveOwnedFranchise(second.state).appliedGameplayConsequenceKeys).toEqual(
      getActiveOwnedFranchise(first.state).appliedGameplayConsequenceKeys,
    );
    expect(second.state.business.finances).toEqual(first.state.business.finances);
  });

  it("evaluates objectives for every owned franchise, not only the active team", () => {
    resetDomainEventSequenceForTests();
    let state = createInitialGameState({
      saveId: "gp_multi_owned",
      rngSeed: 34,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamIds = Object.keys(state.world.teams).sort();
    const primary = asTeamId(teamIds[0]!);
    const secondary = asTeamId(teamIds[1]!);
    state = withAddedOwnedFranchise(
      state,
      secondary,
      createDefaultOwnedFranchiseState({
        seasonYear: state.competition.season.year,
        currentDate: state.world.calendar.currentDate,
        citySelectionConfirmed: true,
        franchiseIdentityConfirmed: true,
      }),
    );
    expect(getOwnedTeamIds(state)).toEqual([primary, secondary]);

    state = {
      ...state,
      user: {
        ...state.user,
        franchisePhaseState: {
          ...state.user.franchisePhaseState,
          [secondary]: { dismissed: [] },
        },
      },
    };
    state = beginRegularSeasonFromPreseason(state).state;

    const result = advanceSimulation(state, rng, { days: 1 });
    const seasonYear = result.state.competition.season.year;
    expect(result.state.competition.season.phase).toBe("regular");

    for (const teamId of getOwnedTeamIds(result.state)) {
      const franchise = result.state.user.ownedFranchises[teamId]!;
      expect(
        franchise.objectives.some(
          (objective) =>
            objective.status === "active" && objective.seasonYear === seasonYear,
        ),
      ).toBe(true);
    }
  });
});
