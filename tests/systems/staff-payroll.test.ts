import { describe, expect, it } from "vitest";
import { createStaffContract } from "@/domain/entities/staff-contract";
import { asStaffContractId, asStaffId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { processWeeklyStaffPayroll } from "@/systems/staff";
import { getTeamStaffPayroll } from "@/systems/staff-budget";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { testStaff } from "../helpers/staff";

describe("staff payroll", () => {
  it("processWeeklyStaffPayroll does not drain business funds (commitment limit)", () => {
    let state = createInitialGameState({
      saveId: "payroll_test",
      rngSeed: 5,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.activeOwnerTeamId;
    const year = state.competition.season.year;

    const staffId = asStaffId("staff_payroll_test");
    const contractId = asStaffContractId("scontract_payroll_test");
    const annual = 5_200_000;

    state = {
      ...state,
      world: {
        ...state.world,
        staff: {
          ...state.world.staff,
          [staffId]: testStaff({
            id: staffId,
            teamId,
            firstName: "Pat",
            lastName: "Payroll",
            role: "finance",
            overall: 60,
            experience: 5,
          }),
        },
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...state.world.teams[teamId]!,
            staff: [...state.world.teams[teamId]!.staff, staffId],
          },
        },
      },
      business: {
        ...state.business,
        staffContracts: {
          ...state.business.staffContracts,
          [contractId]: createStaffContract({
            id: contractId,
            staffId,
            teamId,
            startYear: year,
            endYear: year + 2,
            salaryByYear: {
              [String(year)]: annual,
              [String(year + 1)]: annual,
              [String(year + 2)]: annual,
            },
          }),
        },
      },
    };

    const fundsBefore = state.business.finances[teamId]!.businessFunds;
    const result = processWeeklyStaffPayroll(state);
    const fundsAfter = result.state.business.finances[teamId]!.businessFunds;
    expect(fundsAfter).toBe(fundsBefore);
    expect(getTeamStaffPayroll(teamId, year, result.state)).toBeGreaterThanOrEqual(
      annual,
    );
  });
});
