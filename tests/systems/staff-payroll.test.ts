import { describe, expect, it } from "vitest";
import { createStaffContract } from "@/domain/entities/staff-contract";
import { createStaff } from "@/domain/entities/staff";
import { asStaffContractId, asStaffId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { STAFF_PAYROLL_WEEKS_PER_YEAR } from "@/systems/staff-config";
import { processWeeklyStaffPayroll } from "@/systems/staff";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("staff payroll", () => {
  it("processWeeklyStaffPayroll deducts floor(annual/52) per active contract", () => {
    let state = createInitialGameState({
    saveId: "payroll_test", rngSeed: 5,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;

    const staffId = asStaffId("staff_payroll_test");
    const contractId = asStaffContractId("scontract_payroll_test");
    const annual = 5_200_000;
    const weeklyExpected = Math.floor(annual / STAFF_PAYROLL_WEEKS_PER_YEAR);

    state = {
      ...state,
      world: {
        ...state.world,
        staff: {
          ...state.world.staff,
          [staffId]: createStaff({
            id: staffId,
            teamId,
            firstName: "Pat",
            lastName: "Payroll",
            role: "finance",
            quality: 60,
            experience: 5,
            strengths: [],
            weaknesses: [],
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

    const cashBefore = state.business.finances[teamId]!.cash;
    const result = processWeeklyStaffPayroll(state);
    const cashAfter = result.state.business.finances[teamId]!.cash;
    expect(cashBefore - cashAfter).toBeGreaterThanOrEqual(weeklyExpected);
    const books =
      result.state.business.finances[teamId]!.booksByYear[String(year)];
    expect(books?.expenses.staff).toBeGreaterThanOrEqual(weeklyExpected);
  });
});
