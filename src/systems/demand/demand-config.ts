/** Reference ticket price for demand normalization (dollars). */
export const DEMAND_REFERENCE_TICKET_PRICE = 45;

/** Price elasticity: higher = more sensitive to price vs reference. */
export const DEMAND_PRICE_ELASTICITY = 0.65;

/** Weight applied to each demand contributor (must sum to 1). */
export const DEMAND_CONTRIBUTOR_WEIGHTS = {
  marketSize: 0.2,
  fanSentiment: 0.22,
  reputation: 0.15,
  awareness: 0.12,
  mediaAttention: 0.1,
  leaguePopularity: 0.1,
  winPct: 0.11,
} as const;

/** Merchandise revenue per attendee (integer dollars, before sentiment). */
export const MERCHANDISE_PER_ATTENDEE_BASE = 8;

/** Sentiment multiplier range for merchandise (at 0 and 100 sentiment). */
export const MERCHANDISE_SENTIMENT_MIN = 0.7;
export const MERCHANDISE_SENTIMENT_MAX = 1.35;

/**
 * Concessions spend per attendee (integer dollars, before sentiment).
 * Phase 1A: intentionally simple — attendance × base × sentiment.
 * Market/franchise modifiers are deferred; do not build a second demand model.
 */
export const CONCESSIONS_PER_ATTENDEE_BASE = 12;

/** Sentiment multiplier range for concessions (at 0 and 100 sentiment). */
export const CONCESSIONS_SENTIMENT_MIN = 0.8;
export const CONCESSIONS_SENTIMENT_MAX = 1.2;
