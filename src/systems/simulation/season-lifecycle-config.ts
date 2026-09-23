/**
 * Canonical opening night for new saves (year 2026).
 * Preseason start = this date minus PRESEASON_LENGTH_DAYS.
 */
export const DEFAULT_REGULAR_SEASON_START_DATE = "2026-10-01";

/** Regular-season lifecycle offsets and constants. */
export const SEASON_LIFECYCLE_CONFIG = {
  /**
   * @deprecated Prefer resolveRegularSeasonScheduleAnchor + round day offsets.
   * Kept for any residual callers; schedule generation no longer uses this.
   */
  scheduleStartOffsetDays: 0,
} as const;
