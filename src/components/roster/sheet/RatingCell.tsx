import { cn } from "@/components/ui/styles";
import {
  formatRating,
  type RatingDisplayMode,
} from "@/presentation/rating-grade";
import { ratingTier } from "@/presentation/rating-tier";

/** Small triangle: "best on team" without relying on colour. */
export function BestMarker() {
  return (
    <span
      aria-hidden
      data-best
      className="inline-block h-0 w-0 border-x-[4px] border-b-[6px] border-x-transparent border-b-current"
    />
  );
}

/**
 * One rating as a letter grade or number, coloured by its band. The text
 * (and the screen-reader label, which always carries the number) is the
 * meaning; colour only reinforces it. `best` adds a small triangle marker
 * and "best on team" to the spoken label. `plain` always shows the number
 * (OVR, POT) and colours it by its overall tier.
 */
export function RatingCell(props: {
  value: number;
  mode: RatingDisplayMode;
  best?: boolean;
  plain?: boolean;
  className?: string;
}) {
  const rating = formatRating(
    props.value,
    props.plain ? "ratings" : props.mode,
  );
  const band = props.plain ? ratingTier(props.value).id : rating.band;
  return (
    <span
      data-tier={band}
      title={rating.label}
      className={cn(
        "inline-flex items-center justify-end gap-1 font-semibold tabular-nums text-tier",
        props.className,
      )}
    >
      {props.best ? <BestMarker /> : null}
      <span aria-hidden>{rating.text}</span>
      <span className="sr-only">
        {rating.label}
        {props.best ? " best on team" : ""}
      </span>
    </span>
  );
}
