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

  const { finances, eventLog, franchiseBusiness } = view;
  const statement = finances.statement;
  const { lastGameDay, cashRunway, forecast } = franchiseBusiness;
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
        subtitle={`Season ${statement.year} — cash, runway, and statement are separate concepts`}
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cash balance"
          value={<MoneyDisplay amount={finances.cash} />}
        />
        <StatCard
          label="Cash runway"
          value={
            cashRunway.runwayWeeks === null
              ? "No net burn"
              : `${cashRunway.runwayWeeks} weeks`
          }
        />
        <StatCard
          label="Payroll (annual, derived)"
          value={<MoneyDisplay amount={statement.expenses.playerSalaries} />}
        />
        <StatCard
          label="Net income (annual)"
          value={<MoneyDisplay amount={statement.netIncome} />}
        />
      </section>

      <Section title="Cash flow estimate (weekly)">
        <ul className="space-y-2 text-sm text-zinc-300">
          <li className="flex justify-between">
            <span>Weekly outflow (staff / facilities / marketing)</span>
            <MoneyDisplay amount={cashRunway.weeklyOutflow} />
          </li>
          <li className="flex justify-between">
            <span>Expected weekly inflow (approx. from forecast)</span>
            <MoneyDisplay amount={cashRunway.expectedWeeklyInflow} />
          </li>
          <li className="flex justify-between">
            <span>Net weekly burn</span>
            <MoneyDisplay amount={cashRunway.netWeeklyBurn} />
          </li>
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          Player salaries appear on the annual statement from contracts. Periodic
          cash payroll is separate when enabled.
        </p>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Revenue">
          <CategoryList
            rows={[
              ["Tickets", statement.revenue.tickets],
              ["Sponsorships", statement.revenue.sponsorships],
              ["Merchandise", statement.revenue.merchandise],
              ["Other (incl. concessions)", statement.revenue.other],
            ]}
          />
        </Section>
        <Section title="Expenses">
          <CategoryList
            rows={[
              ["Player salaries (derived)", statement.expenses.playerSalaries],
              ["Staff", statement.expenses.staff],
              ["Facilities", statement.expenses.facilities],
              ["Operations", statement.expenses.operations],
              ["Marketing", statement.expenses.marketing],
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
              <span>Tickets</span>
              <MoneyDisplay amount={lastGameDay.ticketRevenue} />
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
