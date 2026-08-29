import {
  createEmptyTeamFinanceBooks,
  isExpenseCategory,
  isRevenueCategory,
  normalizeTeamFinanceBooks,
  type ExpenseCategory,
  type RevenueCategory,
  type TeamBusinessFundsMonthLedger,
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
 * Additive revenue posting. Does not mutate businessFunds or payroll.
 * Posts to both booksByYear and booksByMonth (accounting only).
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
 * Posts to both booksByYear and booksByMonth. Does not mutate businessFunds.
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
 * Posts books and adjusts businessFunds by the same signed integer amount.
 * Positive amount → revenue category + businessFunds increase.
 * Negative amount → expense category + businessFunds decrease (absolute value posted).
 * Zero is a no-op.
 *
 * Never used for player or staff payroll (those are commitment limits).
 */
export function applyBusinessFundsImpact(
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
    throw new Error("Business funds impact amount must be a finite number.");
  }
  if (!Number.isInteger(amount)) {
    throw new Error("Business funds impact amount must be an integer.");
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

  next = applyBusinessFundsDelta(next, teamId, amount);
  return systemResult(next, events);
}

/** @deprecated Use applyBusinessFundsImpact. */
export const applyCashAndBooksImpact = applyBusinessFundsImpact;

/**
 * @deprecated Player payroll no longer drains business funds.
 * Kept as a no-op for call-site migration; prefer removing callers.
 */
export function applyCashOnlyImpact(
  state: GameState,
  _teamId: TeamId,
  _amount: number,
  _options: { period: string } = { period: "weekly" },
): SystemResult {
  return systemResult(state);
}

/**
 * Throws if the team lacks sufficient business funds for a spend.
 */
export function assertSufficientBusinessFunds(
  state: GameState,
  teamId: TeamId,
  amount: number,
  action: string,
): void {
  assertTeamAndFinanceExist(state, teamId);
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    throw new Error(`${action}: amount must be a non-negative finite number.`);
  }
  const funds = state.business.finances[teamId]!.businessFunds;
  if (funds < amount) {
    throw new Error(
      `${action} requires $${amount.toLocaleString()} in business funds (available: $${funds.toLocaleString()}).`,
    );
  }
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

function applyBusinessFundsDelta(
  state: GameState,
  teamId: TeamId,
  amount: number,
): GameState {
  const existing = state.business.finances[teamId]!;
  const monthId = getCalendarMonthId(state.world.calendar.currentDate);
  const ledger = existing.businessFundsLedgerByMonth ?? {};
  const prior = ledger[monthId];
  const openBusinessFunds = prior?.openBusinessFunds ?? existing.businessFunds;
  const nextLedgerEntry: TeamBusinessFundsMonthLedger = {
    openBusinessFunds,
    playerPayrollOutflow: prior?.playerPayrollOutflow ?? 0,
    netBusinessFundsChange: (prior?.netBusinessFundsChange ?? 0) + amount,
  };

  return {
    ...state,
    business: {
      ...state.business,
      finances: {
        ...state.business.finances,
        [teamId]: {
          ...existing,
          businessFunds: existing.businessFunds + amount,
          booksByMonth: existing.booksByMonth ?? {},
          businessFundsLedgerByMonth: {
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
    businessFunds: existingFinance.businessFunds,
    payroll: existingFinance.payroll,
    booksByYear: {
      ...existingFinance.booksByYear,
      [yearKey]: nextYearBooks,
    },
    attendanceByYear: existingFinance.attendanceByYear ?? {},
    booksByMonth: {
      ...booksByMonth,
      [monthId]: nextMonthBooks,
    },
    businessFundsLedgerByMonth: existingFinance.businessFundsLedgerByMonth ?? {},
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
