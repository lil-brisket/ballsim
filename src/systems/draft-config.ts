/** Inclusive draft prospect age band (younger than general roster gen). */
export const MIN_DRAFT_PROSPECT_AGE = 20;
export const MAX_DRAFT_PROSPECT_AGE = 22;

/**
 * Extra prospects beyond pick count so ranking has depth.
 * Multiplied by team count at generation time.
 */
export const DRAFT_EXTRA_PROSPECTS_PER_TEAM = 1;

export const DRAFT_QUALITY_BY_PICK_BAND = [
  { maxPick: 14, qualityMin: 62, qualityMax: 85, potMin: 8, potMax: 22 },
  { maxPick: 30, qualityMin: 55, qualityMax: 76, potMin: 4, potMax: 12 },
  { maxPick: 45, qualityMin: 48, qualityMax: 68, potMin: 2, potMax: 8 },
  { maxPick: 999, qualityMin: 40, qualityMax: 58, potMin: 0, potMax: 5 },
] as const;

export const DRAFT_LATE_STEAL_CHANCE = 0.05;
export const DRAFT_LATE_STEAL_QUALITY_MIN = 60;
export const DRAFT_LATE_STEAL_QUALITY_MAX = 78;

/** Inclusive attribute/potential noise amplitude for scouting (±). */
export const DRAFT_SCOUT_ATTRIBUTE_NOISE = 8;

/** Inclusive projected-rank jitter (±). */
export const DRAFT_SCOUT_RANK_NOISE = 3;

/** Fixed rookie contract length in years (selection consumes no RNG). */
export const DRAFT_ROOKIE_CONTRACT_YEARS = 2;
