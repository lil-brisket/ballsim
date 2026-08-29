import { getCalendarMonthId } from "@/domain/calendar-date";
import {
  createEmptyTeamFinanceBooks,
  normalizeTeamFinanceBooks,
  sumBooksExpenses,
  sumBooksRevenue,
  sumOperatingExpenses,
  type TeamFinanceBooks,
  type TeamFinancialStatement,
} from "@/domain/entities/finances";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { calculateCashRunway, type CashRunwayView } from "@/state/franchise-selectors";
import { getFinancialStatement } from "@/systems/team-finances";

export type PeriodRevenueView = {
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

export type PeriodOperatingExpensesView = {
  staff: number;
  facilities: number;
  operations: number;
  marketing: number;
  total: number;
};

/**
 * Profitability — from posted accounting books.
 * Month grain: books only (no derived player salaries).
 * Season grain: includes derived playerSalaries via TeamFinancialStatement.
 */
export type ProfitabilityView = {
  revenue: PeriodRevenueView;
  operatingExpenses: PeriodOperatingExpensesView;
  /** Capital is investment, not operating expense. */
  capital: number;
  /**
   * Month: revenue − operating expenses (excludes capital and player payroll).
   * Season: statement netIncome (includes derived playerSalaries + capital).
   */
  netIncome: number;
  /** Season-only derived annual player salaries; null for month views. */
  playerSalaries: number | null;
};

/** Liquidity — businessFunds is authoritative; flow from actual movements. */
export type LiquidityView = {
  businessFunds: number;
  /** Month-open business-funds snapshot when ledger exists; else null. */
  openBusinessFunds: number | null;
  /** Sum of signed business-funds deltas recorded in the period. */
  netBusinessFundsChange: number;
  /** Actual weekly payroll cash outflows recorded in the period. */
  playerPayrollOutflow: number;
  runway: CashRunwayView;
};

/** Investment — capital spending posted in the period. */
export type InvestmentView = {
  capital: number;
};

export type FranchisePeriodPnLView = {
  periodKey: string;
  profitability: ProfitabilityView;
  liquidity: LiquidityView;
  investment: InvestmentView;
};

export type FranchisePnLView = {
  currentMonth: FranchisePeriodPnLView;
  priorMonth: FranchisePeriodPnLView | null;
  seasonToDate: FranchisePeriodPnLView;
  priorSeason: FranchisePeriodPnLView | null;
};

function revenueFromBooks(books: TeamFinanceBooks): PeriodRevenueView {
  const r = books.revenue;
  return {
    tickets: r.tickets,
    premium: r.premium,
    merchandise: r.merchandise,
    concessions: r.concessions,
    sponsorships: r.sponsorships,
    broadcast: r.broadcast,
    playoffs: r.playoffs,
    other: r.other,
    total: sumBooksRevenue(books),
  };
}

function operatingFromBooks(books: TeamFinanceBooks): PeriodOperatingExpensesView {
  return {
    staff: books.expenses.staff,
    facilities: books.expenses.facilities,
    operations: books.expenses.operations,
    marketing: books.expenses.marketing,
    total: sumOperatingExpenses(books),
  };
}

function priorCalendarMonthId(monthId: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthId);
  if (!match) {
    return null;
  }
  let year = Number(match[1]);
  let month = Number(match[2]);
  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function monthPeriodView(
  state: GameState,
  teamId: TeamId,
  monthId: string,
  runway: CashRunwayView,
): FranchisePeriodPnLView {
  const finances = state.business.finances[teamId];
  const books = normalizeTeamFinanceBooks(
    finances?.booksByMonth[monthId] ?? createEmptyTeamFinanceBooks(),
  );
  const ledger = finances?.businessFundsLedgerByMonth[monthId];
  const revenue = revenueFromBooks(books);
  const operatingExpenses = operatingFromBooks(books);
  return {
    periodKey: monthId,
    profitability: {
      revenue,
      operatingExpenses,
      capital: books.expenses.capital,
      netIncome: revenue.total - operatingExpenses.total,
      playerSalaries: null,
    },
    liquidity: {
      businessFunds: finances?.businessFunds ?? 0,
      openBusinessFunds: ledger?.openBusinessFunds ?? null,
      netBusinessFundsChange: ledger?.netBusinessFundsChange ?? 0,
      playerPayrollOutflow: ledger?.playerPayrollOutflow ?? 0,
      runway,
    },
    investment: {
      capital: books.expenses.capital,
    },
  };
}

function seasonPeriodView(
  state: GameState,
  teamId: TeamId,
  year: number,
  runway: CashRunwayView,
  statement: TeamFinancialStatement,
): FranchisePeriodPnLView {
  const finances = state.business.finances[teamId];
  const books = normalizeTeamFinanceBooks(
    finances?.booksByYear[String(year)] ?? createEmptyTeamFinanceBooks(),
  );
  return {
    periodKey: String(year),
    profitability: {
      revenue: {
        tickets: statement.revenue.tickets,
        premium: statement.revenue.premium,
        merchandise: statement.revenue.merchandise,
        concessions: statement.revenue.concessions,
        sponsorships: statement.revenue.sponsorships,
        broadcast: statement.revenue.broadcast,
        playoffs: statement.revenue.playoffs,
        other: statement.revenue.other,
        total: statement.revenue.total,
      },
      operatingExpenses: operatingFromBooks(books),
      capital: statement.expenses.capital,
      netIncome: statement.netIncome,
      playerSalaries: statement.expenses.playerSalaries,
    },
    liquidity: {
      businessFunds: finances?.businessFunds ?? 0,
      openBusinessFunds: null,
      netBusinessFundsChange: 0,
      playerPayrollOutflow: 0,
      runway,
    },
    investment: {
      capital: statement.expenses.capital,
    },
  };
}

/**
 * Derived franchise P&L: profitability (books), liquidity (cash), investment (capital).
 * Never mutates state. Does not conflate net income with cash flow.
 */
export function toFranchisePnLView(state: GameState): FranchisePnLView {
  const teamId = state.user.activeOwnerTeamId;
  const year = state.competition.season.year;
  const monthId = getCalendarMonthId(state.world.calendar.currentDate);
  const runway = calculateCashRunway(state, teamId);
  const statement = getFinancialStatement(state, teamId, year);
  const priorMonthId = priorCalendarMonthId(monthId);
  const priorYear = year - 1;
  const priorBooks = state.business.finances[teamId]?.booksByYear[String(priorYear)];

  return {
    currentMonth: monthPeriodView(state, teamId, monthId, runway),
    priorMonth: priorMonthId
      ? monthPeriodView(state, teamId, priorMonthId, runway)
      : null,
    seasonToDate: seasonPeriodView(state, teamId, year, runway, statement),
    priorSeason: priorBooks
      ? seasonPeriodView(
          state,
          teamId,
          priorYear,
          runway,
          getFinancialStatement(state, teamId, priorYear),
        )
      : null,
  };
}

/** Test helper: posted books expenses total including capital. */
export function booksExpenseTotal(books: TeamFinanceBooks): number {
  return sumBooksExpenses(books);
}
