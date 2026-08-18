import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";
import type { OwnerObjectiveType } from "@/domain/entities/owner-objective";

/** Mean roster overall at or above this → make_playoffs. */
export const OWNER_OBJECTIVE_STRONG_OVERALL = 72;

/** Mean roster overall at or above this (and below strong) → mid win target. */
export const OWNER_OBJECTIVE_MID_OVERALL = 65;

export const OWNER_OBJECTIVE_WIN_TARGET_MID = 40;
export const OWNER_OBJECTIVE_WIN_TARGET_WEAK = 35;

/** Payroll limit objective uses the league salary cap. */
export const OWNER_OBJECTIVE_PAYROLL_LIMIT = DEFAULT_SALARY_CAP;

/**
 * Only these types post cash reward/penalty through gameplay consequences.
 * New mandate types use patience + notifications only.
 */
export const OWNER_OBJECTIVE_CASH_CONSEQUENCE_TYPES: readonly OwnerObjectiveType[] =
  ["make_playoffs", "minimum_win_total", "payroll_limit"];

export function objectiveAppliesCashConsequence(
  type: OwnerObjectiveType,
): boolean {
  return OWNER_OBJECTIVE_CASH_CONSEQUENCE_TYPES.includes(type);
}

export const OWNER_STREAK_NOTIFICATION_THRESHOLD = 5;

export const SIGNIFICANT_FINANCIAL_CHANGE = 2_000_000;

/** Fill rate at or above this (and capacity full) → sellout notification. */
export const SELLOUT_FILL_RATE_PCT = 100;

/** Fill rate below this → poor attendance notification. */
export const POOR_ATTENDANCE_FILL_RATE_PCT = 40;

/** Awareness band boundaries for sparse notifications. */
export const AWARENESS_NOTIFICATION_BANDS = [25, 50, 75] as const;

/** Warn when runway weeks are at or below this and net burn > 0. */
export const CASH_RUNWAY_WARNING_WEEKS = 8;

export const GAMEPLAY_LOSS_EXPENSE = 50_000;
export const GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE = 2_000_000;
export const GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE = 1_500_000;
export const GAMEPLAY_OBJECTIVE_REWARD = 1_000_000;
export const GAMEPLAY_OBJECTIVE_PENALTY = 500_000;

/** AI free-agency: one-year deals at this fraction of remaining cap space (capped). */
export const AI_FA_SALARY_CAP_FRACTION = 0.15;
export const AI_FA_MAX_SALARY = 8_000_000;
export const AI_FA_MIN_SALARY = 1_000_000;

/** Small-market threshold for contextual generation (marketSize 1–99). */
export const OWNER_OBJECTIVE_SMALL_MARKET = 40;

/** Franchise value growth target for multi-season / career objectives (%). */
export const OWNER_OBJECTIVE_VALUE_GROWTH_PCT = 25;

export const OWNER_OBJECTIVE_MULTI_SEASON_HORIZON = 3;
export const OWNER_OBJECTIVE_CAREER_CHAMPIONSHIPS = 3;
export const OWNER_OBJECTIVE_CAREER_PLAYOFFS = 5;
export const OWNER_OBJECTIVE_YOUTH_OVERALL_GAIN = 3;
export const OWNER_OBJECTIVE_YOUNG_SHARE_TARGET = 40;
