import {
  assertNumber,
  fail,
  assertRecord,
} from "@/persistence/validate-game-state/primitives";

const BOOKS_BY_YEAR_KEY_PATTERN = /^\d+$/;

function assertNonNegativeIntegerMoney(value: unknown, path: string): void {
  assertNumber(value, path);
  if (!Number.isInteger(value)) {
    fail(`${path} must be an integer.`);
  }
  if (value < 0) {
    fail(`${path} must be >= 0.`);
  }
}

export function validateTeamFinanceBooksByYear(
  booksByYear: Record<string, unknown>,
  path: string,
): void {
  for (const [yearKey, booksValue] of Object.entries(booksByYear)) {
    if (!BOOKS_BY_YEAR_KEY_PATTERN.test(yearKey)) {
      fail(`${path} key "${yearKey}" must match /^\\d+$/.`);
    }
    const year = Number(yearKey);
    if (!Number.isInteger(year)) {
      fail(`${path} key "${yearKey}" must represent a finite integer year.`);
    }

    validateTeamFinanceBooksShape(booksValue, `${path}[${yearKey}]`);
  }
}

const BOOKS_BY_MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

export function validateTeamFinanceBooksByMonth(
  booksByMonth: Record<string, unknown>,
  path: string,
): void {
  for (const [monthKey, booksValue] of Object.entries(booksByMonth)) {
    if (!BOOKS_BY_MONTH_KEY_PATTERN.test(monthKey)) {
      fail(`${path} key "${monthKey}" must match YYYY-MM.`);
    }
    validateTeamFinanceBooksShape(booksValue, `${path}[${monthKey}]`);
  }
}

export function validateCashLedgerByMonth(
  ledger: Record<string, unknown>,
  path: string,
): void {
  for (const [monthKey, entry] of Object.entries(ledger)) {
    if (!BOOKS_BY_MONTH_KEY_PATTERN.test(monthKey)) {
      fail(`${path} key "${monthKey}" must match YYYY-MM.`);
    }
    const entryPath = `${path}[${monthKey}]`;
    assertRecord(entry, entryPath);
    const openBusinessFunds =
      typeof entry.openBusinessFunds === "number"
        ? entry.openBusinessFunds
        : entry.openCash;
    assertNumber(openBusinessFunds, `${entryPath}.openBusinessFunds`);
    assertNonNegativeIntegerMoney(
      entry.playerPayrollOutflow,
      `${entryPath}.playerPayrollOutflow`,
    );
    const netBusinessFundsChange =
      typeof entry.netBusinessFundsChange === "number"
        ? entry.netBusinessFundsChange
        : entry.netCashChange;
    assertNumber(netBusinessFundsChange, `${entryPath}.netBusinessFundsChange`);
    if (!Number.isInteger(netBusinessFundsChange)) {
      fail(`${entryPath}.netBusinessFundsChange must be an integer.`);
    }
  }
}

function validateTeamFinanceBooksShape(
  booksValue: unknown,
  booksPath: string,
): void {
  assertRecord(booksValue, booksPath);
  assertRecord(booksValue.revenue, `${booksPath}.revenue`);
  assertRecord(booksValue.expenses, `${booksPath}.expenses`);

  for (const category of [
    "tickets",
    "premium",
    "merchandise",
    "concessions",
    "sponsorships",
    "broadcast",
    "playoffs",
    "other",
  ] as const) {
    assertNonNegativeIntegerMoney(
      booksValue.revenue[category],
      `${booksPath}.revenue.${category}`,
    );
  }

  for (const category of [
    "staff",
    "facilities",
    "capital",
    "operations",
    "marketing",
  ] as const) {
    assertNonNegativeIntegerMoney(
      booksValue.expenses[category],
      `${booksPath}.expenses.${category}`,
    );
  }
}
