import Link from "next/link";
import { notFound } from "next/navigation";
import { loadFinanceHubView } from "@/application/game-service";
import {
  FinancialLedger,
  FinancialTrend,
} from "@/components/finances/FinancialLedger";
import { FinancialStatStrip } from "@/components/finances/FinancialStatStrip";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

type FinancesPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function FinancesPage({
  params,
  searchParams,
}: FinancesPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadFinanceHubView(saveId);
  if (!view) {
    notFound();
  }

  const { finances, business, pnl } = view;
  const season = pnl.seasonToDate;
  const month = pnl.currentMonth;
  const statement = finances.statement;
  const { cashRunway, lastGameDay, forecast } = business;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finances"
        subtitle={`${view.teamName} · Season ${view.seasonYear}`}
        actions={
          <Link
            href={`/dashboard/${saveId}/contracts`}
            className="text-sm text-amber-400 hover:underline"
          >
            Contracts
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      {/* 1. Financial Position */}
      <Section title="Financial Position">
        <FinancialStatStrip view={view} />
        <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
          <li className="flex justify-between">
            <span className="text-zinc-500">Projected funds</span>
            <MoneyDisplay amount={cashRunway.projectedCash} />
          </li>
          <li className="flex justify-between">
            <span className="text-zinc-500">Business runway</span>
            <span>
              {cashRunway.runwayWeeks === null
                ? "Positive through horizon"
                : `${cashRunway.runwayWeeks} weeks`}
            </span>
          </li>
        </ul>
      </Section>

      {view.warnings.length > 0 ? (
        <ManagementDecisionPanel
          title="Financial Warnings"
          items={view.warnings}
          saveId={saveId}
          currentDate={view.currentDate}
        />
      ) : null}

      {/* 2. Operating Performance */}
      <Section title="Operating Performance">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-200">
              Season revenue
            </h3>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(
                [
                  ["Tickets", season.profitability.revenue.tickets],
                  ["Premium", season.profitability.revenue.premium],
                  ["Merchandise", season.profitability.revenue.merchandise],
                  ["Concessions", season.profitability.revenue.concessions],
                  ["Sponsorships", season.profitability.revenue.sponsorships],
                  ["Broadcast", season.profitability.revenue.broadcast],
                  ["Playoffs", season.profitability.revenue.playoffs],
                  ["Other", season.profitability.revenue.other],
                ] as const
              ).map(([label, amount]) => (
                <li key={label} className="flex justify-between">
                  <span>{label}</span>
                  <MoneyDisplay amount={amount} />
                </li>
              ))}
              <li className="flex justify-between border-t border-zinc-800 pt-1 font-medium text-zinc-100">
                <span>Total</span>
                <MoneyDisplay amount={season.profitability.revenue.total} />
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-200">
              Season expenses
            </h3>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(
                [
                  [
                    "Player salaries (derived)",
                    statement.expenses.playerSalaries,
                  ],
                  ["Staff", season.profitability.operatingExpenses.staff],
                  [
                    "Facilities",
                    season.profitability.operatingExpenses.facilities,
                  ],
                  ["Capital", season.profitability.capital],
                  [
                    "Operations",
                    season.profitability.operatingExpenses.operations,
                  ],
                  [
                    "Marketing",
                    season.profitability.operatingExpenses.marketing,
                  ],
                ] as const
              ).map(([label, amount]) => (
                <li key={label} className="flex justify-between">
                  <span>{label}</span>
                  <MoneyDisplay amount={amount} />
                </li>
              ))}
              <li className="flex justify-between border-t border-zinc-800 pt-1 font-medium text-zinc-100">
                <span>Net income</span>
                <MoneyDisplay amount={season.profitability.netIncome} />
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Current month net change:{" "}
          <MoneyDisplay amount={month.liquidity.netBusinessFundsChange} />
        </p>
      </Section>

      {/* 3. Commitments */}
      <Section title="Commitments">
        <p className="mb-2 text-sm text-zinc-500">
          Commitment limits — these do not draw from Business Funds.
        </p>
        <ul className="space-y-1.5 text-sm text-zinc-300">
          <li className="flex justify-between">
            <span>Player payroll</span>
            <MoneyDisplay amount={finances.playerPayroll} />
          </li>
          <li className="flex justify-between">
            <span>Salary cap</span>
            {finances.salaryCapEnabled ? (
              <MoneyDisplay amount={finances.salaryCap} />
            ) : (
              <span>Off</span>
            )}
          </li>
          <li className="flex justify-between">
            <span>Cap space</span>
            {finances.salaryCapEnabled ? (
              <MoneyDisplay amount={finances.capSpace} />
            ) : (
              <span>—</span>
            )}
          </li>
          <li className="flex justify-between">
            <span>Staff commitments</span>
            <MoneyDisplay amount={finances.staffPayroll} />
          </li>
          <li className="flex justify-between">
            <span>Staff budget remaining</span>
            <MoneyDisplay amount={finances.staffBudgetSpace} />
          </li>
        </ul>
      </Section>

      {/* 4. Financial Activity */}
      <Section title="Financial Activity">
        <FinancialLedger entries={view.ledger} />
      </Section>

      {/* 5. Trend */}
      <Section title="Trend">
        <FinancialTrend points={view.trend} />
      </Section>

      {lastGameDay ? (
        <Section title="Last home game day">
          <ul className="space-y-1 text-sm text-zinc-300">
            <li className="flex justify-between">
              <span>Attendance</span>
              <span>{lastGameDay.attendance.toLocaleString()}</span>
            </li>
            <li className="flex justify-between">
              <span>Fill rate</span>
              <span>{lastGameDay.fillRatePct}%</span>
            </li>
            <li className="flex justify-between">
              <span>Gate revenue</span>
              <MoneyDisplay amount={lastGameDay.totalGameDayRevenue} />
            </li>
          </ul>
        </Section>
      ) : null}

      {forecast ? (
        <Section title="Next home game forecast">
          <ul className="space-y-1 text-sm text-zinc-300">
            <li className="flex justify-between">
              <span>Projected revenue</span>
              <MoneyDisplay amount={forecast.totalGameDayRevenue} />
            </li>
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
