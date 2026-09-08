import { cn } from "@/components/ui/styles";

export function ProgressBar(props: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
  /** Accessible name when no visible label. */
  "aria-label"?: string;
}) {
  const max = props.max ?? 100;
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (props.value / max) * 100));

  return (
    <div className={cn("w-full", props.className)}>
      {props.label ? (
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-400">
          <span>{props.label}</span>
          <span className="font-mono text-zinc-500">{Math.round(pct)}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={props["aria-label"] ?? props.label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
      >
        <div
          className="h-full rounded-full bg-amber-500 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
