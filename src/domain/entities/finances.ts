import type { TeamId } from "@/domain/ids";

/**
 * Chart of accounts — posted categories only.
 *
 * Accounting books (booksByYear / booksByMonth) record posted revenue and
 * expenses. They are NOT a cash ledger. businessFunds on TeamFinances is the
 * authoritative business-ops currency. Player salary cap and staff budget are
 * separate commitment limits and never draw from businessFunds.
 *
 * playerSalaries is derived from contracts on statements — never posted.
 */

export const REVENUE_CATEGORIES = [
  "tickets",
  "premium",
  "merchandise",
  "concessions",
  "sponsorships",
  "broadcast",
  "playoffs",
  "other",
] as const;

export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number];

/** Posted expense categories only. playerSalaries is derived, never posted. */
export const EXPENSE_CATEGORIES = [
  "staff",
  "facilities",
  "capital",
  "operations",
  "marketing",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Persisted accounting books (per season year or per calendar month).
 * All amounts are finite, non-negative integer dollars.
 * playerSalaries, totals, and netIncome must never appear here.
 */
export type TeamFinanceBooks = {
  revenue: {
    tickets: number;
    premium: number;
    merchandise: number;
    concessions: number;
    sponsorships: number;
    broadcast: number;
    playoffs: number;
    other: number;
  };
  expenses: {
    staff: number;
    facilities: number;
    capital: number;
    operations: number;
    marketing: number;
  };
};

/**
 * Business-funds journal for a calendar month (YYYY-MM).
 * Never mutates businessFunds; written only as a side effect of mutators.
 * openBusinessFunds is the balance immediately before the first mutation in the month.
 * Player/staff payroll no longer posts here (commitment limits only).
 */
export type TeamBusinessFundsMonthLedger = {
  openBusinessFunds: number;
  /** @deprecated Always 0 — player payroll no longer drains business funds. */
  playerPayrollOutflow: number;
  /** Sum of all signed business-funds deltas in this month. */
  netBusinessFundsChange: number;
};

/** @deprecated Use TeamBusinessFundsMonthLedger. */
export type TeamCashMonthLedger = TeamBusinessFundsMonthLedger;

/**
 * Authoritative team finance record under business.finances.
 *
 * businessFunds — business-ops currency source of truth (only actual cash pool).
 * booksByYear / booksByMonth — posted accounting only (not currency).
 * businessFundsLedgerByMonth — derived liquidity reporting from business mutations.
 * payroll — snapshot only; statement salaries derive from contracts.
 */
export type TeamFinances = {
  teamId: TeamId;
  businessFunds: number;
  payroll: number;
  /** Keys are String(seasonYear) matching contract salaryByYear convention. */
  booksByYear: Record<string, TeamFinanceBooks>;
  /**
   * Keys are String(seasonYear). Total home attendance (regular + playoff home
   * games) for that completed/in-progress season. Keyed by stable teamId —
   * relocation/rename does not re-key this map. Not pruned at season rollover;
   * FranchiseSeasonRecord.attendance is the durable historical copy.
   */
  attendanceByYear: Record<string, number>;
  /** Keys are YYYY-MM calendar months. Accounting projection only. */
  booksByMonth: Record<string, TeamFinanceBooks>;
  /** Keys are YYYY-MM. Business-funds journal; never used to invent funds. */
  businessFundsLedgerByMonth: Record<string, TeamBusinessFundsMonthLedger>;
};

/**
 * Derived financial statement. Never persisted on TeamFinances / TeamFinanceBooks.
 * Season grain includes derived playerSalaries; monthly views exclude them from
 * books-based net income (see franchise P&L selector).
 */
export type TeamFinancialStatement = {
  teamId: TeamId;
  year: number;
  revenue: {
    tickets: number;
    premium: number;
    merchandise: number;
    concessions: number;
    sponsorships: number;
    broadcast: number;
    playoffs: number;
    other: number;
    total: number;
  };
  expenses: {
    playerSalaries: number;
    staff: number;
    facilities: number;
    capital: number;
    operations: number;
    marketing: number;
    total: number;
  };
  netIncome: number;
};

export function isRevenueCategory(value: string): value is RevenueCategory {
  return (REVENUE_CATEGORIES as readonly string[]).includes(value);
}

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function createEmptyTeamFinanceBooks(): TeamFinanceBooks {
  return {
    revenue: {
      tickets: 0,
      premium: 0,
      merchandise: 0,
      concessions: 0,
      sponsorships: 0,
      broadcast: 0,
      playoffs: 0,
      other: 0,
    },
    expenses: {
      staff: 0,
      facilities: 0,
      capital: 0,
      operations: 0,
      marketing: 0,
    },
  };
}

/** Normalize legacy books missing new categories to current shape (zeros). */
export function normalizeTeamFinanceBooks(
  raw: Partial<TeamFinanceBooks> & {
    revenue?: Partial<TeamFinanceBooks["revenue"]>;
    expenses?: Partial<TeamFinanceBooks["expenses"]>;
  },
): TeamFinanceBooks {
  const empty = createEmptyTeamFinanceBooks();
  return {
    revenue: {
      tickets: raw.revenue?.tickets ?? empty.revenue.tickets,
      premium: raw.revenue?.premium ?? empty.revenue.premium,
      merchandise: raw.revenue?.merchandise ?? empty.revenue.merchandise,
      concessions: raw.revenue?.concessions ?? empty.revenue.concessions,
      sponsorships: raw.revenue?.sponsorships ?? empty.revenue.sponsorships,
      broadcast: raw.revenue?.broadcast ?? empty.revenue.broadcast,
      playoffs: raw.revenue?.playoffs ?? empty.revenue.playoffs,
      other: raw.revenue?.other ?? empty.revenue.other,
    },
    expenses: {
      staff: raw.expenses?.staff ?? empty.expenses.staff,
      facilities: raw.expenses?.facilities ?? empty.expenses.facilities,
      capital: raw.expenses?.capital ?? empty.expenses.capital,
      operations: raw.expenses?.operations ?? empty.expenses.operations,
      marketing: raw.expenses?.marketing ?? empty.expenses.marketing,
    },
  };
}

export function sumBooksRevenue(books: TeamFinanceBooks): number {
  const r = books.revenue;
  return (
    r.tickets +
    r.premium +
    r.merchandise +
    r.concessions +
    r.sponsorships +
    r.broadcast +
    r.playoffs +
    r.other
  );
}

export function sumBooksExpenses(books: TeamFinanceBooks): number {
  const e = books.expenses;
  return e.staff + e.facilities + e.capital + e.operations + e.marketing;
}

/** Operating expenses exclude capital (investment). */
export function sumOperatingExpenses(books: TeamFinanceBooks): number {
  const e = books.expenses;
  return e.staff + e.facilities + e.operations + e.marketing;
}
