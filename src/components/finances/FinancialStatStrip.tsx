import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type { FinanceHubView } from "@/state/finance-hub-selectors";

/**
 * Compact financial position strip — not a StatCard grid.
 */
export function FinancialStatStrip(props: { view: FinanceHubView }) {
  const { view } = props;
  const month = view.pnl.currentMonth;
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-2 border-b border-zinc-800 pb-3 text-sm">
      <Strip
        label="Business funds"
        value={<MoneyDisplay amount={view.finances.businessFunds} />}
      />
      <Strip
        label="Net change (month)"
        value={
          <MoneyDisplay amount={month.liquidity.netBusinessFundsChange} />
        }
      />
      <Strip
        label="Payroll"
        value={<MoneyDisplay amount={view.finances.playerPayroll} />}
      />
      <Strip
        label="Health"
        value={
          <span className="capitalize">
            {view.businessHealth.replaceAll("_", " ")}
          </span>
        }
      />
    </dl>
  );
}

function Strip(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-[5rem]">
      <dt className="text-[0.65rem] uppercase tracking-wide text-zinc-500">
        {props.label}
      </dt>
      <dd className="mt-0.5 font-medium text-zinc-100">{props.value}</dd>
    </div>
  );
}
