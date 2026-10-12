import { cn } from "@/components/ui/styles";
import { ratingTier } from "@/presentation/rating-tier";

export type RatingBarItem = {
  label: string;
  /** 0-99 rating; null renders an empty bar and an em dash. */
  rating: number | null;
};

/**
 * Compact strip of labelled rating bars. Each bar is coloured by the rating's
 * tier (see rating-tier.ts) and exposes its value as text, so colour is never
 * the only signal.
 */
export function RatingBars(props: {
  items: RatingBarItem[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ul
      aria-label={props["aria-label"]}
      className={cn(
        "grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3",
        props.className,
      )}
    >
      {props.items.map((item) => {
        const value = item.rating;
        const width =
          value == null ? 0 : Math.max(0, Math.min(100, Math.round(value)));
        return (
          <li
            key={item.label}
            data-tier={value == null ? undefined : ratingTier(value).id}
            className="min-w-0"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-400">
                {item.label}
              </span>
              <span className="font-display text-xl font-bold leading-none tabular-nums text-tier">
                {value ?? "—"}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-line"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-tier"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
