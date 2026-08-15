/** Regular-season lifecycle offsets and constants. */
export const SEASON_LIFECYCLE_CONFIG = {
  /**
   * Calendar days added to currentDate when mapping schedule round 0 / first round.
   * 0 = opener may fall on currentDate (same-day sim after preseason→regular).
   */
  scheduleStartOffsetDays: 0,
} as const;
