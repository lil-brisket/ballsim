import type { GameId, SeasonId } from "@/domain/ids";

export type GameDayPromotionCategory =
  | "theme_night"
  | "giveaway"
  | "ticket_promotion"
  | "entertainment"
  | "community_pr";

export const GAME_DAY_PROMOTION_CATEGORIES: readonly GameDayPromotionCategory[] =
  [
    "theme_night",
    "giveaway",
    "ticket_promotion",
    "entertainment",
    "community_pr",
  ] as const;

export type GameDayPromotionObjective =
  | "attendance"
  | "revenue"
  | "fan_engagement"
  | "community"
  | "awareness"
  | "balanced";

export const GAME_DAY_PROMOTION_OBJECTIVES: readonly GameDayPromotionObjective[] =
  [
    "attendance",
    "revenue",
    "fan_engagement",
    "community",
    "awareness",
    "balanced",
  ] as const;

export type GameDayPromotionTargetAudience =
  | "families"
  | "students"
  | "youth"
  | "community"
  | "general";

export const GAME_DAY_PROMOTION_TARGET_AUDIENCES: readonly GameDayPromotionTargetAudience[] =
  ["families", "students", "youth", "community", "general"] as const;

export type GameDayPromotionAssignmentStatus =
  | "scheduled"
  | "committed"
  | "completed"
  | "cancelled";

export const GAME_DAY_PROMOTION_ASSIGNMENT_STATUSES: readonly GameDayPromotionAssignmentStatus[] =
  ["scheduled", "committed", "completed", "cancelled"] as const;

export type FanResponse =
  | "negative"
  | "neutral"
  | "positive"
  | "very_positive";

export const FAN_RESPONSES: readonly FanResponse[] = [
  "negative",
  "neutral",
  "positive",
  "very_positive",
] as const;

export type GameDayPromotionEffects = {
  /** Demand-score points on the same 0–100 scale as calculateTicketDemand. */
  demandBoost: number;
  merchMultiplier: number;
  concessionMultiplier: number;
  /** Ticket promos only; < 1 reduces effective GA price during seat math. */
  ticketPriceMultiplier?: number;
  awarenessBump: number;
  sentimentBump: number;
  reputationBump: number;
  mediaBump: number;
};

export type GameDayPromotionRequirements = {
  minMarketSize?: number;
  minFanSentiment?: number;
  openingNightOnly?: boolean;
  /** Divisional matchup affinity — not true rivalry data. */
  divisionMatchupOnly?: boolean;
};

/**
 * Static catalog definition. Does not store calculated game results.
 */
export type GameDayPromotionDefinition = {
  id: string;
  name: string;
  description: string;
  category: GameDayPromotionCategory;
  /** AI semantic intent; not necessarily shown in UI. */
  objective: GameDayPromotionObjective;
  targetAudience: GameDayPromotionTargetAudience;
  cost: number;
  leadTimeDays: number;
  quantityAvailable?: number;
  effects: GameDayPromotionEffects;
  maxUsesPerSeason: number;
  cooldownDays: number;
  requirements?: GameDayPromotionRequirements;
};

/**
 * Frozen projection snapshot at schedule time for projected-vs-actual.
 */
export type GameDayPromotionProjection = {
  attendanceMid: number;
  attendanceLow: number;
  attendanceHigh: number;
  netImpactMid: number;
  netImpactLow: number;
  netImpactHigh: number;
  attendanceDifferenceMid: number;
  cost: number;
};

export type GameDayPromotionAssignment = {
  promotionId: string;
  gameId: GameId;
  scheduledOn: string;
  costPaid: number;
  status: GameDayPromotionAssignmentStatus;
  projectedSnapshot?: GameDayPromotionProjection;
};

/**
 * Authoritative detailed historical record.
 * attendanceDifference / *RevenueDifference are counterfactual model estimates
 * (actual − baseline), not observed causal measurements.
 */
export type GameDayPromotionResult = {
  promotionId: string;
  gameId: GameId;
  baselineAttendance: number;
  actualAttendance: number;
  attendanceDifference: number;
  baselineTicketRevenue: number;
  actualTicketRevenue: number;
  ticketRevenueDifference: number;
  baselineMerchRevenue: number;
  actualMerchRevenue: number;
  merchRevenueDifference: number;
  baselineConcessionsRevenue: number;
  actualConcessionsRevenue: number;
  concessionsRevenueDifference: number;
  eventCost: number;
  netFinancialImpact: number;
  projectedAttendance: number;
  projectedAttendanceLow: number;
  projectedAttendanceHigh: number;
  projectedNetImpact: number;
  projectedNetImpactLow: number;
  projectedNetImpactHigh: number;
  attendanceVariance: number;
  netImpactVariance: number;
  effectivenessScore: number;
  fanResponse: FanResponse;
  underperformed: boolean;
  giveawaysDistributed?: number;
  giveawaysSoldOut?: boolean;
  varianceApplied: number;
};

export type GameDayPromotionSeasonState = {
  seasonId: SeasonId;
  /** V1: at most one assignment per gameId. */
  assignments: Record<string, GameDayPromotionAssignment>;
  results: Record<string, GameDayPromotionResult>;
  usageByPromotionId: Record<string, number>;
  lastUsedDateByPromotionId: Record<string, string>;
  /** Sum of active (scheduled/committed) assignment costs for budget UI. */
  committedSpend: number;
};

export function isGameDayPromotionCategory(
  value: unknown,
): value is GameDayPromotionCategory {
  return (
    typeof value === "string" &&
    (GAME_DAY_PROMOTION_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isGameDayPromotionObjective(
  value: unknown,
): value is GameDayPromotionObjective {
  return (
    typeof value === "string" &&
    (GAME_DAY_PROMOTION_OBJECTIVES as readonly string[]).includes(value)
  );
}

export function isGameDayPromotionTargetAudience(
  value: unknown,
): value is GameDayPromotionTargetAudience {
  return (
    typeof value === "string" &&
    (GAME_DAY_PROMOTION_TARGET_AUDIENCES as readonly string[]).includes(value)
  );
}

export function isGameDayPromotionAssignmentStatus(
  value: unknown,
): value is GameDayPromotionAssignmentStatus {
  return (
    typeof value === "string" &&
    (GAME_DAY_PROMOTION_ASSIGNMENT_STATUSES as readonly string[]).includes(value)
  );
}

export function isFanResponse(value: unknown): value is FanResponse {
  return (
    typeof value === "string" &&
    (FAN_RESPONSES as readonly string[]).includes(value)
  );
}

export function createEmptyGameDayPromotionSeasonState(
  seasonId: SeasonId,
): GameDayPromotionSeasonState {
  return {
    seasonId,
    assignments: {},
    results: {},
    usageByPromotionId: {},
    lastUsedDateByPromotionId: {},
    committedSpend: 0,
  };
}
