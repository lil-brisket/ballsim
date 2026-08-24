/** Relocation tenure, fees, and stage progression. */

/** Seasons of cooldown after completing a relocation (generational). */
export const RELOCATION_COOLDOWN_SEASONS = 8;

/** Minimum seasons in the current city before a first (or next) move may start. */
export const RELOCATION_MIN_SEASONS_IN_CITY = 6;

/** Seasons of cooldown after a rejected or cancelled attempt. */
export const RELOCATION_FAILED_ATTEMPT_COOLDOWN_SEASONS = 2;

/** Base transition fee (integer dollars); may scale with positive market delta. */
export const RELOCATION_TRANSITION_FEE = 25_000_000;

/** Extra fee per market-size point of positive destination delta. */
export const RELOCATION_FEE_PER_MARKET_SIZE_POINT = 400_000;

/**
 * Primary demand-facing shock on relocate: fan sentiment only.
 * Do not stack large reputation + awareness hits (demand already composes them).
 */
export const RELOCATION_FAN_SENTIMENT_SHOCK_BASE = 22;
export const RELOCATION_FAN_SENTIMENT_SHOCK_PER_HISTORY_SEASON = 2;
export const RELOCATION_FAN_SENTIMENT_SHOCK_MAX = 45;

/** Contextual reputation hit only for long successful tenure abandoned. */
export const RELOCATION_REPUTATION_SHOCK_LONG_TENURE = 3;
export const RELOCATION_REPUTATION_LONG_TENURE_SEASONS = 10;
export const RELOCATION_REPUTATION_MIN_PRIOR = 60;

/** Market size bands for assessment. */
export const RELOCATION_WEAK_MARKET_SIZE = 48;
export const RELOCATION_STRONG_MARKET_SIZE = 62;
export const RELOCATION_SOFT_REALIZATION = 0.7;
export const RELOCATION_WEAK_REALIZATION = 0.58;

export const RELOCATION_STAGE_ORDER = [
  "none",
  "evaluate",
  "explore",
  "negotiate",
  "league_review",
  "approved",
  "transition",
  "complete",
] as const;

export const RELOCATION_CANCELLABLE_STAGES = new Set([
  "explore",
  "negotiate",
]);
