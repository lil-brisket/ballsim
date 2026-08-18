import {
  createEmptyTeamFinanceBooks,
  isExpenseCategory,
  isRevenueCategory,
  normalizeTeamFinanceBooks,
  type ExpenseCategory,
  type RevenueCategory,
  type TeamCashMonthLedger,
  type TeamFinanceBooks,
  type TeamFinancialStatement,
  type TeamFinances,
} from "@/domain/entities/finances";
import { getCalendarMonthId } from "@/domain/calendar-date";
import {
  createDomainEvent,
  type DomainEvent,
} from "@/domain/events/domain-event";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getTeamPayroll } from "@/systems/salary-cap";

/**
 * Additive revenue posting. Does not mutate cash or payroll.
 * Posts to both booksByYear and booksByMonth (accounting only).
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

  const monthId = getCalendarMonthId(state.world.calendar.currentDate);
  const next = addToBooks(state, teamId, year, monthId, (books) => ({
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
 * Posts to both booksByYear and booksByMonth. Does not mutate cash.
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

  const monthId = getCalendarMonthId(state.world.calendar.currentDate);
  const next = addToBooks(state, teamId, year, monthId, (books) => ({
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
 * Posts books and adjusts cash by the same signed integer amount.
 * Positive amount → revenue category + cash increase.
 * Negative amount → expense category + cash decrease (absolute value posted).
 * Zero is a no-op.
 *
 * Cash ledger journal is updated for liquidity reporting; books never invent cash.
 */
export function applyCashAndBooksImpact(
  state: GameState,
  teamId: TeamId,
  amount: number,
  year: number,
  options: {
    revenueCategory?: RevenueCategory;
    expenseCategory?: ExpenseCategory;
  } = {},
): SystemResult {
  assertTeamAndFinanceExist(state, teamId);
  assertSeasonYear(year);
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error("Cash/books impact amount must be a finite number.");
  }
  if (!Number.isInteger(amount)) {
    throw new Error("Cash/books impact amount must be an integer.");
  }
  if (amount === 0) {
    return systemResult(state);
  }

  const revenueCategory = options.revenueCategory ?? "other";
  const expenseCategory = options.expenseCategory ?? "operations";
  let next = state;
  const events: DomainEvent[] = [];

  if (amount > 0) {
    const posted = recordRevenue(next, teamId, revenueCategory, amount, year);
    next = posted.state;
    events.push(...posted.events);
  } else {
    const posted = recordExpense(
      next,
      teamId,
      expenseCategory,
      Math.abs(amount),
      year,
    );
    next = posted.state;
    events.push(...posted.events);
  }

  next = applyCashDelta(next, teamId, amount, { playerPayroll: false });
  return systemResult(next, events);
}

/**
 * Adjusts cash without posting books. Used for player payroll cash flow
 * (annual obligation remains derived on the statement via getTeamPayroll).
 * Emits PlayerPayrollPaid — never ExpenseRecorded / recordExpense.
 * Updates cashLedgerByMonth.playerPayrollOutflow for monthly liquidity reporting.
 */
export function applyCashOnlyImpact(
  state: GameState,
  teamId: TeamId,
  amount: number,
  options: { period: string } = { period: "weekly" },
): SystemResult {
  assertTeamAndFinanceExist(state, teamId);
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error("Cash-only impact amount must be a finite number.");
  }
  if (!Number.isInteger(amount)) {
    throw new Error("Cash-only impact amount must be an integer.");
  }
  if (amount === 0) {
    return systemResult(state);
  }

  const next = applyCashDelta(state, teamId, amount, { playerPayroll: true });

  return systemResult(next, [
    createDomainEvent({
      type: "PlayerPayrollPaid",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        teamId,
        amount: Math.abs(amount),
        period: options.period,
        signedAmount: amount,
      },
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
  const books = normalizeTeamFinanceBooks(
    finances.booksByYear[String(year)] ?? createEmptyTeamFinanceBooks(),
  );
  const playerSalaries = getTeamPayroll(teamId, year, state);

  const tickets = books.revenue.tickets;
  const premium = books.revenue.premium;
  const merchandise = books.revenue.merchandise;
  const concessions = books.revenue.concessions;
  const sponsorships = books.revenue.sponsorships;
  const broadcast = books.revenue.broadcast;
  const playoffs = books.revenue.playoffs;
  const other = books.revenue.other;
  const revenueTotal =
    tickets +
    premium +
    merchandise +
    concessions +
    sponsorships +
    broadcast +
    playoffs +
    other;

  const staff = books.expenses.staff;
  const facilities = books.expenses.facilities;
  const capital = books.expenses.capital;
  const operations = books.expenses.operations;
  const marketing = books.expenses.marketing;
  const expensesTotal =
    playerSalaries + staff + facilities + capital + operations + marketing;

  return {
    teamId,
    year,
    revenue: {
      tickets,
      premium,
      merchandise,
      concessions,
      sponsorships,
      broadcast,
      playoffs,
      other,
      total: revenueTotal,
    },
    expenses: {
      playerSalaries,
      staff,
      facilities,
      capital,
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

function applyCashDelta(
  state: GameState,
  teamId: TeamId,
  amount: number,
  options: { playerPayroll: boolean },
): GameState {
  const existing = state.business.finances[teamId]!;
  const monthId = getCalendarMonthId(state.world.calendar.currentDate);
  const ledger = existing.cashLedgerByMonth ?? {};
  const prior = ledger[monthId];
  const openCash = prior?.openCash ?? existing.cash;
  const nextLedgerEntry: TeamCashMonthLedger = {
    openCash,
    playerPayrollOutflow:
      (prior?.playerPayrollOutflow ?? 0) +
      (options.playerPayroll ? Math.abs(amount) : 0),
    netCashChange: (prior?.netCashChange ?? 0) + amount,
  };

  return {
    ...state,
    business: {
      ...state.business,
      finances: {
        ...state.business.finances,
        [teamId]: {
          ...existing,
          cash: existing.cash + amount,
          booksByMonth: existing.booksByMonth ?? {},
          cashLedgerByMonth: {
            ...ledger,
            [monthId]: nextLedgerEntry,
          },
        },
      },
    },
  };
}

function addToBooks(
  state: GameState,
  teamId: TeamId,
  year: number,
  monthId: string,
  update: (books: TeamFinanceBooks) => TeamFinanceBooks,
): GameState {
  const yearKey = String(year);
  const existingFinance = state.business.finances[teamId]!;
  const existingYearBooks = normalizeTeamFinanceBooks(
    existingFinance.booksByYear[yearKey] ?? createEmptyTeamFinanceBooks(),
  );
  const nextYearBooks = update({
    revenue: { ...existingYearBooks.revenue },
    expenses: { ...existingYearBooks.expenses },
  });

  const booksByMonth = existingFinance.booksByMonth ?? {};
  const existingMonthBooks = normalizeTeamFinanceBooks(
    booksByMonth[monthId] ?? createEmptyTeamFinanceBooks(),
  );
  const nextMonthBooks = update({
    revenue: { ...existingMonthBooks.revenue },
    expenses: { ...existingMonthBooks.expenses },
  });

  const nextFinance: TeamFinances = {
    teamId: existingFinance.teamId,
    cash: existingFinance.cash,
    payroll: existingFinance.payroll,
    booksByYear: {
      ...existingFinance.booksByYear,
      [yearKey]: nextYearBooks,
    },
    booksByMonth: {
      ...booksByMonth,
      [monthId]: nextMonthBooks,
    },
    cashLedgerByMonth: existingFinance.cashLedgerByMonth ?? {},
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
