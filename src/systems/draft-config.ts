/** Inclusive draft prospect age band (younger than general roster gen). */
export const MIN_DRAFT_PROSPECT_AGE = 20;
export const MAX_DRAFT_PROSPECT_AGE = 22;

/**
 * Extra prospects beyond pick count so ranking has depth.
 * Multiplied by team count at generation time.
 */
export const DRAFT_EXTRA_PROSPECTS_PER_TEAM = 1;

/**
 * Generation quality (overall is about quality + 5) and potential gap by
 * intended pick. Prospects arrive well short of their ceiling: the top
 * picks start as rotation players and grow into stars by their mid-20s.
 */
export const DRAFT_QUALITY_BY_PICK_BAND = [
  { maxPick: 3, qualityMin: 64, qualityMax: 76, potMin: 15, potMax: 25 },
  { maxPick: 14, qualityMin: 54, qualityMax: 66, potMin: 10, potMax: 20 },
  { maxPick: 30, qualityMin: 49, qualityMax: 61, potMin: 6, potMax: 16 },
  { maxPick: 45, qualityMin: 45, qualityMax: 57, potMin: 3, potMax: 12 },
  { maxPick: 999, qualityMin: 40, qualityMax: 53, potMin: 0, potMax: 7 },
] as const;

export const DRAFT_LATE_STEAL_CHANCE = 0.05;
export const DRAFT_LATE_STEAL_QUALITY_MIN = 53;
export const DRAFT_LATE_STEAL_QUALITY_MAX = 65;
/** A late steal also has a lottery pick's room to grow. */
export const DRAFT_LATE_STEAL_POT_MIN = 8;
export const DRAFT_LATE_STEAL_POT_MAX = 16;

/** Inclusive attribute/potential noise amplitude for scouting (±). */
export const DRAFT_SCOUT_ATTRIBUTE_NOISE = 8;

/** Inclusive projected-rank jitter (±). */
export const DRAFT_SCOUT_RANK_NOISE = 3;

/** Fixed rookie contract length in years (selection consumes no RNG). */
export const DRAFT_ROOKIE_CONTRACT_YEARS = 2;
