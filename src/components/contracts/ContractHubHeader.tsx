import { TaxLineNote } from "@/components/finances/PayrollRulesPanel";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TickerBar } from "@/components/ui/TickerBar";
import type { ContractHubView } from "@/state/contract-hub-selectors";

/**
 * Contract hub header: broadcast heading plus a payroll/cap ticker.
 */
export function ContractHubHeader(props: { view: ContractHubView }) {
  const { view } = props;
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <SectionHeading
          as="h1"
          size="lg"
          eyebrow="Contract management"
          title={view.teamName}
        />
        <p className="text-sm text-zinc-300">Season {view.seasonYear}</p>
        <TaxLineNote rules={view.payrollRules} />
      </div>
      <TickerBar
        aria-label="Payroll and cap"
        items={[
          {
            label: "Payroll",
            value: <MoneyDisplay amount={view.playerPayroll} />,
            tone: "team",
          },
          {
            label: "Cap",
            value: view.salaryCapEnabled ? (
              <MoneyDisplay amount={view.salaryCap} />
            ) : (
              "Off"
            ),
          },
          {
            label: "Cap space",
            value: view.salaryCapEnabled ? (
              <MoneyDisplay amount={view.capSpace} />
            ) : (
              "—"
            ),
          },
          { label: "Players", value: String(view.overview.playerCount) },
          { label: "Expiring", value: String(view.overview.expiringCount) },
        ]}
      />
    </header>
  );
}
