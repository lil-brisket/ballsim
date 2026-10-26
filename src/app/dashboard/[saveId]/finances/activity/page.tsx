import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadFinanceHubView } from "@/application/game-service";
import {
  FinancialLedger,
  FinancialTrend,
} from "@/components/finances/FinancialLedger";
import { FinancesSubNav } from "@/components/finances/FinancesSubNav";
import { ErrorState } from "@/components/ui/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Financial Activity" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Finances › Activity — monthly trend, ledger and home game days. */
export default async function FinancesActivityPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadFinanceHubView(saveId);
  if (!view) {
    notFound();
  }
  const { lastGameDay, forecast } = view.business;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finances"
        subtitle={`${view.teamName} · Season ${view.seasonYear}`}
      />
      <FinancesSubNav saveId={saveId} active="activity" />
      {error ? <ErrorState message={error} /> : null}

      {lastGameDay || forecast ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {lastGameDay ? (
            <Section title="Last home game day">
              <ul className="space-y-1 text-sm text-soft">
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
              <ul className="space-y-1 text-sm text-soft">
                <li className="flex justify-between">
                  <span>Projected revenue</span>
                  <MoneyDisplay amount={forecast.totalGameDayRevenue} />
                </li>
              </ul>
            </Section>
          ) : null}
        </section>
      ) : null}

      <Section title="Trend">
        <FinancialTrend points={view.trend} />
      </Section>

      <Section title="Financial Activity">
        <FinancialLedger entries={view.ledger} />
      </Section>
    </div>
  );
}
