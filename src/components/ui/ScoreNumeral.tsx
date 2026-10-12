import { cn } from "@/components/ui/styles";

export type ScoreNumeralSize = "sm" | "md" | "lg" | "xl";
export type ScoreNumeralTone = "default" | "team" | "win" | "loss" | "muted";

const SIZE: Record<ScoreNumeralSize, string> = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-6xl",
  xl: "text-7xl sm:text-8xl",
};

const TONE: Record<ScoreNumeralTone, string> = {
  default: "text-zinc-50",
  team: "text-team-ink",
  win: "text-win",
  loss: "text-loss",
  muted: "text-zinc-500",
};

/**
 * Large scoreboard number (records, ratings, scores) with an optional label.
 * `value` is any node so callers can pass "52-30" or a formatted rating.
 */
export function ScoreNumeral(props: {
  value: React.ReactNode;
  label?: string;
  size?: ScoreNumeralSize;
  tone?: ScoreNumeralTone;
  align?: "start" | "center" | "end";
  /** Label below the number instead of above. */
  labelBelow?: boolean;
  className?: string;
}) {
  const size = props.size ?? "md";
  const align = props.align ?? "start";
  const label = props.label ? (
    <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-zinc-400">
      {props.label}
    </span>
  ) : null;
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5",
        align === "center" && "items-center text-center",
        align === "end" && "items-end text-end",
        props.className,
      )}
    >
      {props.labelBelow ? null : label}
      <span
        className={cn(
          "font-display font-extrabold leading-none tabular-nums",
          SIZE[size],
          TONE[props.tone ?? "default"],
        )}
      >
        {props.value}
      </span>
      {props.labelBelow ? label : null}
    </div>
  );
}
