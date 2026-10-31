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
      ? "text-success"
      : props.direction === "down"
        ? "text-danger"
        : "text-muted";

  return (
    <ArenaPanel
      as="div"
      raised
      density="compact"
      className={props.emphasize ? "sm:col-span-2 lg:col-span-1" : undefined}
    >
      <p className="text-sm text-muted">{props.label}</p>
      <div className="mt-1.5 font-display text-3xl font-bold tabular-nums text-ink">
        {props.value}
      </div>
      {props.context ? (
        <p className={`mt-1 text-sm ${directionClass}`}>{props.context}</p>
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
