import type { Metadata } from "next";
import { cn, linkClass } from "@/components/ui/styles";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadFinanceHubView } from "@/application/game-service";
import { CashPressureSection } from "@/components/finances/CashPressureSection";
import {
  CashRunwayChart,
  RevenueExpenseWaterfall,
} from "@/components/finances/FinanceCharts";
import { FinancialStatStrip } from "@/components/finances/FinancialStatStrip";
import { FinancesSubNav } from "@/components/finances/FinancesSubNav";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { ErrorState } from "@/components/ui/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Finances" };

type FinancesPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

function HeaderLink(props: { href: string; label: string }) {
  return (
    <Link href={props.href} className={cn(linkClass, "text-sm")}>
      {props.label}
    </Link>
  );
}

/**
 * Finances › Overview — position, runway and cash pressure. Payroll,
 * activity and arena/facility upgrades live on their own tabs (Issue #189).
 */
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
  const { cashRunway } = business;
  const opex = season.profitability.operatingExpenses;
  const base = `/dashboard/${saveId}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finances"
        subtitle={`${view.teamName} · Season ${view.seasonYear}`}
        actions={
          <>
            <HeaderLink href={`${base}/team/contracts`} label="Contracts" />
            <HeaderLink href={`${base}/business`} label="Marketing" />
            <HeaderLink href={`${base}/sponsorships`} label="Sponsorships" />
          </>
        }
      />
      <FinancesSubNav saveId={saveId} active="overview" />
      {error ? <ErrorState message={error} /> : null}

      {view.warnings.length > 0 ? (
        <ManagementDecisionPanel
          title="Financial Warnings"
          items={view.warnings}
          saveId={saveId}
          currentDate={view.currentDate}
        />
      ) : null}

      <Section title="Financial Position">
        <FinancialStatStrip view={view} />
        <div className="mt-4">
          <RevenueExpenseWaterfall
            revenue={season.profitability.revenue.total}
            expenses={[
              {
                label: "Salaries",
                amount: statement.expenses.playerSalaries,
              },
              { label: "Staff", amount: opex.staff },
              { label: "Facilities", amount: opex.facilities },
              { label: "Capital", amount: season.profitability.capital },
              { label: "Ops", amount: opex.operations },
              { label: "Marketing", amount: opex.marketing },
            ]}
          />
        </div>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-4 text-sm text-zinc-100">
          <span>
            Season net income{" "}
            <MoneyDisplay amount={season.profitability.netIncome} />
          </span>
          <span className="text-zinc-500">
            Capital this month{" "}
            <MoneyDisplay amount={month.investment.capital} />
          </span>
          <span className="text-zinc-500">
            Current month net change:{" "}
            <MoneyDisplay amount={month.liquidity.netBusinessFundsChange} />
          </span>
        </p>
      </Section>

      <Section title="Cash Runway">
        <CashRunwayChart
          cash={cashRunway.cash}
          netWeeklyBurn={cashRunway.netWeeklyBurn}
          runwayWeeks={cashRunway.runwayWeeks}
        />
        <p className="mt-2 text-sm text-zinc-300">
          <span className="text-zinc-500">Projected funds</span>{" "}
          <MoneyDisplay amount={cashRunway.projectedCash} />
          <span className="ml-4 text-zinc-500">Business runway</span>{" "}
          {cashRunway.runwayWeeks === null
            ? "Positive through horizon"
            : `${cashRunway.runwayWeeks} weeks`}
        </p>
      </Section>

      <Section title="Cash Pressure">
        <CashPressureSection cashRunway={cashRunway} />
      </Section>
    </div>
  );
}
