import { cn } from "./styles";
import { chartTheme } from "./chart-theme";

/**
 * Tiny W/L tick strip (oldest to newest). Wins stand tall in the win colour,
 * losses sit short in the loss colour. Static: no animation.
 */
export function ResultSparkline(props: {
  results: readonly ("W" | "L")[];
  /** Accessible name; defaults to a W-L summary. */
  label?: string;
  className?: string;
}) {
  const { results } = props;
  if (results.length === 0) {
    return <span className="text-disabled">—</span>;
  }
  const wins = results.filter((r) => r === "W").length;
  const label =
    props.label ??
    `Last ${results.length} games: ${wins} wins, ${results.length - wins} losses`;
  const tick = 6;
  const gap = 2;
  const width = results.length * (tick + gap) - gap;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} 14`}
      width={width}
      height={14}
      className={cn("inline-block shrink-0 align-middle", props.className)}
    >
      {results.map((r, i) => (
        <rect
          key={i}
          x={i * (tick + gap)}
          y={r === "W" ? 0 : 7}
          width={tick}
          height={r === "W" ? 14 : 7}
          rx={1}
          fill={r === "W" ? chartTheme.win : chartTheme.loss}
        />
      ))}
    </svg>
  );
}

/** Minimal line sparkline for a numeric series (team ink). */
export function Sparkline(props: {
  values: readonly number[];
  label: string;
  className?: string;
}) {
  const { values } = props;
  if (values.length < 2) {
    return null;
  }
  const w = 80;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 2 - ((v - min) / span) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      role="img"
      aria-label={props.label}
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-6 w-20", props.className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke={chartTheme.ink}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
