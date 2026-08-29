/**
 * Starting business funds for new franchises.
 *
 * Deliberately lower than the legacy unified-cash $50M: player and staff
 * payroll no longer drain this pool, so $50M would be overly generous for
 * marketing / facilities / sponsorship spend alone.
 *
 * Typical early-game pressures: arena upgrade ~$2.5M, facility opex ~$55K/week,
 * marketing burn at modest budgets. $18M supports several upgrades while
 * still making year-1 investment choices meaningful.
 */
export const DEFAULT_BUSINESS_FUNDS = 18_000_000;

/** Soft warning: business funds below this → Tight health band. */
export const BUSINESS_FUNDS_TIGHT_THRESHOLD = 5_000_000;

/** Soft warning: business funds below this → Critical health band. */
export const BUSINESS_FUNDS_CRITICAL_THRESHOLD = 2_000_000;

/** Strong health: business funds at or above this relative buffer. */
export const BUSINESS_FUNDS_STRONG_THRESHOLD = 25_000_000;
