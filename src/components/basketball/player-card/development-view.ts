/**
 * Pure helpers for the Development tab. Ratings are actual values only:
 * season-end snapshots plus today's rating. Nothing here projects.
 */

import type { PlayerRatingHistoryPoint } from "@/state/player-profile-selectors";

export type RatingHistoryRow = {
  /** Unique x-axis label: the season year, or "Now" for today's rating. */
  label: string;
  seasonYear: number;
  age: number | null;
  overall: number;
  current: boolean;
  /** OVR change from the previous row; null for the first row. */
  change: number | null;
};

export function ratingHistoryRows(
  points: readonly PlayerRatingHistoryPoint[],
): RatingHistoryRow[] {
  return points.map((point, index) => {
    const previous = index > 0 ? points[index - 1] : undefined;
    return {
      label: point.current ? "Now" : String(point.seasonYear),
      seasonYear: point.seasonYear,
      age: point.age,
      overall: point.overall,
      current: point.current,
      change: previous ? point.overall - previous.overall : null,
    };
  });
}

/** Y-axis bounds that fit every rating and the potential, on steps of 5. */
export function ratingAxisDomain(
  overalls: readonly number[],
  potential: number,
): [number, number] {
  const values = [...overalls, potential];
  const low = Math.max(0, Math.floor((Math.min(...values) - 5) / 5) * 5);
  const high = Math.min(100, Math.ceil((Math.max(...values) + 5) / 5) * 5);
  return [low, high];
}

export function formatChange(change: number | null): string {
  if (change == null) return "—";
  if (change === 0) return "0";
  return change > 0 ? `+${change}` : String(change);
}
