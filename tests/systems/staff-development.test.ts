import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { processSeasonStaffDevelopment } from "@/systems/staff-development";
import { asStaffId, asTeamId } from "@/domain/ids";
import { testStaff } from "../helpers/staff";

describe("staff development", () => {
  it("ages staff and updates trend without collapsing from performance alone", () => {
    let state = createInitialGameState({
      saveId: "staff_dev_1",
      rngSeed: 22,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;

    // Inject elite old-ish coach on a bad team
    const coach = testStaff({
      id: asStaffId("staff_dev_hc"),
      role: "head_coach",
      teamId,
      age: 42,
      overall: 88,
      potential: 90,
      experience: 15,
    });
    // Force overall via attributes already set by helper
    state = {
      ...state,
      world: {
        ...state.world,
        staff: { ...state.world.staff, [coach.id]: coach },
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...state.world.teams[teamId]!,
            staff: [...state.world.teams[teamId]!.staff, coach.id],
          },
        },
      },
      competition: {
        ...state.competition,
        standings: {
          byTeamId: {
            ...state.competition.standings.byTeamId,
            [teamId]: {
              ...state.competition.standings.byTeamId[teamId]!,
              wins: 5,
              losses: 45,
            },
          },
        },
      },
    };

    const before = state.world.staff[coach.id]!.overall;
    const result = processSeasonStaffDevelopment(
      state,
      createSeededRng(100),
    );
    const after = result.state.world.staff[coach.id]!;
    expect(after.age).toBe(coach.age + 1);
    expect(after.experience).toBe(coach.experience + 1);
    // Elite coach should not crater from one bad season
    expect(after.overall).toBeGreaterThanOrEqual(before - 3);
  });
});
