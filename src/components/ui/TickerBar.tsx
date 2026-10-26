import { cn } from "@/components/ui/styles";

export type TickerTone =
  "default" | "team" | "win" | "loss" | "live" | "warning";

export type TickerItem = {
  label: string;
  value: React.ReactNode;
  tone?: TickerTone;
};

const TONE: Record<TickerTone, string> = {
  default: "text-ink",
  team: "text-team-ink",
  win: "text-win",
  loss: "text-loss",
  live: "text-live",
  warning: "text-warning",
};

/**
 * Horizontal broadcast strip of label + value pairs (headers, summaries).
 * Scrolls horizontally on narrow screens instead of wrapping.
 */
export function TickerBar(props: {
  items: TickerItem[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <dl
      aria-label={props["aria-label"]}
      className={cn(
        "flex min-w-0 items-stretch divide-x divide-surface-line overflow-x-auto [scrollbar-width:none]",
        props.className,
      )}
    >
      {props.items.map((item) => (
        <div
          key={item.label}
          className="flex shrink-0 flex-col justify-center gap-0.5 px-3 py-1 first:pl-0 last:pr-0"
        >
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd
            className={cn(
              "font-display text-lg font-bold uppercase leading-none tabular-nums",
              TONE[item.tone ?? "default"],
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
