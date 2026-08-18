import type { EconomicCycle } from "@/domain/entities/league-economy";

/** Reference ticket price for demand normalization (dollars). */
export const DEMAND_REFERENCE_TICKET_PRICE = 45;

/** Price elasticity: higher = more sensitive to price vs reference. */
export const DEMAND_PRICE_ELASTICITY = 0.65;

/**
 * Weight applied to each demand contributor (must sum to 1).
 * fanFacility and opponentWinPct are intentionally small so facilities
 * and marquee opponents nudge demand without rewriting the model.
 */
export const DEMAND_CONTRIBUTOR_WEIGHTS = {
  marketSize: 0.19,
  fanSentiment: 0.2,
  reputation: 0.14,
  awareness: 0.11,
  mediaAttention: 0.09,
  leaguePopularity: 0.09,
  winPct: 0.11,
  fanFacility: 0.03,
  opponentWinPct: 0.04,
} as const;

/** Merchandise revenue per attendee (integer dollars, before sentiment/star). */
export const MERCHANDISE_PER_ATTENDEE_BASE = 8;

/** Sentiment multiplier range for merchandise (at 0 and 100 sentiment). */
export const MERCHANDISE_SENTIMENT_MIN = 0.7;
export const MERCHANDISE_SENTIMENT_MAX = 1.35;

/**
 * Bounded star-power merchandise multiplier (modifies, never replaces,
 * attendance × sentiment). Top overalls → up to STAR_MERCH_MAX.
 */
export const STAR_MERCH_MIN = 0.92;
export const STAR_MERCH_MAX = 1.18;

/** Concessions spend per attendee (integer dollars, before sentiment). */
export const CONCESSIONS_PER_ATTENDEE_BASE = 12;

/** Sentiment multiplier range for concessions (at 0 and 100 sentiment). */
export const CONCESSIONS_SENTIMENT_MIN = 0.8;
export const CONCESSIONS_SENTIMENT_MAX = 1.2;

/**
 * Consumer-cycle multipliers applied AFTER demand score to fill/merch/premium.
 * Not applied to broadcast or sponsorship (those use league climate knobs).
 */
export const CONSUMER_CYCLE_MULTIPLIER: Record<EconomicCycle, number> = {
  growth: 1.04,
  stable: 1.0,
  recession: 0.94,
};

/** Modest playoff demand uplift on playoff-dated home games. */
export const PLAYOFF_DEMAND_UPLIFT = 1.08;

/** Premium seating: fraction of arena capacity by arena level 1–5. */
export const PREMIUM_CAPACITY_FRACTION_BY_ARENA_LEVEL: Record<number, number> = {
  1: 0.06,
  2: 0.08,
  3: 0.1,
  4: 0.12,
  5: 0.14,
};

/** Premium price elasticity (lower than GA — corporate demand less price-sensitive). */
export const PREMIUM_PRICE_ELASTICITY = 0.35;

/** Reference premium ticket price for elasticity normalization. */
export const PREMIUM_REFERENCE_TICKET_PRICE = 180;

export const PREMIUM_TICKET_PRICE_MIN = 50;
export const PREMIUM_TICKET_PRICE_MAX = 800;
