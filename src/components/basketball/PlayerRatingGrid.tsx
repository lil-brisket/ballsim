"use client";

import { useId, useState } from "react";
import { RatingBars } from "@/components/ui/RatingBars";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { PlayerAttributes } from "@/domain/entities/player";
import { categoryRatings } from "@/presentation/player-rating-categories";
import { ratingTier } from "@/presentation/rating-tier";

type Emphasis = "best" | "worst" | null;

/**
 * One row per attribute group: label, a bar and a big average, both coloured
 * by the group average's rating tier. The best and weakest groups are also
 * announced to screen readers. In interactive mode each row toggles an inline breakdown of its
 * sub-ratings, full width directly under the row; the best category starts
 * open. Remount (key by player) to reset when the player changes.
 */
export function PlayerRatingGrid(props: {
  attributes: PlayerAttributes;
  /** false renders plain rows without sub-rating breakdowns. */
  interactive?: boolean;
}) {
  const interactive = props.interactive ?? true;
  const categories = categoryRatings(props.attributes);
  const best = categories.reduce((a, b) => (b.rating > a.rating ? b : a));
  const worst = categories.reduce((a, b) => (b.rating < a.rating ? b : a));
  const spread = best.rating !== worst.rating;
  const [openKey, setOpenKey] = useState<string | null>(best.key);
  const baseId = useId();

  return (
    <ul aria-label="Category ratings" className="divide-y divide-surface-line">
      {categories.map((category) => {
        const expanded = interactive && category.key === openKey;
        const width = Math.max(0, Math.min(100, category.rating));
        const emphasis: Emphasis = !spread
          ? null
          : category.key === best.key
            ? "best"
            : category.key === worst.key
              ? "worst"
              : null;
        const panelId = `${baseId}-${category.key}`;
        const row = (
          <>
            <span className="w-32 shrink-0 truncate text-left text-sm text-soft sm:w-36">
              {category.label}
            </span>
            <span
              className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-line"
              aria-hidden
            >
              <span
                className="block h-full rounded-full bg-tier transition-[width] motion-reduce:transition-none"
                style={{ width: `${width}%` }}
              />
            </span>
            <span className="w-12 shrink-0 text-right font-display text-3xl font-extrabold leading-none tabular-nums text-tier">
              {category.rating}
            </span>
            {emphasis ? (
              <span className="sr-only">
                {emphasis === "best" ? "Best category" : "Weakest category"}
              </span>
            ) : null}
          </>
        );
        return (
          <li
            key={category.key}
            data-tier={ratingTier(category.rating).id}
            data-category={category.key}
          >
            {interactive ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={expanded ? panelId : undefined}
                onClick={() => setOpenKey(expanded ? null : category.key)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded px-2 py-1.5 transition-colors hover:bg-surface-deep/80 motion-reduce:transition-none",
                  expanded && "bg-surface-deep/80",
                  focusRingClass,
                )}
              >
                {row}
              </button>
            ) : (
              <div className="flex min-h-11 items-center gap-3 px-2 py-1.5">
                {row}
              </div>
            )}
            {expanded ? (
              <div
                id={panelId}
                className="mx-2 mb-3 mt-1 rounded-lg bg-surface-deep/60 p-3"
              >
                <p className="mb-2 text-sm font-medium text-soft">
                  {category.label} breakdown
                </p>
                <RatingBars
                  aria-label={`${category.label} attributes`}
                  className="sm:grid-cols-2 lg:grid-cols-2"
                  items={category.attributes.map((a) => ({
                    label: a.label,
                    rating: a.rating,
                  }))}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
