import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { findTeamStaffByRole } from "@/systems/staff-effects";
import { hireStaff, fireStaff } from "@/systems/staff";
import { asTeamId } from "@/domain/ids";

describe("staff multi-team owner safety", () => {
  it("staff belonging to one owned team is not treated as belonging to another", () => {
    let state = createInitialGameState({
      saveId: "staff_mt_1",
      rngSeed: 66,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;

    const teamA = state.user.activeOwnerTeamId;
    const teamB = Object.keys(state.world.teams).find(
      (id) => id !== teamA,
    ) as typeof teamA;
    expect(teamB).toBeTruthy();

    // Simulate multi-owner by marking both owned
    state = {
      ...state,
      user: {
        ...state.user,
        ownedTeamIds: [teamA, teamB],
        ownedFranchises: {
          ...state.user.ownedFranchises,
          [teamB]: state.user.ownedFranchises[teamA]!,
        },
      },
    };

    const scoutA = findTeamStaffByRole(state, teamA, "scout");
    const scoutB = findTeamStaffByRole(state, teamB, "scout");
    expect(scoutA).not.toBeNull();
    expect(scoutB).not.toBeNull();
    expect(scoutA!.id).not.toBe(scoutB!.id);
    expect(scoutA!.teamId).toBe(teamA);
    expect(scoutB!.teamId).toBe(teamB);

    // Fire A scout — B unchanged
    state = fireStaff(state, teamA, scoutA!.id).state;
    expect(findTeamStaffByRole(state, teamA, "scout")).toBeNull();
    expect(findTeamStaffByRole(state, teamB, "scout")!.id).toBe(scoutB!.id);
  });

  it("cannot hire the same free agent onto two teams", () => {
    let state = createInitialGameState({
      saveId: "staff_mt_2",
      rngSeed: 67,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamA = state.user.activeOwnerTeamId;
    const teamB = Object.keys(state.world.teams).find(
      (id) => id !== teamA,
    ) as typeof teamA;

    // Vacate trainer on both
    const trA = findTeamStaffByRole(state, teamA, "trainer");
    const trB = findTeamStaffByRole(state, teamB, "trainer");
    if (trA) state = fireStaff(state, teamA, trA.id).state;
    if (trB) state = fireStaff(state, teamB, trB.id).state;

    const fa = Object.values(state.world.staff).find(
      (s) => s.teamId === null && s.role === "trainer",
    )!;
    state = hireStaff(state, teamA, fa.id).state;
    expect(() => hireStaff(state, teamB, fa.id)).toThrow(/already employed/i);
  });
});
