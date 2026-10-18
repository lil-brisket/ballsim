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
export const USER_TRADE_INTERRUPT_MIN_PLAYER_OVERALL = 80;

/**
 * A fair offer for a rotation-level player is worth interrupting for when the
 * best incoming player is at least this overall (and incoming value clears
 * USER_TRADE_INTERRUPT_MIN_INCOMING_VALUE).
 */
export const USER_TRADE_INTERRUPT_MIN_ROTATION_OVERALL = 65;

/** At most one CPU → owner trade offer per this many in-game days. */
export const USER_TRADE_OFFER_MIN_DAYS_BETWEEN = 14;

/** Owned players a CPU team may target must be at least this overall. */
export const USER_TRADE_OFFER_TARGET_MIN_OVERALL = 65;

/** CPU roster players considered as the outgoing side of a targeted offer. */
export const USER_TRADE_OFFER_MAX_CPU_PLAYERS = 8;

/**
 * Targeted offers must be fair to the owner: their own team-side value of
 * what they receive is at least this fraction of what they give up.
 */
export const USER_TRADE_OFFER_MIN_FAIRNESS = 0.95;

/**
 * CPU → owner offers start this many days after the regular-season opener
 * (none in preseason or the offseason).
 */
export const USER_TRADE_OFFER_SEASON_GRACE_DAYS = 14;
