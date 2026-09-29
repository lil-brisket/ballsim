import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CashPressureSection } from "@/components/finances/CashPressureSection";
import { FinancialLedger, FinancialTrend } from "@/components/finances/FinancialLedger";
import { FinancialStatStrip } from "@/components/finances/FinancialStatStrip";
import type { CashRunwayView } from "@/state/franchise-selectors";
import type { FinanceHubView } from "@/state/finance-hub-selectors";

afterEach(() => {
  cleanup();
});

const cashRunway: CashRunwayView = {
  cash: 10_000_000,
  weeklyOutflow: 200_000,
  expectedWeeklyInflow: 150_000,
  netWeeklyBurn: 50_000,
  runwayWeeks: 12,
  projectedCash: 9_000_000,
  horizonEndDate: "2026-12-01",
  horizonKind: "season",
  inflowBreakdown: { gate: 80_000, sponsorship: 40_000, broadcast: 30_000 },
  outflowBreakdown: {
    playerPayroll: 0,
    staff: 20_000,
    facilities: 100_000,
    marketing: 10_000,
  },
  primaryPressure: "facilities",
  health: "stable",
};

function emptyPnLPeriod(periodKey: string) {
  return {
    periodKey,
    profitability: {
      revenue: {
        tickets: 0,
        premium: 0,
        merchandise: 0,
        concessions: 0,
        sponsorships: 0,
        broadcast: 0,
        playoffs: 0,
        other: 0,
        total: 0,
      },
      operatingExpenses: {
        staff: 0,
        facilities: 0,
        operations: 0,
        marketing: 0,
        total: 0,
      },
      capital: 0,
      netIncome: 0,
      playerSalaries: null,
    },
    liquidity: {
      businessFunds: 10_000_000,
      openBusinessFunds: null,
      netBusinessFundsChange: 0,
      playerPayrollOutflow: 0,
      runway: cashRunway,
    },
    investment: { capital: 0 },
  };
}

const financeView = {
  saveId: "save_1",
  teamName: "Harbor Waves",
  currentDate: "2026-10-01",
  seasonYear: 2026,
  finances: {
    businessFunds: 10_000_000,
    playerPayroll: 80_000_000,
    salaryCap: 0,
    salaryCapEnabled: false,
    capSpace: 0,
    staffPayroll: 5_000_000,
    staffBudget: 8_000_000,
    staffBudgetSpace: 3_000_000,
    payrollSnapshot: {
      player: 80_000_000,
      staff: 5_000_000,
      total: 85_000_000,
    },
    statement: {
      revenue: {
        tickets: 0,
        premium: 0,
        merchandise: 0,
        concessions: 0,
        sponsorships: 0,
        broadcast: 0,
        playoffs: 0,
        other: 0,
        total: 0,
      },
      expenses: {
        playerSalaries: 0,
        staff: 0,
        facilities: 0,
        capital: 0,
        operations: 0,
        marketing: 0,
        total: 0,
      },
      netIncome: 0,
    },
  },
  business: { cashRunway },
  pnl: {
    currentMonth: emptyPnLPeriod("2026-10"),
    priorMonth: null,
    seasonToDate: emptyPnLPeriod("2026"),
    priorSeason: null,
  },
  businessHealth: "stable",
  warnings: [],
  decisions: [],
  ledger: [],
  trend: [],
} as unknown as FinanceHubView;

describe("Finance hub UI", () => {
  it("keeps the position strip compact", () => {
    const { unmount } = render(<FinancialStatStrip view={financeView} />);
    expect(screen.getByText("Business funds")).toBeTruthy();
    expect(screen.getByText("Health")).toBeTruthy();
    expect(screen.queryByText("Primary pressure")).toBeNull();
    expect(screen.queryByText("Projected funds")).toBeNull();
    unmount();
  });

  it("explains cash pressure without requiring the ledger", () => {
    const { unmount } = render(<CashPressureSection cashRunway={cashRunway} />);
    expect(screen.getByText("Primary pressure")).toBeTruthy();
    expect(screen.getByText("facilities")).toBeTruthy();
    expect(screen.getByText("Facility spending")).toBeTruthy();
    expect(screen.getByText("Biggest inflow")).toBeTruthy();
    unmount();
  });

  it("keeps ledger and trend empty states intact", () => {
    const { unmount: unmountLedger } = render(<FinancialLedger entries={[]} />);
    expect(screen.getByText("No finance events recorded yet.")).toBeTruthy();
    unmountLedger();
    const { unmount } = render(<FinancialTrend points={[]} />);
    expect(
      screen.getByText("No monthly financial history available yet."),
    ).toBeTruthy();
    unmount();
  });
});
