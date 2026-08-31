/**
 * Centralized eligibility thresholds and scoring weights for BallSim awards.
 * Tunable; evaluators must not hard-code magic numbers.
 */

export const AWARD_METRIC_VERSION = 1;

export const AWARD_CANDIDATE_LIMIT = 5;

export const AWARD_ELIGIBILITY_CONFIG = {
  playerOfMonth: { minGames: 5, minMinutes: 100 },
  rookieOfMonth: { minGames: 4, minMinutes: 80 },
  defensivePlayerOfMonth: { minGames: 5, minMinutes: 100 },
  mvp: { minGames: 50, minMinutes: 1200 },
  dpoy: { minGames: 50, minMinutes: 1000 },
  rookieOfYear: { minGames: 30, minMinutes: 600 },
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
