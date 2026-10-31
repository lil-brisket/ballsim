import { cn } from "@/components/ui/styles";
import {
  formatRatingRange,
  type RatingDisplayMode,
} from "@/presentation/rating-grade";
import { ratingTier } from "@/presentation/rating-tier";

/**
 * A scouting estimate as a grade or number span, coloured by the midpoint's
 * band (the same tier colours as RatingCell). The text and the screen-reader
 * label ("B plus to A minus, 74 to 86") carry the meaning; colour only
 * reinforces it. `plain` always shows numbers (OVR, POT) and colours by the
 * midpoint's overall tier. A missing estimate is a dash, never a zero.
 */
export function RatingRangeCell(props: {
  range: { min: number; max: number } | null;
  mode: RatingDisplayMode;
  plain?: boolean;
  className?: string;
}) {
  if (!props.range) return <>—</>;
  const formatted = formatRatingRange(
    props.range,
    props.plain ? "ratings" : props.mode,
  );
  const band = props.plain
    ? ratingTier(Math.round((props.range.min + props.range.max) / 2)).id
    : formatted.band;
  return (
    <span
      data-tier={band}
      title={formatted.label}
      className={cn(
        "inline-flex items-center justify-end gap-1 font-semibold tabular-nums text-tier",
        props.className,
      )}
    >
      <span aria-hidden>{formatted.text}</span>
      <span className="sr-only">{formatted.label}</span>
    </span>
  );
}
