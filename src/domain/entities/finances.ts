import type { TeamId } from "@/domain/ids";

export const REVENUE_CATEGORIES = [
  "tickets",
  "sponsorships",
  "merchandise",
  "other",
] as const;

export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number];

/** Posted expense categories only. playerSalaries is derived, never posted. */
export const EXPENSE_CATEGORIES = [
  "staff",
  "facilities",
  "operations",
  "marketing",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Persisted per-season accounting books.
 * All amounts are finite, non-negative integer dollars.
 * playerSalaries, totals, and netIncome must never appear here.
 */
export type TeamFinanceBooks = {
  revenue: {
    tickets: number;
    sponsorships: number;
    merchandise: number;
    other: number;
  };
  expenses: {
    staff: number;
    facilities: number;
    operations: number;
    marketing: number;
  };
};

/**
 * Authoritative team finance record under business.finances.
 * cash is an existing balance; revenue/expense posting does not mutate it.
 * payroll is a snapshot only; statement salaries derive from contracts.
 */
export type TeamFinances = {
  teamId: TeamId;
  cash: number;
  payroll: number;
  /** Keys are String(seasonYear) matching contract salaryByYear convention. */
  booksByYear: Record<string, TeamFinanceBooks>;
};

/**
 * Derived financial statement. Never persisted on TeamFinances / TeamFinanceBooks.
 */
export type TeamFinancialStatement = {
  teamId: TeamId;
  year: number;
  revenue: {
    tickets: number;
    sponsorships: number;
    merchandise: number;
    other: number;
    total: number;
  };
  expenses: {
    playerSalaries: number;
    staff: number;
    facilities: number;
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
      sponsorships: 0,
      merchandise: 0,
      other: 0,
    },
    expenses: {
      staff: 0,
      facilities: 0,
      operations: 0,
      marketing: 0,
    },
  };
}
