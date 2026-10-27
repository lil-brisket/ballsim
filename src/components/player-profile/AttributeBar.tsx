export function AttributeBar(props: {
  label: string;
  value: number;
  highlight?: "strong" | "weak" | null;
  development?: string | null;
}) {
  const clamped = Math.max(0, Math.min(100, props.value));
  const highlightClass =
    props.highlight === "strong"
      ? "border-team-ink/50 bg-team/15"
      : props.highlight === "weak"
        ? "border-line-strong bg-surface-base/40"
        : "border-line";

  return (
    <div className={`rounded-lg border px-3 py-2 ${highlightClass}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm capitalize text-muted">{props.label}</p>
        <p className="font-mono text-sm text-ink">{props.value}</p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-high">
        <div
          className="h-full rounded-full bg-team-ink"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {props.development ? (
        <p className="mt-1 text-sm tabular-nums text-faint">
          {props.development}
        </p>
      ) : null}
    </div>
  );
}
