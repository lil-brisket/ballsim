/**
 * Rating tiers for the broadcast UI: maps an overall rating to a visual band.
 * The colours live in globals.css under `[data-tier="..."]`; components set
 * `data-tier={ratingTier(overall).id}` and use text-tier / border-tier.
 * Pure presentation; never feeds gameplay.
 */

export type RatingTierId =
  "legend" | "elite" | "star" | "starter" | "role" | "bench";

export type RatingTier = {
  id: RatingTierId;
  label: string;
  /** Inclusive lower bound of the band. */
  min: number;
};

export const RATING_TIERS: readonly RatingTier[] = [
  // Finer bands at the top so a 99 and a 94 do not look identical.
  { id: "legend", label: "Legend", min: 95 },
  { id: "elite", label: "Elite", min: 90 },
  { id: "star", label: "Star", min: 80 },
  { id: "starter", label: "Starter", min: 70 },
  { id: "role", label: "Role player", min: 60 },
  { id: "bench", label: "Bench", min: Number.NEGATIVE_INFINITY },
];

export function ratingTier(overall: number): RatingTier {
  return (
    RATING_TIERS.find((tier) => overall >= tier.min) ??
    RATING_TIERS[RATING_TIERS.length - 1]!
  );
}
