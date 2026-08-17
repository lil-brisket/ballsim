/**
 * Presentation thresholds for the Owner Decision Center.
 * These are UI/diagnosis constants — not simulation rules.
 */

/** Ticket price this % above league mean → pricing hypothesis may apply. Inclusive. */
export const TICKET_PRICE_VS_LEAGUE_HIGH_PCT = 15;

/** Payroll this % above league mean → expensive payroll signal. Inclusive. */
export const PAYROLL_VS_LEAGUE_HIGH_PCT = 10;

/**
 * Strength must be at least this % of league-mean overall to count as
 * "similarly high" when payroll is elevated. Below → team/payroll concern.
 */
export const STRENGTH_VS_LEAGUE_HIGH_PCT = 100;

/**
 * Awareness at or above this (0–100 scale) with poor fill → marketing insight.
 * Aligns with the mid awareness notification band.
 */
export const MARKETING_INSIGHT_MIN_AWARENESS = 50;

/** Minimum games played before a losing-record team-performance action. */
export const TEAM_PERFORMANCE_MIN_GAMES = 10;

/** Max action items shown in the queue. */
export const ACTION_QUEUE_CAP = 5;

/** Max notifications shown on the dashboard strip. */
export const DASHBOARD_NOTIFICATION_CAP = 5;

/** Max recent activity entries on the dashboard. */
export const DASHBOARD_ACTIVITY_CAP = 8;

/** Upcoming games shown in the Team panel. */
export const DASHBOARD_UPCOMING_GAMES_LIMIT = 3;
