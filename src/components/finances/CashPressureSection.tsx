import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type { CashRunwayView } from "@/state/franchise-selectors";

function largestEntry(
  entries: readonly { label: string; amount: number }[],
): { label: string; amount: number } | null {
  if (entries.length === 0) {
    return null;
  }
  return entries.reduce((best, entry) =>
    entry.amount > best.amount ? entry : best,
  );
}

export function CashPressureSection(props: { cashRunway: CashRunwayView }) {
  const { cashRunway } = props;
  const inflows = [
    { label: "Gate", amount: cashRunway.inflowBreakdown.gate },
    { label: "Sponsorship", amount: cashRunway.inflowBreakdown.sponsorship },
    { label: "Broadcast", amount: cashRunway.inflowBreakdown.broadcast },
  ];
  const outflows = [
    {
      label: "Player payroll",
      amount: cashRunway.outflowBreakdown.playerPayroll,
    },
    { label: "Staff", amount: cashRunway.outflowBreakdown.staff },
    { label: "Facilities", amount: cashRunway.outflowBreakdown.facilities },
    { label: "Marketing", amount: cashRunway.outflowBreakdown.marketing },
  ];
  const biggestInflow = largestEntry(inflows);
  const biggestOutflow = largestEntry(outflows);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ul className="space-y-1.5 text-sm text-zinc-300">
        <li className="flex justify-between gap-2">
          <span className="text-zinc-500">Primary pressure</span>
          <span className="capitalize">
            {cashRunway.primaryPressure.replaceAll("_", " ")}
          </span>
        </li>
        {biggestInflow ? (
          <li className="flex justify-between gap-2">
            <span className="text-zinc-500">Biggest inflow</span>
            <span>
              {biggestInflow.label}{" "}
              <MoneyDisplay amount={biggestInflow.amount} />
            </span>
          </li>
        ) : null}
        {biggestOutflow ? (
          <li className="flex justify-between gap-2">
            <span className="text-zinc-500">Biggest outflow</span>
            <span>
              {biggestOutflow.label}{" "}
              <MoneyDisplay amount={biggestOutflow.amount} />
            </span>
          </li>
        ) : null}
        <li className="flex justify-between gap-2">
          <span className="text-zinc-500">Facility spending</span>
          <MoneyDisplay amount={cashRunway.outflowBreakdown.facilities} />
        </li>
      </ul>
      <ul className="space-y-1.5 text-sm text-zinc-300">
        <li className="text-xs uppercase tracking-wide text-zinc-500">
          Weekly outflow
        </li>
        {outflows.map((entry) => (
          <li key={entry.label} className="flex justify-between gap-2">
            <span>{entry.label}</span>
            <MoneyDisplay amount={entry.amount} />
          </li>
        ))}
      </ul>
    </div>
  );
}
