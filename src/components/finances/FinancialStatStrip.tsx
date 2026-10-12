import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { TickerBar } from "@/components/ui/TickerBar";
import type { FinanceHubView } from "@/state/finance-hub-selectors";

/**
 * Compact financial position strip — a ticker, not a StatCard grid.
 */
export function FinancialStatStrip(props: { view: FinanceHubView }) {
  const { view } = props;
  const month = view.pnl.currentMonth;
  return (
    <TickerBar
      aria-label="Financial position"
      className="border-b border-surface-line pb-3"
      items={[
        {
          label: "Business funds",
          value: <MoneyDisplay amount={view.finances.businessFunds} />,
          tone: "team",
        },
        {
          label: "Net change (month)",
          value: (
            <MoneyDisplay amount={month.liquidity.netBusinessFundsChange} />
          ),
        },
        {
          label: "Payroll",
          value: <MoneyDisplay amount={view.finances.playerPayroll} />,
        },
        {
          label: "Health",
          value: view.businessHealth.replaceAll("_", " "),
        },
      ]}
    />
  );
}
