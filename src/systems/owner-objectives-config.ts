import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";

/** Mean roster overall at or above this → make_playoffs. */
export const OWNER_OBJECTIVE_STRONG_OVERALL = 72;

/** Mean roster overall at or above this (and below strong) → 40-win target. */
export const OWNER_OBJECTIVE_MID_OVERALL = 65;

export const OWNER_OBJECTIVE_WIN_TARGET_MID = 40;
export const OWNER_OBJECTIVE_WIN_TARGET_WEAK = 35;

/** Payroll limit objective uses the league salary cap. */
export const OWNER_OBJECTIVE_PAYROLL_LIMIT = DEFAULT_SALARY_CAP;

export const OWNER_STREAK_NOTIFICATION_THRESHOLD = 5;

export const SIGNIFICANT_FINANCIAL_CHANGE = 500_000;

export const GAMEPLAY_WIN_REVENUE = 150_000;
export const GAMEPLAY_LOSS_EXPENSE = 50_000;
export const GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE = 2_000_000;
export const GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE = 1_500_000;
export const GAMEPLAY_OBJECTIVE_REWARD = 1_000_000;
export const GAMEPLAY_OBJECTIVE_PENALTY = 500_000;

/** AI free-agency: one-year deals at this fraction of remaining cap space (capped). */
export const AI_FA_SALARY_CAP_FRACTION = 0.15;
export const AI_FA_MAX_SALARY = 8_000_000;
export const AI_FA_MIN_SALARY = 1_000_000;
