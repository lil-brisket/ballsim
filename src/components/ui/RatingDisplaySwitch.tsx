"use client";

import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { useRatingDisplay } from "@/components/ui/rating-display";

/** Grades | Ratings: the one per-viewer choice every rating on screen follows. */
export function RatingDisplaySwitch(props: { className?: string }) {
  const [mode, setMode] = useRatingDisplay();
  return (
    <ViewSwitch
      aria-label="Rating display"
      className={props.className}
      activeKey={mode}
      items={[
        {
          key: "grades",
          label: "Grades",
          onSelect: () => setMode("grades"),
        },
        {
          key: "ratings",
          label: "Ratings",
          onSelect: () => setMode("ratings"),
        },
      ]}
    />
  );
}
