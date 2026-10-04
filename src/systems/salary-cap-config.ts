/** Default league player salary cap in integer dollars. */
export const DEFAULT_SALARY_CAP = 100_000_000;

/** Minimum configurable player salary cap for new leagues. */
export const MIN_SALARY_CAP = 25_000_000;

/** Maximum configurable player salary cap for new leagues. */
export const MAX_SALARY_CAP = 250_000_000;

/**
 * Teams may sign a vet-min contract even when it exceeds remaining cap space.
 * Used for emergency / minimum-roster continuity fills.
 */
export const VET_MIN_EXCEPTION_ENABLED = true;
