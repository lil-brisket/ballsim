/**
 * Hard locks — never configurable via GameSettings.
 * Phase locks and league settings live elsewhere.
 */

/** All drafts are exactly this many rounds. */
export const DRAFT_ROUNDS = 2 as const;

/** Max future seasons ahead a draft pick may be traded (inclusive). */
export const DRAFT_PICK_TRADE_HORIZON_YEARS = 3;

/**
 * Trade deadline = this fraction of regular-season calendar span
 * (first scheduled game date → last scheduled game date).
 * Not based on games played.
 */
export const TRADE_DEADLINE_SEASON_FRACTION = 0.6;

/** Calendar days the original team has to match an RFA offer sheet. */
export const RFA_MATCH_WINDOW_DAYS = 3;

/** Years of service below which an expiring player is RFA-eligible. */
export const RFA_MAX_YEARS_OF_SERVICE = 4;

/** Qualifying offer multiplier on prior-year salary. */
export const RFA_QUALIFYING_OFFER_MULTIPLIER = 1.1;

/** Minimum age band where retirement probability becomes non-zero. */
export const PLAYER_RETIREMENT_MIN_AGE = 34;

/** Age at which retirement pressure rises sharply. */
export const PLAYER_RETIREMENT_HIGH_AGE = 38;
