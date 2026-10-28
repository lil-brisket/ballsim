/**
 * Centralized eligibility thresholds and scoring weights for BallSim awards.
 * Tunable; evaluators must not hard-code magic numbers.
 */

export const AWARD_METRIC_VERSION = 1;

export const AWARD_CANDIDATE_LIMIT = 5;

/**
 * Voters do not copy the scoring table. Each contender within `maxScoreGap`
 * points of the leader gets ballot weight exp(-gap / scoreSpread), so a tight
 * race can go to the runner-up while a clear leader nearly always wins.
 */
export const AWARD_VOTING_CONFIG = {
  scoreSpread: 1,
  maxScoreGap: 5,
} as const;

/** Season length the season-level minimums below are set for. */
export const AWARD_REFERENCE_SEASON_GAMES = 82;

/**
 * A season-level minimum (games or minutes) for a league that plays
 * `gamesPerTeam` regular-season games: proportional below the reference
 * length, unchanged at or above it, never below 1. Without this a short
 * season (CBL plays 22) could never produce a qualifying player. Monthly
 * minimums are per month and do not scale.
 */
export function scaleSeasonMinimum(
  minimum: number,
  gamesPerTeam: number,
): number {
  if (!(gamesPerTeam > 0) || gamesPerTeam >= AWARD_REFERENCE_SEASON_GAMES) {
    return minimum;
  }
  return Math.max(
    1,
    Math.round((minimum * gamesPerTeam) / AWARD_REFERENCE_SEASON_GAMES),
  );
}

/**
 * Share of a full-length season a league plays (1 at 82 games or more).
 * Year-end award reputation is weighted by it: an award won over a short
 * season is a smaller sample and proves less in free agency.
 */
export function seasonLengthFactor(gamesPerTeam: number): number {
  if (!(gamesPerTeam > 0) || gamesPerTeam >= AWARD_REFERENCE_SEASON_GAMES) {
    return 1;
  }
  return gamesPerTeam / AWARD_REFERENCE_SEASON_GAMES;
}

/**
 * Copy of a threshold group with every `min*` field scaled by
 * {@link scaleSeasonMinimum}; other fields (maxAge, maxStartPct) unchanged.
 */
export function scaleSeasonMinimums<T extends Record<string, number>>(
  thresholds: T,
  gamesPerTeam: number,
): T {
  const scaled: Record<string, number> = { ...thresholds };
  for (const [key, value] of Object.entries(thresholds)) {
    if (key.startsWith("min")) {
      scaled[key] = scaleSeasonMinimum(value, gamesPerTeam);
    }
  }
  return scaled as T;
}

export const AWARD_ELIGIBILITY_CONFIG = {
  playerOfMonth: { minGames: 5, minMinutes: 100 },
  rookieOfMonth: { minGames: 4, minMinutes: 80 },
  defensivePlayerOfMonth: { minGames: 5, minMinutes: 100 },
  mvp: { minGames: 50, minMinutes: 1200 },
  dpoy: { minGames: 50, minMinutes: 1000 },
  rookieOfYear: {
    minGames: 30,
    minMinutes: 600,
    /** Generated vets without a draft year cannot take ROY. */
    maxAge: 24,
  },
  sixthMan: {
    minGames: 30,
    minMinutes: 600,
    /** Majority of appearances must be from the bench. */
    maxStartPct: 0.25,
  },
  mostImproved: {
    minCurrentSeasonGames: 30,
    minCurrentSeasonMinutes: 600,
    minPreviousSeasonGames: 30,
    minPreviousSeasonMinutes: 600,
  },
  coachOfYear: { minGames: 1 },
} as const;

export const AWARD_SCORING_CONFIG = {
  playerOfMonth: {
    production: 0.45,
    efficiency: 0.25,
    teamSuccess: 0.2,
    availability: 0.1,
  },
  rookieOfMonth: {
    production: 0.45,
    efficiency: 0.25,
    teamSuccess: 0.2,
    availability: 0.1,
  },
  defensivePlayerOfMonth: {
    defensiveImpact: 0.7,
    teamDefense: 0.2,
    availability: 0.1,
  },
  mvp: {
    individualImpact: 0.4,
    efficiency: 0.2,
    teamSuccess: 0.2,
    availability: 0.1,
    twoWayImpact: 0.1,
  },
  dpoy: {
    defensiveImpact: 0.75,
    teamDefense: 0.15,
    advancedContextual: 0.1,
  },
  roy: {
    production: 0.5,
    efficiency: 0.3,
    availability: 0.2,
  },
  sixthMan: {
    production: 0.45,
    efficiency: 0.25,
    benchImpact: 0.2,
    availability: 0.1,
  },
  mostImproved: {
    scoringDelta: 0.25,
    efficiencyDelta: 0.25,
    playmakingDelta: 0.15,
    reboundingDelta: 0.15,
    defensiveDelta: 0.1,
    roleAdjustedDelta: 0.1,
  },
  coachOfYear: {
    currentSuccess: 0.5,
    improvement: 0.3,
    leagueStanding: 0.15,
    playoffQualification: 0.05,
  },
} as const;

/** Free-agency award reputation (expectations only — never OVR/attributes). */
export const AWARD_REPUTATION_CONFIG = {
  /** Cap on total reputation bonus so ability/age dominate. */
  maxBonus: 12,
  /** Decay factor applied per season of age. */
  seasonDecay: 0.72,
  weights: {
    mvp: 8,
    dpoy: 6,
    roy: 5,
    sixth_man: 4,
    most_improved: 4,
    coach_of_year: 0,
    player_of_month: 1.2,
    rookie_of_month: 1,
    defensive_player_of_month: 1,
  } as const,
} as const;

export type AwardEligibilityConfig = typeof AWARD_ELIGIBILITY_CONFIG;
export type AwardScoringConfig = typeof AWARD_SCORING_CONFIG;
