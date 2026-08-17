import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { getFinancialStatement } from "@/systems/team-finances";
import {
  PLAYER_PAYROLL_WEEKS_PER_YEAR,
  processWeeklyPlayerPayroll,
} from "@/systems/player-payroll";
import { getTeamPayroll } from "@/systems/salary-cap";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("player payroll cash", () => {
  it("reduces cash without posting playerSalaries to books", () => {
    let state = createInitialGameState({
      saveId: "payroll_cash",
      rngSeed: 44,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const annual = getTeamPayroll(teamId, year, state);
    expect(annual).toBeGreaterThan(0);

    const cashBefore = state.business.finances[teamId]!.cash;
    const booksBefore =
      state.business.finances[teamId]!.booksByYear[String(year)]?.expenses;
    const result = processWeeklyPlayerPayroll(state);
    const cashAfter = result.state.business.finances[teamId]!.cash;
    const expectedWeekly = Math.floor(annual / PLAYER_PAYROLL_WEEKS_PER_YEAR);
    expect(cashAfter).toBe(cashBefore - expectedWeekly);

    const booksAfter =
      result.state.business.finances[teamId]!.booksByYear[String(year)]?.expenses;
    expect(booksAfter?.operations ?? 0).toBe(booksBefore?.operations ?? 0);
    expect(booksAfter?.staff ?? 0).toBe(booksBefore?.staff ?? 0);

    const paid = result.events.filter((e) => e.type === "PlayerPayrollPaid");
    expect(paid.length).toBeGreaterThan(0);
    expect(paid.some((e) => e.payload.teamId === teamId)).toBe(true);

    const statement = getFinancialStatement(result.state, teamId, year);
    expect(statement.expenses.playerSalaries).toBe(annual);
  });

  it("scenario E — higher payroll creates more weekly cash pressure", () => {
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

    const cashLowBefore = state.business.finances[low.id]!.cash;
    const cashHighBefore = state.business.finances[high.id]!.cash;
    const result = processWeeklyPlayerPayroll(state);
    const lowDelta =
      cashLowBefore - result.state.business.finances[low.id]!.cash;
    const highDelta =
      cashHighBefore - result.state.business.finances[high.id]!.cash;
    expect(highDelta).toBeGreaterThanOrEqual(lowDelta);
    // Starting cash should still cover many weeks for a typical roster.
    const weeksCovered = Math.floor(
      cashHighBefore / Math.max(1, highDelta),
    );
    expect(weeksCovered).toBeGreaterThan(8);
  });
});
