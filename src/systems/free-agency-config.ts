/**
 * Tunable free-agency interest defaults for v1.
 * Factor weights are stubs — the default evaluator does not apply formulas yet.
 */
export const FREE_AGENCY_INTEREST_CONFIG = {
  /** Baseline score when all factor contributions are 0. */
  baselineScore: 50,
  /** Player is interested when score >= this threshold. */
  interestThreshold: 50,
  /**
   * Reserved for future weighted factor sums.
   * v1 default evaluator ignores these and keeps factor contributions at 0.
   */
  factorWeights: {
    money: 0,
    teamQuality: 0,
    playingTime: 0,
    location: 0,
    championshipOpportunity: 0,
    personality: 0,
  },
} as const;

export type FreeAgencyInterestConfig = typeof FREE_AGENCY_INTEREST_CONFIG;
