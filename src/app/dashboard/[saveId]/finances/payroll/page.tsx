import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadFinanceHubView } from "@/application/game-service";
import { CapSheet } from "@/components/finances/CapSheet";
import { FinancesViews } from "@/components/finances/FinancesViews";
import { PayrollRulesPanel } from "@/components/finances/PayrollRulesPanel";
import { ErrorState } from "@/components/ui/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Payroll" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Finances › Payroll — commitments, cap and luxury tax / salary floor. */
export default async function FinancesPayrollPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadFinanceHubView(saveId);
  if (!view) {
    notFound();
  }
  const { finances } = view;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finances"
        subtitle={`${view.teamName} · Season ${view.seasonYear}`}
      />
      <FinancesViews saveId={saveId} active="payroll" />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Commitments">
        <p className="mb-2 text-sm text-faint">
          Commitment limits — these do not draw from Business Funds.
        </p>
        <ul className="space-y-1.5 text-sm text-soft">
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

      <Section title="Cap sheet">
        <CapSheet view={view.capSheet} saveId={saveId} />
      </Section>

      <PayrollRulesPanel rules={view.payrollRules} />
    </div>
  );
}
