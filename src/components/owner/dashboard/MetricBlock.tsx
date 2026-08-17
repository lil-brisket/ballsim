import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { StatusBadge } from "@/components/owner/StatusBadge";

export function MetricBlock(props: {
  label: string;
  value: React.ReactNode;
  context?: string | null;
  direction?: "up" | "down" | "flat";
  emphasize?: boolean;
}) {
  const directionClass =
    props.direction === "up"
      ? "text-emerald-400"
      : props.direction === "down"
        ? "text-rose-400"
        : "text-zinc-500";

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 ${
        props.emphasize ? "sm:col-span-2 lg:col-span-1" : ""
      }`}
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
        {props.label}
      </p>
      <div className="mt-1.5 text-xl text-zinc-50">{props.value}</div>
      {props.context ? (
        <p className={`mt-1 text-xs ${directionClass}`}>{props.context}</p>
      ) : null}
    </div>
  );
}

export function MoneyMetric(props: {
  label: string;
  amount: number;
  context?: string | null;
  direction?: "up" | "down" | "flat";
}) {
  return (
    <MetricBlock
      label={props.label}
      value={<MoneyDisplay amount={props.amount} />}
      context={props.context}
      direction={props.direction}
    />
  );
}

export function HealthToneBadge(props: { health: string }) {
  const tone =
    props.health === "healthy"
      ? "success"
      : props.health === "stable"
        ? "info"
        : props.health === "warning"
          ? "warning"
          : "critical";
  return <StatusBadge label={props.health} tone={tone} />;
}
