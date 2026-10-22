/**
 * Tunable free-agency interest. Money (offer vs market, -40..+20) and award
 * reputation add to the baseline; `motivations` are the most points each
 * non-money factor can add or remove at full personality weight (see
 * free-agency-motivations). Money stays the biggest factor.
 */
export const FREE_AGENCY_INTEREST_CONFIG = {
  /** Baseline score when all factor contributions are 0. */
  baselineScore: 50,
  /** Player is interested when score >= this threshold. */
  interestThreshold: 50,
  /**
   * Reserved for future weighted factor sums.
   * Award reputation is applied directly as a score delta (capped).
   */
  factorWeights: {
    money: 1,
    teamQuality: 0,
    playingTime: 0,
    location: 0,
    championshipOpportunity: 0,
    personality: 0,
    reputation: 1,
  },
  motivations: {
    /** Team win% and roster strength; scaled by competitiveness / 50. */
    winning: 6,
    /** Projected role on that roster. */
    playingTime: 6,
    /** Market size. */
    market: 2,
    /** Bonus for his current or last team; scaled by loyalty / 50. */
    loyalty: 6,
    /** Head coach leadership and player development. */
    coach: 3,
  },
} as const;

export type FreeAgencyInterestConfig = typeof FREE_AGENCY_INTEREST_CONFIG;
