/** Inclusive draft prospect age band (younger than general roster gen). */
export const MIN_DRAFT_PROSPECT_AGE = 20;
export const MAX_DRAFT_PROSPECT_AGE = 22;

/**
 * Extra prospects beyond pick count so ranking has depth.
 * Multiplied by team count at generation time.
 */
export const DRAFT_EXTRA_PROSPECTS_PER_TEAM = 1;

/** Inclusive attribute/potential noise amplitude for scouting (±). */
export const DRAFT_SCOUT_ATTRIBUTE_NOISE = 8;

/** Inclusive projected-rank jitter (±). */
export const DRAFT_SCOUT_RANK_NOISE = 3;

/** Fixed rookie contract length in years (selection consumes no RNG). */
export const DRAFT_ROOKIE_CONTRACT_YEARS = 2;
