export function AttributeBar(props: {
  label: string;
  value: number;
  highlight?: "strong" | "weak" | null;
  development?: string | null;
}) {
  const clamped = Math.max(0, Math.min(100, props.value));
  const highlightClass =
    props.highlight === "strong"
      ? "border-amber-700/60 bg-amber-950/20"
      : props.highlight === "weak"
        ? "border-zinc-700 bg-zinc-950/40"
        : "border-zinc-800";

  return (
    <div className={`rounded-lg border px-3 py-2 ${highlightClass}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs capitalize text-zinc-500">{props.label}</p>
        <p className="font-mono text-sm text-zinc-100">{props.value}</p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-amber-600"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {props.development ? (
        <p className="mt-1 font-mono text-[10px] text-zinc-500">
          {props.development}
        </p>
      ) : null}
    </div>
  );
}
