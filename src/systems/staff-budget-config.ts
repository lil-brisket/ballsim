/**
 * League-wide staff/coaching budget (commitment limit, not cash).
 *
 * Full quality-50 staff (~GM + HC + 2 assistants + scout + trainer + finance +
 * marketing) totals ~$9.5M at base salaries; $12M leaves hiring headroom.
 */
export const DEFAULT_STAFF_BUDGET = 12_000_000;

/** Minimum configurable staff budget for new leagues. */
export const MIN_STAFF_BUDGET = 5_000_000;

/** Maximum configurable staff budget for new leagues. */
export const MAX_STAFF_BUDGET = 30_000_000;
