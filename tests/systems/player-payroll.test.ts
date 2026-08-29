import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { getFinancialStatement } from "@/systems/team-finances";
import { processWeeklyPlayerPayroll } from "@/systems/player-payroll";
import { getTeamPayroll } from "@/systems/salary-cap";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("player payroll (commitment limit)", () => {
  it("does not reduce business funds; statement still derives player salaries", () => {
    let state = createInitialGameState({
      saveId: "payroll_cash",
      rngSeed: 44,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;
    const year = state.competition.season.year;
    const annual = getTeamPayroll(teamId, year, state);
    expect(annual).toBeGreaterThan(0);

    const fundsBefore = state.business.finances[teamId]!.businessFunds;
    const booksBefore =
      state.business.finances[teamId]!.booksByYear[String(year)]?.expenses;
    const result = processWeeklyPlayerPayroll(state);
    const fundsAfter = result.state.business.finances[teamId]!.businessFunds;
    expect(fundsAfter).toBe(fundsBefore);

    const booksAfter =
      result.state.business.finances[teamId]!.booksByYear[String(year)]?.expenses;
    expect(booksAfter?.operations ?? 0).toBe(booksBefore?.operations ?? 0);
    expect(booksAfter?.staff ?? 0).toBe(booksBefore?.staff ?? 0);
    expect(result.events.filter((e) => e.type === "PlayerPayrollPaid")).toHaveLength(
      0,
    );

    const statement = getFinancialStatement(result.state, teamId, year);
    expect(statement.expenses.playerSalaries).toBe(annual);
  });

  it("higher payroll does not create business-funds pressure", () => {
    let state = createInitialGameState({
      saveId: "payroll_e",
      rngSeed: 50,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamIds = Object.keys(state.world.teams);
    const year = state.competition.season.year;
    const payrolls = teamIds.map((id) => ({
      id,
      payroll: getTeamPayroll(id as never, year, state),
    }));
    payrolls.sort((a, b) => a.payroll - b.payroll);
    const low = payrolls[0]!;
    const high = payrolls[payrolls.length - 1]!;
    expect(high.payroll).toBeGreaterThanOrEqual(low.payroll);

    const fundsLowBefore = state.business.finances[low.id]!.businessFunds;
    const fundsHighBefore = state.business.finances[high.id]!.businessFunds;
    const result = processWeeklyPlayerPayroll(state);
    expect(result.state.business.finances[low.id]!.businessFunds).toBe(
      fundsLowBefore,
    );
    expect(result.state.business.finances[high.id]!.businessFunds).toBe(
      fundsHighBefore,
    );
  });
});
