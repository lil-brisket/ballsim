"use client";

import { useId, useState } from "react";
import { RatingCell } from "@/components/roster/sheet/RatingCell";
import { RatingDisplaySwitch } from "@/components/ui/RatingDisplaySwitch";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useRatingDisplay } from "@/components/ui/rating-display";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { PlayerAttributes } from "@/domain/entities/player";
import {
  categoryRatings,
  type CategoryRating,
} from "@/presentation/player-rating-categories";
import {
  formatRating,
  type RatingDisplayMode,
} from "@/presentation/rating-grade";

type Emphasis = "best" | "worst" | null;

function CategoryBox(props: {
  category: CategoryRating;
  mode: RatingDisplayMode;
  emphasis: Emphasis;
  interactive: boolean;
  expanded: boolean;
  onToggle: () => void;
  panelId: string;
}) {
  const { category, mode, emphasis, expanded } = props;
  const band = formatRating(category.rating, mode).band;
  return (
    <li
      data-category={category.key}
      data-tier={band}
      data-emphasis={emphasis ?? undefined}
      className="flex min-w-0 flex-col gap-1 rounded-lg border border-line border-l-4 border-l-tier bg-surface-raised/60 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm text-soft">{category.label}</span>
        {emphasis ? (
          <>
            <span
              aria-hidden
              className="shrink-0 rounded border border-line px-1.5 text-sm font-semibold text-ink"
            >
              {emphasis === "best" ? "Best" : "Weakest"}
            </span>
            <span className="sr-only">
              {emphasis === "best" ? "Best category" : "Weakest category"}
            </span>
          </>
        ) : null}
      </div>
      <RatingCell
        value={category.rating}
        mode={mode}
        className="justify-start font-display text-4xl font-extrabold leading-none"
      />
      {props.interactive ? (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide details" : "Details"} for ${category.label}`}
            aria-controls={expanded ? props.panelId : undefined}
            onClick={props.onToggle}
            className={cn(
              "-mx-1 mt-1 inline-flex min-h-11 items-center justify-start rounded px-1 text-left text-sm font-medium text-muted transition-colors hover:text-ink motion-reduce:transition-none",
              focusRingClass,
            )}
          >
            {expanded ? "Hide details" : "Details"}
          </button>
          {expanded ? (
            <ul
              id={props.panelId}
              aria-label={`${category.label} attributes`}
              className="divide-y divide-surface-line border-t border-surface-line"
            >
              {category.attributes.map((attribute) => (
                <li
                  key={attribute.key}
                  className="flex items-center justify-between gap-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 break-words text-soft">
                    {attribute.label}
                  </span>
                  <RatingCell value={attribute.rating} mode={mode} />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

/**
 * The seven rating categories as boxes: label, a big grade or number (per the
 * viewer's Grades | Ratings choice) coloured by its band, and a text tag on
 * the best and weakest category. In interactive mode each box toggles its
 * sub-ratings inline and the best category starts open. Remount (key by
 * player) to reset when the player changes. Season stats and contract live on
 * the card's Overview tab and the profile, so they are not repeated here.
 */
export function CategoryBoxes(props: {
  attributes: PlayerAttributes;
  /** false renders plain boxes without sub-rating toggles. */
  interactive?: boolean;
  /** Grid column classes; the default suits a half-width panel. */
  className?: string;
}) {
  const interactive = props.interactive ?? true;
  const [mode] = useRatingDisplay();
  const categories = categoryRatings(props.attributes);
  const best = categories.reduce((a, b) => (b.rating > a.rating ? b : a));
  const worst = categories.reduce((a, b) => (b.rating < a.rating ? b : a));
  const spread = best.rating !== worst.rating;
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(
    () => new Set([best.key]),
  );
  const baseId = useId();

  function toggle(key: string) {
    setOpenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <SectionHeading
        as="h3"
        size="sm"
        title="Ratings"
        action={<RatingDisplaySwitch />}
      />
      <ul
        aria-label="Category ratings"
        className={cn("grid grid-cols-2 gap-3", props.className)}
      >
        {categories.map((category) => {
          const emphasis: Emphasis = !spread
            ? null
            : category.key === best.key
              ? "best"
              : category.key === worst.key
                ? "worst"
                : null;
          return (
            <CategoryBox
              key={category.key}
              category={category}
              mode={mode}
              emphasis={emphasis}
              interactive={interactive}
              expanded={interactive && openKeys.has(category.key)}
              onToggle={() => toggle(category.key)}
              panelId={`${baseId}-${category.key}`}
            />
          );
        })}
      </ul>
    </div>
  );
}
