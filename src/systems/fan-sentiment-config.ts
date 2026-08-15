/** Smoothing factor per daily update (0–1). Lower = slower movement. */
export const FAN_SENTIMENT_SMOOTHING = 0.15;

/** Weight for each contributor to the sentiment target (sum = 1). */
export const FAN_SENTIMENT_WEIGHTS = {
  winResult: 0.35,
  winPct: 0.25,
  reputation: 0.15,
  mediaAttention: 0.1,
  marketingAwareness: 0.15,
} as const;

/** Bump applied on a home win (added to target before smoothing). */
export const FAN_SENTIMENT_HOME_WIN_BUMP = 8;
/** Penalty on a home loss. */
export const FAN_SENTIMENT_HOME_LOSS_PENALTY = 6;
