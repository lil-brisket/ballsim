/** Monthly smoothing toward reputation target. */
export const REPUTATION_MONTHLY_SMOOTHING = 0.12;

export const REPUTATION_TARGET_WEIGHTS = {
  winPct: 0.35,
  fanSentiment: 0.25,
  mediaAttention: 0.15,
  facilityQuality: 0.15,
  leaguePopularity: 0.1,
} as const;
