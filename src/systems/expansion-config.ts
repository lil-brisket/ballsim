/**
 * Expansion fee and starting-cash constants.
 * Fee is shared to existing clubs; new team gets EXPANSION_STARTING_CASH.
 *
 * Franchise-value scarcity: broadcast pool already splits by live team count.
 * Franchise-value league multiplier does NOT use live n — scarcity multiplier
 * is deferred (do not invent a parallel valuation effect here).
 */

/** Default expansion fee paid into the league (shared to pre-existing teams). */
export const EXPANSION_FEE_DEFAULT = 150_000_000;

/** New expansion franchise operating cash (not the fee). */
export const EXPANSION_STARTING_CASH = 40_000_000;

/** League readiness thresholds (existing league-economy metrics). */
export const EXPANSION_READY_MIN_POPULARITY = 55;
export const EXPANSION_READY_MIN_BROADCAST = 50;
export const EXPANSION_READY_MIN_SPONSORSHIP = 48;
