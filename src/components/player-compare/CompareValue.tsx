"use client";

import { RatingCell } from "@/components/roster/sheet/RatingCell";
import { useRatingDisplay } from "@/components/ui/rating-display";

/** One compared rating as a grade or number per the viewer's choice. */
export function CompareValue(props: { value: number; className?: string }) {
  const [mode] = useRatingDisplay();
  return (
    <RatingCell value={props.value} mode={mode} className={props.className} />
  );
}
