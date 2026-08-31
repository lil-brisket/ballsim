/**
 * Tunable free-agency interest defaults for v1.
 * Factor weights are stubs — the default evaluator does not apply formulas yet,
 * except award reputation which contributes a bounded expectation bonus.
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
    money: 0,
    teamQuality: 0,
    playingTime: 0,
    location: 0,
    championshipOpportunity: 0,
    personality: 0,
    reputation: 1,
  },
} as const;

export type FreeAgencyInterestConfig = typeof FREE_AGENCY_INTEREST_CONFIG;
