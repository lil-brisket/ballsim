/**
 * What an AI franchise can afford to add to payroll. AI free agency used to
 * spend to the cap regardless of cash, so teams already in the red kept
 * signing ($80-100M payrolls on ~$70M revenue) and ran cash to -$80M (#93).
 */

import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";
import { getFinancialStatement } from "@/systems/team-finances";

/** Share of business funds above the reserve an AI team will draw down through one season's payroll. */
export const AI_PAYROLL_CASH_DRAW_RATE = 0.5;

/**
 * Share of a shortfall below the reserve an AI team plans to win back in one
 * season. Payroll falls slowly (multi-year deals), so a half-rate clawback let
 * teams settle below zero over 10-season careers.
 */
export const AI_PAYROLL_CASH_CLAWBACK_RATE = 1;

/**
 * Share of expected operating income an AI team commits to payroll. The rest
 * absorbs payroll it does not choose (rookie scale, minimum fills) and
 * revenue that falls short of the estimate.
 */
export const AI_PAYROLL_REVENUE_MARGIN = 0.95;

/** Cash an AI team plans to keep on hand after a season's payroll. */
export const AI_PAYROLL_CASH_RESERVE = 10_000_000;

/**
 * Season payroll an AI team budgets for: a conservative revenue estimate
 * (weaker of the last two seasons, without playoff money) less operating
 * costs, times a safety margin, plus half the cash above a reserve (a
 * shortfall below it comes off in full). Null before the league has a
 * completed season to budget from.
 */
export function aiPayrollBudget(
  state: GameState,
  teamId: TeamId,
): number | null {
  const season = state.competition.season;
  // The offseason still belongs to the completed year; once the new season
  // starts, the last completed one is the year before.
  const referenceYear =
    season.phase === "offseason" ? season.year : season.year - 1;
  const books =
    state.business.finances[teamId]?.booksByYear[String(referenceYear)];
  if (books === undefined) {
    return null;
  }
  const statement = getFinancialStatement(state, teamId, referenceYear);
  // Revenue regresses toward the mean, and playoff money does not repeat:
  // plan on the weaker of the last two seasons, without playoffs.
  const recurring = (year: number): number | null => {
    if (
      state.business.finances[teamId]?.booksByYear[String(year)] === undefined
    ) {
      return null;
    }
    const revenue = getFinancialStatement(state, teamId, year).revenue;
    return revenue.total - revenue.playoffs;
  };
  const lastRevenue = recurring(referenceYear)!;
  const priorRevenue = recurring(referenceYear - 1);
  const expectedRevenue =
    priorRevenue === null ? lastRevenue : Math.min(lastRevenue, priorRevenue);
  // Capital (facility upgrades) is spent outside payroll decisions, so budget
  // for it too.
  const operating =
    statement.expenses.staff +
    statement.expenses.facilities +
    statement.expenses.capital +
    statement.expenses.operations +
    statement.expenses.marketing;
  const cash = state.business.finances[teamId]?.businessFunds ?? 0;
  const surplus = cash - AI_PAYROLL_CASH_RESERVE;
  const rate =
    surplus >= 0 ? AI_PAYROLL_CASH_DRAW_RATE : AI_PAYROLL_CASH_CLAWBACK_RATE;
  return (
    (expectedRevenue - operating) * AI_PAYROLL_REVENUE_MARGIN + surplus * rate
  );
}

/**
 * Room an AI team has for new salary in `year`: cap space (when the cap is
 * on), further limited by what its budget leaves after current payroll.
 */
export function aiPayrollRoom(
  state: GameState,
  teamId: TeamId,
  year: number,
): number {
  const capRoom = state.settings.financialRules.salaryCapEnabled
    ? getTeamCapSpace(teamId, year, state)
    : Number.MAX_SAFE_INTEGER;
  const budget = aiPayrollBudget(state, teamId);
  if (budget === null) {
    return capRoom;
  }
  return Math.min(capRoom, budget - getTeamPayroll(teamId, year, state));
}
