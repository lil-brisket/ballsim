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

  const { finances, eventLog } = view;
  const statement = finances.statement;
  const financeEvents = eventLog.filter(
    (entry) =>
      entry.type === "RevenueRecorded" || entry.type === "ExpenseRecorded",
  );

  return (
    <>
      <PageHeader
        title="Finances"
        subtitle={`Season ${statement.year} statement from getFinancialStatement`}
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cash"
          value={<MoneyDisplay amount={finances.cash} />}
        />
        <StatCard
          label="Payroll (derived)"
          value={<MoneyDisplay amount={statement.expenses.playerSalaries} />}
        />
        <StatCard
          label="Revenue"
          value={<MoneyDisplay amount={statement.revenue.total} />}
        />
        <StatCard
          label="Net income"
          value={<MoneyDisplay amount={statement.netIncome} />}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Revenue">
          <CategoryList
            rows={[
              ["Tickets", statement.revenue.tickets],
              ["Sponsorships", statement.revenue.sponsorships],
              ["Merchandise", statement.revenue.merchandise],
              ["Other", statement.revenue.other],
            ]}
          />
        </Section>
        <Section title="Expenses">
          <CategoryList
            rows={[
              ["Player salaries", statement.expenses.playerSalaries],
              ["Staff", statement.expenses.staff],
              ["Facilities", statement.expenses.facilities],
              ["Operations", statement.expenses.operations],
              ["Marketing", statement.expenses.marketing],
            ]}
          />
        </Section>
      </div>

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
