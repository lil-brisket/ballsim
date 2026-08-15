export type Calendar = {
  /** Fictional calendar date in YYYY-MM-DD form. */
  currentDate: string;
  /**
   * Last calendar date for which the daily simulation pipeline completed.
   * Null until the first successful advanceSimulation day.
   */
  lastSimulatedDate: string | null;
  /**
   * ISO week id of the most recently completed weekly processing window
   * (not the current calendar week). Null until the first weekly run.
   */
  lastSimulatedWeekId: string | null;
  /**
   * Calendar month id (YYYY-MM) of the most recently completed monthly
   * processing window. Null until the first monthly run.
   * Not a second clock — advanceSimulation remains the only calendar writer.
   */
  lastSimulatedMonthId: string | null;
};
