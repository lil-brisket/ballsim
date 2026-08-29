import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";
import { calculateBusinessHealth } from "@/systems/financial-health";

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
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const { finances, eventLog, franchiseBusiness, franchisePnL } = view;
  const statement = finances.statement;
  const { lastGameDay, cashRunway, forecast } = franchiseBusiness;
  const season = franchisePnL.seasonToDate;
  const month = franchisePnL.currentMonth;
  const businessHealth = calculateBusinessHealth({
    businessFunds: finances.businessFunds,
    weeklyOutflow: cashRunway.weeklyOutflow,
    netWeeklyBurn: cashRunway.netWeeklyBurn,
    runwayWeeks: cashRunway.runwayWeeks,
    projectedBusinessFunds: cashRunway.projectedCash,
  });
  const financeEvents = eventLog.filter(
    (entry) =>
      entry.type === "RevenueRecorded" ||
      entry.type === "ExpenseRecorded" ||
      entry.type === "HomeGameDaySettled",
  );

  return (
    <>
      <PageHeader
        title="Finances"
        subtitle={`Season ${statement.year} — basketball operations limits and business funds`}
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Basketball Operations">
        <p className="mb-3 text-sm text-zinc-400">
          Commitment limits only — these do not draw from Business Funds.
        </p>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Player Salary Cap"
            value={
              finances.salaryCapEnabled ? (
                <MoneyDisplay amount={finances.salaryCap} />
              ) : (
                "Off"
              )
            }
          />
          <StatCard
            label="Player Payroll"
            value={<MoneyDisplay amount={finances.playerPayroll} />}
          />
          <StatCard
            label="Cap Space"
            value={
              finances.salaryCapEnabled ? (
                <MoneyDisplay amount={finances.capSpace} />
              ) : (
                "—"
              )
            }
          />
          <StatCard
            label="Staff Budget"
            value={<MoneyDisplay amount={finances.staffBudget} />}
          />
          <StatCard
            label="Staff Commitments"
            value={<MoneyDisplay amount={finances.staffPayroll} />}
          />
          <StatCard
            label="Available Staff Budget"
            value={<MoneyDisplay amount={finances.staffBudgetSpace} />}
          />
        </section>
      </Section>

      <Section title="Business Operations">
        <p className="mb-3 text-sm text-zinc-400">
          The only actual currency pool — marketing, facilities, and franchise
          investments.
        </p>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Business Health"
            value={businessHealth.replaceAll("_", " ")}
          />
          <StatCard
            label="Business Funds"
            value={<MoneyDisplay amount={finances.businessFunds} />}
          />
          <StatCard
            label={
              cashRunway.horizonKind === "season"
                ? "Projected funds at season end"
                : "Projected funds (near term)"
            }
            value={<MoneyDisplay amount={cashRunway.projectedCash} />}
          />
          <StatCard
            label="Business runway"
            value={
              cashRunway.runwayWeeks === null
                ? "Positive through horizon"
                : `${cashRunway.runwayWeeks} weeks`
            }
          />
        </section>
        {businessHealth === "critical" || businessHealth === "tight" ? (
          <p className="mt-3 text-sm text-amber-400">
            Business funds are low. Major facility investments may be difficult.
          </p>
        ) : null}
      </Section>

      <Section title="Decision support">
        <ul className="space-y-2 text-sm text-zinc-300">
          <li className="flex justify-between">
            <span>Weekly business outflow (facilities, marketing)</span>
            <MoneyDisplay amount={cashRunway.weeklyOutflow} />
          </li>
          <li className="flex justify-between">
            <span>Expected weekly inflow (horizon average)</span>
            <MoneyDisplay amount={cashRunway.expectedWeeklyInflow} />
          </li>
          <li className="flex justify-between">
            <span>Horizon gate / sponsorship / broadcast</span>
            <span>
              <MoneyDisplay amount={cashRunway.inflowBreakdown.gate} />
              {" / "}
              <MoneyDisplay amount={cashRunway.inflowBreakdown.sponsorship} />
              {" / "}
              <MoneyDisplay amount={cashRunway.inflowBreakdown.broadcast} />
            </span>
          </li>
          <li className="flex justify-between">
            <span>Primary business pressure</span>
            <span className="capitalize">
              {cashRunway.primaryPressure.replace("_", " ")}
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Season P&amp;L">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-200">Revenue</h3>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(
                [
                  ["Tickets", season.revenue.tickets],
                  ["Premium", season.revenue.premium],
                  ["Merchandise", season.revenue.merchandise],
                  ["Concessions", season.revenue.concessions],
                  ["Sponsorships", season.revenue.sponsorships],
                  ["Broadcast", season.revenue.broadcast],
                  ["Playoffs", season.revenue.playoffs],
                  ["Other", season.revenue.other],
                ] as const
              ).map(([label, amount]) => (
                <li key={label} className="flex justify-between">
                  <span>{label}</span>
                  <MoneyDisplay amount={amount} />
                </li>
              ))}
              <li className="flex justify-between border-t border-zinc-800 pt-1 font-medium text-zinc-100">
                <span>Total</span>
                <MoneyDisplay amount={season.revenue.total} />
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-200">Expenses</h3>
            <ul className="space-y-1 text-sm text-zinc-300">
              {(
                [
                  ["Player salaries (derived)", statement.expenses.playerSalaries],
                  ["Staff (books)", season.expenses.staff],
                  ["Facilities", season.expenses.facilities],
                  ["Capital", season.expenses.capital],
                  ["Operations", season.expenses.operations],
                  ["Marketing", season.expenses.marketing],
                ] as const
              ).map(([label, amount]) => (
                <li key={label} className="flex justify-between">
                  <span>{label}</span>
                  <MoneyDisplay amount={amount} />
                </li>
              ))}
              <li className="flex justify-between border-t border-zinc-800 pt-1 font-medium text-zinc-100">
                <span>Books total</span>
                <MoneyDisplay amount={season.expenses.total} />
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-4 flex justify-between text-sm font-medium text-zinc-100">
          <span>Net income (books)</span>
          <MoneyDisplay amount={season.netIncome} />
        </p>
      </Section>

      <Section title="Current month">
        <ul className="space-y-1 text-sm text-zinc-300">
          {(
            [
              ["Business Funds", month.liquidity.businessFunds],
              ["Net change", month.liquidity.netBusinessFundsChange],
            ] as const
          ).map(([label, amount]) => (
            <li key={label} className="flex justify-between">
              <span>{label}</span>
              <MoneyDisplay amount={amount} />
            </li>
          ))}
        </ul>
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

      <Section title="Recent business events">
        {financeEvents.length === 0 ? (
          <EmptyState message="No finance events recorded yet." />
        ) : (
          <ul className="space-y-2 text-sm text-zinc-300">
            {financeEvents.slice(-20).reverse().map((entry) => (
              <li
                key={`${entry.type}-${entry.occurredOn}-${JSON.stringify(entry.payload)}`}
                className="flex justify-between gap-4 border-b border-zinc-900 py-1"
              >
                <span>
                  {entry.type} · {entry.occurredOn}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
