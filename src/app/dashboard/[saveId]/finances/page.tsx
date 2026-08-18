import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";

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
  const financeEvents = eventLog.filter(
    (entry) =>
      entry.type === "RevenueRecorded" ||
      entry.type === "ExpenseRecorded" ||
      entry.type === "HomeGameDaySettled" ||
      entry.type === "PlayerPayrollPaid",
  );

  return (
    <>
      <PageHeader
        title="Finances"
        subtitle={`Season ${statement.year} — profitability, liquidity, and investment`}
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Financial health"
          value={cashRunway.health.replaceAll("_", " ")}
        />
        <StatCard
          label="Cash balance"
          value={<MoneyDisplay amount={finances.cash} />}
        />
        <StatCard
          label={
            cashRunway.horizonKind === "season"
              ? "Projected cash at season end"
              : "Projected cash (near term)"
          }
          value={<MoneyDisplay amount={cashRunway.projectedCash} />}
        />
        <StatCard
          label="Cash runway"
          value={
            cashRunway.runwayWeeks === null
              ? "Positive through horizon"
              : `${cashRunway.runwayWeeks} weeks`
          }
        />
      </section>

      <Section title="Decision support">
        <ul className="space-y-2 text-sm text-zinc-300">
          <li className="flex justify-between">
            <span>Weekly outflow (payroll, staff, facilities, marketing)</span>
            <MoneyDisplay amount={cashRunway.weeklyOutflow} />
          </li>
          <li className="flex justify-between">
            <span>Player payroll (weekly)</span>
            <MoneyDisplay amount={cashRunway.outflowBreakdown.playerPayroll} />
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
            <span>Primary pressure</span>
            <span className="capitalize">
              {cashRunway.primaryPressure.replace("_", " ")}
              {cashRunway.weeklyOutflow > 0
                ? ` (${Math.round(
                    ((cashRunway.primaryPressure === "player_payroll"
                      ? cashRunway.outflowBreakdown.playerPayroll
                      : cashRunway.outflowBreakdown[
                          cashRunway.primaryPressure
                        ]) /
                      cashRunway.weeklyOutflow) *
                      100,
                  )}% of outflow)`
                : ""}
            </span>
          </li>
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          Projection is constant-condition — it does not simulate future
          attendance. Annual statement player salaries are the contract
          obligation; cash payroll is the weekly drain included in outflow.
          Profit ≠ cash: capital investment reduces cash without being an
          operating expense.
        </p>
      </Section>

      <div className="grid gap-8 lg:grid-cols-3">
        <Section title="Profitability (season)">
          <CategoryList
            rows={[
              ["Tickets", season.profitability.revenue.tickets],
              ["Premium", season.profitability.revenue.premium],
              ["Merchandise", season.profitability.revenue.merchandise],
              ["Concessions", season.profitability.revenue.concessions],
              ["Sponsorships", season.profitability.revenue.sponsorships],
              ["Broadcast", season.profitability.revenue.broadcast],
              ["Playoff bonuses", season.profitability.revenue.playoffs],
              ["Other", season.profitability.revenue.other],
              ["Total revenue", season.profitability.revenue.total],
              [
                "Player salaries (derived)",
                season.profitability.playerSalaries ?? 0,
              ],
              ["Staff", season.profitability.operatingExpenses.staff],
              ["Facilities (opex)", season.profitability.operatingExpenses.facilities],
              ["Operations", season.profitability.operatingExpenses.operations],
              ["Marketing", season.profitability.operatingExpenses.marketing],
              ["Net income", season.profitability.netIncome],
            ]}
          />
        </Section>
        <Section title={`Liquidity (month ${month.periodKey})`}>
          <CategoryList
            rows={[
              ["Cash", month.liquidity.cash],
              ["Month cash change", month.liquidity.netCashChange],
              [
                "Player payroll (cash, this month)",
                month.liquidity.playerPayrollOutflow,
              ],
              [
                "Month open cash",
                month.liquidity.openCash ?? 0,
              ],
            ]}
          />
        </Section>
        <Section title="Investment">
          <CategoryList
            rows={[
              ["Capital (season)", season.investment.capital],
              ["Capital (month)", month.investment.capital],
              [
                "Month operating net",
                month.profitability.netIncome,
              ],
            ]}
          />
        </Section>
      </div>

      <Section title="Last home game-day (historical)">
        {lastGameDay === null ? (
          <EmptyState message="No HomeGameDaySettled event yet." />
        ) : (
          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex justify-between">
              <span>Date</span>
              <span>{lastGameDay.occurredOn}</span>
            </li>
            <li className="flex justify-between">
              <span>Attendance</span>
              <span>
                {lastGameDay.attendance.toLocaleString()} (
                {lastGameDay.fillRatePct}% fill)
              </span>
            </li>
            <li className="flex justify-between">
              <span>GA / Premium seats</span>
              <span>
                {lastGameDay.gaAttendance.toLocaleString()} /{" "}
                {lastGameDay.premiumOccupancy.toLocaleString()}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Tickets</span>
              <MoneyDisplay amount={lastGameDay.ticketRevenue} />
            </li>
            <li className="flex justify-between">
              <span>Premium</span>
              <MoneyDisplay amount={lastGameDay.premiumRevenue} />
            </li>
            <li className="flex justify-between">
              <span>Merchandise</span>
              <MoneyDisplay amount={lastGameDay.merchRevenue} />
            </li>
            <li className="flex justify-between">
              <span>Concessions</span>
              <MoneyDisplay amount={lastGameDay.concessionsRevenue} />
            </li>
            <li className="flex justify-between">
              <span>Revenue / attendee</span>
              <span>
                {lastGameDay.revenuePerAttendee === null ? (
                  "—"
                ) : (
                  <MoneyDisplay amount={lastGameDay.revenuePerAttendee} />
                )}
              </span>
            </li>
            <li className="mt-2 text-xs text-zinc-500">
              Forecast next game-day total:{" "}
              <MoneyDisplay amount={forecast.totalGameDayRevenue} /> (live
              estimate, not historical)
            </li>
          </ul>
        )}
      </Section>

      <Section title="Recent financial events">
        {financeEvents.length === 0 ? (
          <EmptyState message="No revenue/expense events in the event log yet." />
        ) : (
          <ul className="space-y-2">
            {financeEvents.slice(0, 20).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-2 text-sm"
              >
                <div>
                  <p className="text-zinc-200">{entry.description}</p>
                  <p className="font-mono text-xs text-zinc-600">
                    {entry.occurredOn}
                  </p>
                </div>
                {entry.amount !== null ? (
                  <MoneyDisplay amount={entry.amount} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function CategoryList(props: { rows: Array<[string, number]> }) {
  return (
    <ul className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      {props.rows.map(([label, amount]) => (
        <li
          key={label}
          className="flex items-center justify-between text-sm text-zinc-300"
        >
          <span>{label}</span>
          <MoneyDisplay amount={amount} className="text-zinc-100" />
        </li>
      ))}
    </ul>
  );
}
