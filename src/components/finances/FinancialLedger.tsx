import { EmptyState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type { EventLogEntryView } from "@/state/selectors";
import type { FinanceTrendPoint } from "@/state/finance-hub-selectors";

export function FinancialLedger(props: { entries: EventLogEntryView[] }) {
  if (props.entries.length === 0) {
    return <EmptyState message="No finance events recorded yet." />;
  }
  return (
    <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 text-sm">
      {props.entries.slice(0, 20).map((entry) => (
        <li
          key={entry.id}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-zinc-300"
        >
          <div className="min-w-0">
            <p className="truncate">{entry.description}</p>
            <p className="text-xs text-zinc-500">
              {entry.type} · {entry.occurredOn}
            </p>
          </div>
          {entry.amount !== null ? (
            <MoneyDisplay amount={entry.amount} />
          ) : (
            <span className="text-zinc-600">—</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function FinancialTrend(props: { points: FinanceTrendPoint[] }) {
  if (props.points.length === 0) {
    return (
      <EmptyState message="No monthly financial history available yet." />
    );
  }
  const maxAbs = Math.max(
    ...props.points.flatMap((p) => [p.revenue, p.expenses]),
    1,
  );
  return (
    <ul className="space-y-3">
      {props.points.map((p) => (
        <li key={p.monthKey}>
          <div className="mb-1 flex justify-between text-xs text-zinc-400">
            <span>{p.monthKey}</span>
            <span>
              Net <MoneyDisplay amount={p.net} />
            </span>
          </div>
          <div className="space-y-1">
            <Bar label="Rev" value={p.revenue} max={maxAbs} tone="emerald" />
            <Bar label="Exp" value={p.expenses} max={maxAbs} tone="rose" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Bar(props: {
  label: string;
  value: number;
  max: number;
  tone: "emerald" | "rose";
}) {
  const pct = Math.min(100, Math.round((props.value / props.max) * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-zinc-500">{props.label}</span>
      <div className="h-1.5 flex-1 rounded bg-zinc-900">
        <div
          className={
            props.tone === "emerald"
              ? "h-1.5 rounded bg-emerald-700/70"
              : "h-1.5 rounded bg-rose-700/70"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-16 text-right text-zinc-400">
        <MoneyDisplay amount={props.value} />
      </span>
    </div>
  );
}
