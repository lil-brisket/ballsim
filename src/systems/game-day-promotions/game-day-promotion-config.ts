/**
 * Game-day promotion config.
 *
 * Calibration notes (capacity 18_000, $45 tickets):
 * Demand scores typically land ~36–72 across markets/records.
 * Each demand-score point ≈ +180 attendance until sellout.
 * Catalog demandBoost values are therefore kept in 2–11 so even a major
 * event (+10 effective) adds ~1,800 attendees — meaningful, not a sellout button.
 */

/** Awareness → promotion reach only (not effectiveness). Compressed. */
export const PROMOTION_REACH_MIN = 0.9;
export const PROMOTION_REACH_MAX = 1.1;

/** Settlement variance clamp as fraction of projected impact. */
export const PROMOTION_VARIANCE_CLAMP = 0.15;

/** Projection range half-width as fraction of midpoint impact. */
export const PROMOTION_PROJECTION_RANGE_FRACTION = 0.12;

/** Days before game when cancellation refund drops to 0%. */
export const PROMOTION_FINAL_CANCEL_WINDOW_DAYS = 3;

/** Refund fraction after preparation begins but outside final window. */
export const PROMOTION_PARTIAL_REFUND_FRACTION = 0.5;

/** Day-of-week demand modifiers (UTC weekday: 0=Sun … 6=Sat). */
export const PROMOTION_DAY_OF_WEEK_FACTOR: Record<number, number> = {
  0: 1.05, // Sunday
  1: 0.88, // Monday
  2: 0.9,
  3: 0.92,
  4: 0.95,
  5: 1.08, // Friday
  6: 1.1, // Saturday
};

/** Division matchup affinity bonus on effectiveness (0–1 scale contribution). */
export const DIVISION_MATCHUP_AFFINITY_BONUS = 0.08;

/** Fatigue multiplier floor after repeated uses. */
export const PROMOTION_FATIGUE_FLOOR = 0.55;

/** Per prior use of same promotion this season, effectiveness multiplies by this. */
export const PROMOTION_FATIGUE_PER_USE = 0.12;

/** Minimum AI score threshold to schedule (below = skip). */
export const AI_PROMOTION_SCORE_THRESHOLD = 8;

/** Media bump from GameDayPromotionSettled (consumed by MEDIA_EVENT_BUMPS). */
export const GAME_DAY_PROMOTION_MEDIA_BUMP = 2;
