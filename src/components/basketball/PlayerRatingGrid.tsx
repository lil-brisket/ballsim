"use client";

import { useId, useState } from "react";
import { RatingBars } from "@/components/ui/RatingBars";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { PlayerAttributes } from "@/domain/entities/player";
import { categoryRatings } from "@/presentation/player-rating-categories";
import { ratingTier } from "@/presentation/rating-tier";

/**
 * 2K-style grid of seven category ratings. Each tile is a toggle button;
 * the open category's sub-attributes show below the grid. The player's best
 * category starts open. Remount (key by player) to reset when the player
 * changes.
 */
export function PlayerRatingGrid(props: { attributes: PlayerAttributes }) {
  const categories = categoryRatings(props.attributes);
  const best = categories.reduce((a, b) => (b.rating > a.rating ? b : a));
  const [openKey, setOpenKey] = useState<string | null>(best.key);
  const baseId = useId();
  const open = categories.find((c) => c.key === openKey) ?? null;
  const panelId = `${baseId}-panel`;

  return (
    <div className="space-y-3">
      <ul
        aria-label="Category ratings"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {categories.map((category) => {
          const expanded = category.key === openKey;
          const width = Math.max(0, Math.min(100, category.rating));
          return (
            <li key={category.key} className="min-w-0">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                data-tier={ratingTier(category.rating).id}
                data-category={category.key}
                onClick={() => setOpenKey(expanded ? null : category.key)}
                className={cn(
                  "flex w-full min-w-0 flex-col gap-1.5 rounded-lg border border-l-4 border-surface-line border-l-tier bg-surface-deep/80 px-3 py-2.5 text-left transition-colors hover:bg-zinc-900 motion-reduce:transition-none",
                  expanded &&
                    "bg-zinc-900 shadow-[0_0_18px_-6px_rgb(var(--tier-rgb)/0.7)]",
                  focusRingClass,
                )}
              >
                <span className="truncate text-sm text-zinc-400">
                  {category.label}
                </span>
                <span className="font-display text-4xl font-extrabold leading-none tabular-nums text-tier">
                  {category.rating}
                </span>
                <span
                  className="h-1 overflow-hidden rounded-full bg-surface-line"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full bg-tier transition-[width] motion-reduce:transition-none"
                    style={{ width: `${width}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div id={panelId} aria-live="polite">
        {open ? (
          <div className="rounded-lg border border-surface-line bg-surface-deep/60 p-3">
            <p className="mb-2 text-sm font-medium text-zinc-300">
              {open.label} breakdown
            </p>
            <RatingBars
              aria-label={`${open.label} attributes`}
              items={open.attributes.map((a) => ({
                label: a.label,
                rating: a.rating,
              }))}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
