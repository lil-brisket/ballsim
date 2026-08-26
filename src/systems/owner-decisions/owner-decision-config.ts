/** Budget and quality thresholds for CPU → user trade offers. */

/** Max surplus assets considered per motivated CPU team. */
export const USER_TRADE_OFFER_MAX_CPU_ASSETS = 3;

/** Max plausible user assets considered when building an offer. */
export const USER_TRADE_OFFER_MAX_USER_ASSETS = 5;

/**
 * Minimum objective incoming value (from user perspective of what they receive)
 * OR absolute net swing for an offer to interrupt simulation.
 */
export const USER_TRADE_INTERRUPT_MIN_INCOMING_VALUE = 62;

/** Minimum absolute objective net swing to interrupt. */
export const USER_TRADE_INTERRUPT_MIN_ABS_NET = 18;

/** Minimum player overall among assets offered to the user to count as "meaningful". */
export const USER_TRADE_INTERRUPT_MIN_PLAYER_OVERALL = 68;
