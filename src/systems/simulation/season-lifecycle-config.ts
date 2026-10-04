/**
 * Canonical opening night by season year (month/day stay fixed across years).
 * Preseason start = this date minus PRESEASON_LENGTH_DAYS.
 */

import { addCalendarDays, formatCalendarDate } from "@/domain/calendar-date";
import { PRESEASON_LENGTH_DAYS } from "@/systems/simulation/offseason-calendar-config";

export const REGULAR_SEASON_START_MONTH = 10;
export const REGULAR_SEASON_START_DAY = 1;

/** Opening night for `seasonYear` (e.g. 2027 → "2027-10-01"). */
export function canonicalRegularSeasonStartDate(seasonYear: number): string {
  if (!Number.isInteger(seasonYear)) {
    throw new Error(
      `canonicalRegularSeasonStartDate requires an integer year; got ${seasonYear}.`,
    );
  }
  return formatCalendarDate(
    seasonYear,
    REGULAR_SEASON_START_MONTH,
    REGULAR_SEASON_START_DAY,
  );
}

/** Preseason start for `seasonYear` (21 days before opening night). */
export function canonicalPreseasonStartDate(seasonYear: number): string {
  return addCalendarDays(
    canonicalRegularSeasonStartDate(seasonYear),
    -PRESEASON_LENGTH_DAYS,
  );
}

/**
 * Canonical opening night for new saves (year 2026).
 * Prefer {@link canonicalRegularSeasonStartDate} for later seasons.
 */
export const DEFAULT_REGULAR_SEASON_START_DATE =
  canonicalRegularSeasonStartDate(2026);

/** Regular-season lifecycle offsets and constants. */
export const SEASON_LIFECYCLE_CONFIG = {
  /**
   * @deprecated Prefer resolveRegularSeasonScheduleAnchor + round day offsets.
   * Kept for any residual callers; schedule generation no longer uses this.
   */
  scheduleStartOffsetDays: 0,
} as const;
