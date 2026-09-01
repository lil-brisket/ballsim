import { PLAYER_POSITIONS } from "@/domain/entities/player";
import type { RosterRulesConfigInput } from "@/systems/roster-rules";

/** Default roster bounds for trade validation (signing/waiving/trades). */
export const TRADE_ROSTER_RULES: RosterRulesConfigInput = {
  minRosterSize: 8,
  maxRosterSize: 15,
  startingLineupSize: 5,
  benchSize: 9,
  inactiveSize: 1,
  allowedPositions: [...PLAYER_POSITIONS],
};

/** Over-cap teams may receive at most outgoing * (1 + this percent). */
export const TRADE_SALARY_MATCHING_PERCENT = 0.25;

/** Trade Finder returns at most this many valid candidates. */
export const TRADE_FINDER_MAX_CANDIDATES = 50;

/** Round-1 pick baseline trade value (legacy + floor for slot curve). */
export const DRAFT_PICK_VALUE_ROUND_1 = 80;

/** Round-2 pick baseline trade value (legacy + floor for slot curve). */
export const DRAFT_PICK_VALUE_ROUND_2 = 50;

/** Bonus per incoming asset already on the evaluating team's trade block. */
export const TRADE_BLOCK_VALUE_BONUS = 10;

/** Weights for composite player base asset value (sum ≈ 1). */
export const PLAYER_TRADE_VALUE_WEIGHTS = {
  ability: 0.42,
  potential: 0.14,
  ageCurve: 0.1,
  performance: 0.14,
  trajectory: 0.08,
  contract: 0.08,
  injury: 0.04,
} as const;

/** Age-band value adjustments applied to ability baseline. */
export const AGE_VALUE_MODIFIERS = {
  youthBonus: 6,
  primeBonus: 2,
  declinePenalty: -8,
  youthMaxAge: 23,
  primeMaxAge: 29,
} as const;

/** Contract surplus / length adjustments (points on value scale). */
export const CONTRACT_VALUE_MODIFIERS = {
  overpaidPenaltyPerMillion: 1.2,
  underpaidBonusPerMillion: 0.8,
  longDealYearsThreshold: 3,
  longDealOverpaidExtra: 4,
  fairSalaryPerOvr: 180_000,
} as const;

/** Injury penalties by severity band. */
export const INJURY_PENALTIES = {
  out: 12,
  limited: 5,
  monitor: 2,
} as const;

/** Non-linear overall-pick value curve anchors (overallPick → value). */
export const PICK_VALUE_CURVE = [
  { overallPick: 1, value: 120 },
  { overallPick: 5, value: 105 },
  { overallPick: 10, value: 90 },
  { overallPick: 14, value: 80 },
  { overallPick: 20, value: 65 },
  { overallPick: 30, value: 50 },
  { overallPick: 45, value: 38 },
  { overallPick: 60, value: 28 },
] as const;

/** Future-year discount per season away from next draft. */
export const PICK_YEAR_DISCOUNT_PER_YEAR = 0.08;

/** Uncertainty band half-width as fraction of league size early/late. */
export const PICK_UNCERTAINTY_CONFIG = {
  earlySeasonFraction: 0.35,
  lateSeasonFraction: 0.08,
  minHalfWidth: 1,
  maxHalfWidth: 12,
} as const;

/**
 * Standings tiers for pick valuation — not a playoff-probability model.
 * Rank is 1 = worst record (lottery end).
 */
export const STANDINGS_TIER_THRESHOLDS = {
  strongLotteryMaxRank: 4,
  likelyLotteryMaxRank: 8,
  playInMaxRank: 12,
  likelyPlayoffMaxRank: 16,
} as const;

export type StandingsTier =
  | "strong_lottery"
  | "likely_lottery"
  | "play_in_range"
  | "likely_playoff"
  | "contender";

/** Additive team-fit adjustment bands (clamped). */
export const TEAM_FIT_ADJUSTMENT_BANDS = {
  rosterFitMin: -12,
  rosterFitMax: 14,
  strategicFitMin: -10,
  strategicFitMax: 12,
  contractMin: -10,
  contractMax: 6,
  financialMin: -8,
  financialMax: 4,
  combinedMultiplierMin: 0.75,
  combinedMultiplierMax: 1.25,
} as const;

/** Strategic posture additive adjustments for youth/picks/veterans. */
export const STRATEGIC_POSTURE_ADJUSTMENTS = {
  rebuilding: { youth: 8, pick: 10, veteran: -6 },
  developing: { youth: 5, pick: 6, veteran: -2 },
  maintaining: { youth: 0, pick: 0, veteran: 0 },
  contending: { youth: -3, pick: -4, veteran: 6 },
  all_in: { youth: -5, pick: -8, veteran: 10 },
  retrenching: { youth: 4, pick: 5, veteran: -3 },
  growing: { youth: 3, pick: 3, veteran: 0 },
} as const;

/** Retention priority weights (0–100 scale contributions). */
export const RETENTION_PRIORITY_WEIGHTS = {
  topOverallOnTeam: 40,
  highPotentialYoung: 30,
  recentDraftPickBonus: 25,
  recentlyAcquiredBonus: 35,
  onTradeBlockPenalty: -80,
  redundantVetPenalty: -20,
  coreThreshold: 75,
  doNotShopThreshold: 85,
} as const;

/** Trade desirability scoring weights. */
export const TRADE_DESIRABILITY_WEIGHTS = {
  onBlockBonus: 40,
  surplusBonus: 20,
  retentionPenaltyScale: 0.9,
  needAcquireBonus: 35,
  recentlyAcquiredMovePenalty: 30,
} as const;

/** Decision-layer acceptance: net-value / fit blend. */
export const TRADE_ACCEPTANCE_THRESHOLDS = {
  valueWeight: 0.55,
  rosterFitWeight: 0.2,
  strategicFitWeight: 0.15,
  financialWeight: 0.1,
  varianceBand: 6,
  counterMinNet: -8,
  counterMaxNet: 12,
} as const;

/** Minimum offer quality to interrupt simulation. */
export const TRADE_OFFER_QUALITY_FLOOR = 55;

/** Max CPU→user offers enqueued per team per day. */
export const TRADE_OFFER_DAILY_CAP = 1;

/** Offer expiration windows (calendar days). */
export const TRADE_OFFER_EXPIRATION = {
  normalDays: 5,
  nearDeadlineDays: 2,
  deadlineProximityDays: 7,
  offseasonDays: 14,
} as const;

/**
 * Sample-size-aware recent vs season performance blend.
 * Recent weight is 0 below minGamesForRecent.
 */
export const RECENT_PERFORMANCE_WEIGHT = {
  minGamesForRecent: 5,
  limitedGames: 9,
  limitedRecentWeight: 0.2,
  fullRecentWeight: 0.3,
  rollingWindow: 10,
  expectedPtsPerOvr: 0.28,
} as const;

/** Days since acquisition treated as "recently acquired". */
export const RECENTLY_ACQUIRED_DAYS = 30;
