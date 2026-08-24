/** Calendar context bands and trade-deadline window — not simulation clocks. */

export const CALENDAR_CONTEXT_CONFIG = {
  /** Progress below this (0–1 along season calendar span) is early season. */
  earlyProgressMax: 0.33,
  /**
   * Days before the trade deadline that count as the deadline window
   * (inclusive of the deadline day itself when trades are still open).
   */
  deadlineWindowDays: 14,
  /** Games from the last playoff seed to treat as a bubble race. */
  playoffBubbleGames: 3,
} as const;
