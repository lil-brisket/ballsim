import {
  createEmptyTeamFinanceBooks,
  isExpenseCategory,
  isRevenueCategory,
  type ExpenseCategory,
  type RevenueCategory,
  type TeamFinanceBooks,
  type TeamFinancialStatement,
  type TeamFinances,
} from "@/domain/entities/finances";
import { createDomainEvent } from "@/domain/events/domain-event";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getTeamPayroll } from "@/systems/salary-cap";

/**
 * Additive revenue posting. Does not mutate cash or payroll.
 * Does not auto-create missing finance records.
 */
export function recordRevenue(
  state: GameState,
  teamId: TeamId,
  category: RevenueCategory,
  amount: number,
  year: number,
): SystemResult {
  assertTeamAndFinanceExist(state, teamId);
  assertRevenueCategory(category);
  assertNonNegativeIntegerAmount(amount, "revenue amount");
  assertSeasonYear(year);

  const next = addToBooks(state, teamId, year, (books) => ({
    ...books,
    revenue: {
      ...books.revenue,
      [category]: books.revenue[category] + amount,
    },
  }));

  return systemResult(next, [
    createDomainEvent({
      type: "RevenueRecorded",
      occurredOn: state.world.calendar.currentDate,
      payload: { teamId, category, amount, year },
    }),
  ]);
}

/**
 * Additive posted-expense posting. Does not accept playerSalaries.
 * Does not mutate cash or payroll. Does not auto-create finance records.
 */
export function recordExpense(
  state: GameState,
  teamId: TeamId,
  category: ExpenseCategory,
  amount: number,
  year: number,
): SystemResult {
  assertTeamAndFinanceExist(state, teamId);
  assertExpenseCategory(category);
  assertNonNegativeIntegerAmount(amount, "expense amount");
  assertSeasonYear(year);

  const next = addToBooks(state, teamId, year, (books) => ({
    ...books,
    expenses: {
      ...books.expenses,
      [category]: books.expenses[category] + amount,
    },
  }));

  return systemResult(next, [
    createDomainEvent({
      type: "ExpenseRecorded",
      occurredOn: state.world.calendar.currentDate,
      payload: { teamId, category, amount, year },
    }),
  ]);
}

/**
 * Derived financial statement for a team and season year.
 * playerSalaries come from contracts via getTeamPayroll; never from books.
 */
export function getFinancialStatement(
  state: GameState,
  teamId: TeamId,
  year: number,
): TeamFinancialStatement {
  assertTeamAndFinanceExist(state, teamId);
  assertSeasonYear(year);

  const finances = state.business.finances[teamId]!;
  const books =
    finances.booksByYear[String(year)] ?? createEmptyTeamFinanceBooks();
  const playerSalaries = getTeamPayroll(teamId, year, state);

  const tickets = books.revenue.tickets;
  const sponsorships = books.revenue.sponsorships;
  const merchandise = books.revenue.merchandise;
  const other = books.revenue.other;
  const revenueTotal = tickets + sponsorships + merchandise + other;

  const staff = books.expenses.staff;
  const facilities = books.expenses.facilities;
  const operations = books.expenses.operations;
  const marketing = books.expenses.marketing;
  const expensesTotal =
    playerSalaries + staff + facilities + operations + marketing;

  return {
    teamId,
    year,
    revenue: {
      tickets,
      sponsorships,
      merchandise,
      other,
      total: revenueTotal,
    },
    expenses: {
      playerSalaries,
      staff,
      facilities,
      operations,
      marketing,
      total: expensesTotal,
    },
    netIncome: revenueTotal - expensesTotal,
  };
}

export function getTotalRevenue(
  state: GameState,
  teamId: TeamId,
  year: number,
): number {
  return getFinancialStatement(state, teamId, year).revenue.total;
}

export function getTotalExpenses(
  state: GameState,
  teamId: TeamId,
  year: number,
): number {
  return getFinancialStatement(state, teamId, year).expenses.total;
}

export function getNetIncome(
  state: GameState,
  teamId: TeamId,
  year: number,
): number {
  return getFinancialStatement(state, teamId, year).netIncome;
}

function addToBooks(
  state: GameState,
  teamId: TeamId,
  year: number,
  update: (books: TeamFinanceBooks) => TeamFinanceBooks,
): GameState {
  const yearKey = String(year);
  const existingFinance = state.business.finances[teamId]!;
  const existingBooks =
    existingFinance.booksByYear[yearKey] ?? createEmptyTeamFinanceBooks();
  const nextBooks = update({
    revenue: { ...existingBooks.revenue },
    expenses: { ...existingBooks.expenses },
  });

  const nextFinance: TeamFinances = {
    teamId: existingFinance.teamId,
    cash: existingFinance.cash,
    payroll: existingFinance.payroll,
    booksByYear: {
      ...existingFinance.booksByYear,
      [yearKey]: nextBooks,
    },
  };

  return {
    ...state,
    business: {
      ...state.business,
      finances: {
        ...state.business.finances,
        [teamId]: nextFinance,
      },
    },
  };
}

function assertTeamAndFinanceExist(state: GameState, teamId: TeamId): void {
  if (!state.world.teams[teamId]) {
    throw new Error(`Team "${teamId}" is missing from world.teams.`);
  }
  if (!state.business.finances[teamId]) {
    throw new Error(
      `Team finances for "${teamId}" are missing from business.finances.`,
    );
  }
}

function assertRevenueCategory(category: string): asserts category is RevenueCategory {
  if (!isRevenueCategory(category)) {
    throw new Error(`Invalid revenue category "${category}".`);
  }
}

function assertExpenseCategory(category: string): asserts category is ExpenseCategory {
  if (category === "playerSalaries") {
    throw new Error(
      'Expense category "playerSalaries" is derived from contracts and cannot be posted.',
    );
  }
  if (!isExpenseCategory(category)) {
    throw new Error(`Invalid expense category "${category}".`);
  }
}

function assertNonNegativeIntegerAmount(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be an integer.`);
  }
  if (value < 0) {
    throw new Error(`${field} must be >= 0.`);
  }
}

function assertSeasonYear(year: number): void {
  if (typeof year !== "number" || !Number.isFinite(year)) {
    throw new Error("Financial period year must be a finite number.");
  }
  if (!Number.isInteger(year)) {
    throw new Error("Financial period year must be an integer.");
  }
}
