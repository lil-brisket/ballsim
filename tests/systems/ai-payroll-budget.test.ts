import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createEmptyTeamFinanceBooks } from "@/domain/entities/finances";
import type { TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  AI_PAYROLL_CASH_CLAWBACK_RATE,
  AI_PAYROLL_CASH_DRAW_RATE,
  AI_PAYROLL_CASH_RESERVE,
  AI_PAYROLL_REVENUE_MARGIN,
  aiPayrollBudget,
  aiPayrollRoom,
} from "@/systems/ai-payroll-budget";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { bootstrapWorld } from "@/systems/world-pipeline";

function offseasonState(): { state: GameState; teamId: TeamId } {
  const initial = createInitialGameState({
    saveId: "ai_payroll_budget",
    rngSeed: 61,
    settings: CBL_GAME_SETTINGS,
  });
  let state = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  state = transitionPhase(state, "regular").state;
  state = transitionPhase(state, "postseason").state;
  state = transitionPhase(state, "offseason").state;
  const teamId = (Object.keys(state.world.teams) as TeamId[])
    .filter((id) => id !== state.user.activeOwnerTeamId)
    .sort()[0]!;
  return { state, teamId };
}

function withSeason(
  state: GameState,
  teamId: TeamId,
  input: {
    revenue: number;
    staff: number;
    cash: number;
    playoffs?: number;
    yearsAgo?: number;
  },
): GameState {
  const year = String(state.competition.season.year - (input.yearsAgo ?? 0));
  const finances = state.business.finances[teamId]!;
  const books = createEmptyTeamFinanceBooks();
  books.revenue.tickets = input.revenue;
  books.revenue.playoffs = input.playoffs ?? 0;
  books.expenses.staff = input.staff;
  return {
    ...state,
    business: {
      ...state.business,
      finances: {
        ...state.business.finances,
        [teamId]: {
          ...finances,
          businessFunds: input.cash,
          booksByYear: { ...finances.booksByYear, [year]: books },
        },
      },
    },
  };
}

describe("AI payroll budget (#93)", () => {
  it("has no budget before a completed season, so only the cap applies", () => {
    const initial = createInitialGameState({
      saveId: "ai_payroll_budget_new",
      rngSeed: 62,
      settings: CBL_GAME_SETTINGS,
    });
    const state = bootstrapWorld(
      initial,
      createSeededRng(initial.meta.rngState),
    ).state;
    const teamId = Object.keys(state.world.teams)[0] as TeamId;
    const year = state.competition.season.year;
    expect(aiPayrollBudget(state, teamId)).toBeNull();
    expect(aiPayrollRoom(state, teamId, year)).toBe(
      getTeamCapSpace(teamId, year, state),
    );
  });

  it("budgets recurring revenue less operating costs plus a cash draw", () => {
    const { state: base, teamId } = offseasonState();
    const state = withSeason(base, teamId, {
      revenue: 70_000_000,
      playoffs: 4_000_000,
      staff: 3_000_000,
      cash: 30_000_000,
    });
    // Playoff money is left out of the estimate.
    expect(aiPayrollBudget(state, teamId)).toBeCloseTo(
      (70_000_000 - 3_000_000) * AI_PAYROLL_REVENUE_MARGIN +
        (30_000_000 - AI_PAYROLL_CASH_RESERVE) * AI_PAYROLL_CASH_DRAW_RATE,
    );
  });

  it("plans on the weaker of the last two seasons", () => {
    const { state: base, teamId } = offseasonState();
    let state = withSeason(base, teamId, {
      revenue: 60_000_000,
      staff: 0,
      cash: 0,
      yearsAgo: 1,
    });
    state = withSeason(state, teamId, {
      revenue: 80_000_000,
      staff: 0,
      cash: AI_PAYROLL_CASH_RESERVE,
    });
    expect(aiPayrollBudget(state, teamId)).toBeCloseTo(
      60_000_000 * AI_PAYROLL_REVENUE_MARGIN,
    );
  });

  it("takes a shortfall below the reserve off in full", () => {
    const { state: base, teamId } = offseasonState();
    const state = withSeason(base, teamId, {
      revenue: 70_000_000,
      staff: 0,
      cash: -5_000_000,
    });
    expect(aiPayrollBudget(state, teamId)).toBeCloseTo(
      70_000_000 * AI_PAYROLL_REVENUE_MARGIN +
        (-5_000_000 - AI_PAYROLL_CASH_RESERVE) * AI_PAYROLL_CASH_CLAWBACK_RATE,
    );
  });

  it("leaves a team in the red no room to add salary despite cap space", () => {
    const { state: base, teamId } = offseasonState();
    const year = base.competition.season.year + 1;
    const payroll = getTeamPayroll(teamId, year, base);
    const state = withSeason(base, teamId, {
      revenue: payroll,
      staff: 3_000_000,
      cash: -40_000_000,
    });
    expect(getTeamCapSpace(teamId, year, state)).toBeGreaterThan(0);
    expect(aiPayrollRoom(state, teamId, year)).toBeLessThan(0);
  });

  it("never allows more than cap space", () => {
    const { state: base, teamId } = offseasonState();
    const state = withSeason(base, teamId, {
      revenue: 500_000_000,
      staff: 0,
      cash: 500_000_000,
    });
    const year = state.competition.season.year + 1;
    expect(aiPayrollRoom(state, teamId, year)).toBe(
      getTeamCapSpace(teamId, year, state),
    );
  });
});
