import { cn } from "./styles";
import { chartTheme } from "./chart-theme";

/**
 * Compact semicircle gauge with the value as text. Static (no animation).
 */
export function Gauge(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  /** Hide the visible caption (the accessible name stays). */
  hideLabel?: boolean;
  className?: string;
}) {
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const clamped = Math.max(min, Math.min(max, props.value));
  const ratio = max === min ? 0 : (clamped - min) / (max - min);
  const r = 40;
  const cx = 50;
  const cy = 50;
  const arc = (t: number) => {
    const angle = Math.PI * (1 - t);
    return `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy - r * Math.sin(angle)).toFixed(2)}`;
  };
  const track = `M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(1)}`;
  const fill =
    ratio <= 0
      ? null
      : `M ${arc(0)} A ${r} ${r} 0 0 1 ${arc(Math.min(ratio, 0.9999))}`;
  return (
    <div
      className={cn("inline-flex w-28 flex-col items-center", props.className)}
      role="meter"
      aria-label={props.label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamped}
    >
      <svg viewBox="0 0 100 56" className="w-full" aria-hidden="true">
        <path
          d={track}
          fill="none"
          stroke={chartTheme.grid}
          strokeWidth={9}
          strokeLinecap="round"
        />
        {fill ? (
          <path
            d={fill}
            fill="none"
            stroke={chartTheme.ink}
            strokeWidth={9}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <span className="-mt-5 font-mono text-lg font-semibold tabular-nums text-ink">
        {Math.round(clamped)}
      </span>
      {props.hideLabel ? null : (
        <span className="text-sm text-muted">{props.label}</span>
      )}
    </div>
  );
}
