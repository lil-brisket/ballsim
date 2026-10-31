"use client";

import { RatingDisplaySwitch } from "@/components/ui/RatingDisplaySwitch";
import { useRatingDisplay } from "@/components/ui/rating-display";

/**
 * Settings row for the Grades | Ratings choice. The same preference drives
 * every sheet, player card and compare view, so changing it here or on a
 * sheet is the same change.
 */
export function RatingDisplaySetting() {
  const [mode] = useRatingDisplay();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="max-w-prose text-sm">
        <p className="font-semibold text-ink">Player ratings</p>
        <p className="text-muted">
          Show skills as letter grades (B+) or as numbers (81). Overall and
          potential always show as numbers.{" "}
          <span className="text-faint">
            Now showing {mode === "grades" ? "grades" : "ratings"}. Saved on
            this device only.
          </span>
        </p>
      </div>
      <RatingDisplaySwitch />
    </div>
  );
}
