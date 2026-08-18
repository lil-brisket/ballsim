/**
 * Pre-change demand baselines (schema ≤27 weight set).
 * Used to ensure demand extensions produce intentional, small shifts.
 *
 * Captured before fanFacility / opponentWinPct weight changes:
 * mid score 53, high 76, low 27 for the representative input sets below.
 */
export const DEMAND_BASELINE_MID_SCORE = 53;
export const DEMAND_BASELINE_HIGH_SCORE = 76;
export const DEMAND_BASELINE_LOW_SCORE = 27;

/** Allowed absolute score drift after intentional weight rebalance. */
export const DEMAND_BASELINE_MAX_DRIFT = 4;

export const DEMAND_BASELINE_MID_INPUTS = {
  marketSize: 60,
  fanSentiment: 55,
  reputation: 50,
  awareness: 45,
  mediaAttention: 40,
  leaguePopularity: 55,
  winPct: 0.55,
} as const;

export const DEMAND_BASELINE_HIGH_INPUTS = {
  marketSize: 85,
  fanSentiment: 80,
  reputation: 75,
  awareness: 70,
  mediaAttention: 70,
  leaguePopularity: 60,
  winPct: 0.8,
} as const;

export const DEMAND_BASELINE_LOW_INPUTS = {
  marketSize: 30,
  fanSentiment: 25,
  reputation: 30,
  awareness: 20,
  mediaAttention: 15,
  leaguePopularity: 40,
  winPct: 0.25,
} as const;
