import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";

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
        : "text-zinc-400";

  return (
    <ArenaPanel
      as="div"
      raised
      density="compact"
      className={props.emphasize ? "sm:col-span-2 lg:col-span-1" : undefined}
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-400">
        {props.label}
      </p>
      <div className="mt-1.5 font-display text-3xl font-bold tabular-nums text-zinc-50">
        {props.value}
      </div>
      {props.context ? (
        <p className={`mt-1 text-xs ${directionClass}`}>{props.context}</p>
      ) : null}
    </ArenaPanel>
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
