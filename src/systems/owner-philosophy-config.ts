/**
 * Owner philosophy profiles: weights, tolerances, and preferred objective metrics.
 *
 * Distinct from FranchiseOps.aiProfile — that drives AI franchise ops decisions.
 * Naming overlap (e.g. win_now) is conceptual only; do not share types or sync.
 */

import type { OwnerObjectiveCategory } from "@/domain/entities/owner-objective";
import type { OwnerObjectiveType } from "@/domain/entities/owner-objective";
import type { OwnerPhilosophy } from "@/domain/entities/owner-philosophy";
import {
  OWNER_PATIENCE_MAX,
  OWNER_PATIENCE_MIN,
} from "@/domain/entities/owner-philosophy";

export type OwnerCategoryWeights = Record<OwnerObjectiveCategory, number>;

export type OwnerWinTolerance = {
  /** Wins at or below this are unacceptable for seasonal evaluation pressure. */
  unacceptable: number;
  /** Wins at or above this are acceptable for a rebuild/development year. */
  acceptable: number;
  /** Wins at or above this are considered strong. */
  strong: number;
};

export type OwnerPhilosophyProfile = {
  philosophy: OwnerPhilosophy;
  /** Relative category priority; need not sum to 1. */
  categoryWeights: OwnerCategoryWeights;
  winTolerance: OwnerWinTolerance;
  /**
   * Payroll pressure 0–1: higher → stricter payroll_limit / lower cap fraction.
   * Win Now uses a low value (more tolerance for spending).
   */
  payrollPressure: number;
  /** Whether seasonal generation prefers improve_finances / positive_cash. */
  requiresProfitability: boolean;
  /** Minimum fan sentiment the mandate treats as acceptable. */
  sentimentFloor: number;
  /** Minimum awareness the mandate treats as acceptable. */
  awarenessFloor: number;
  /** Minimum attendance fill-rate % treated as acceptable. */
  attendanceFloorPct: number;
  startingPatience: number;
  preferredPrimary: readonly OwnerObjectiveType[];
  preferredSecondary: readonly OwnerObjectiveType[];
  preferredLongTerm: readonly OwnerObjectiveType[];
};

/**
 * Patience adjustment applied when a seasonal primary/secondary resolves.
 * Low patience slightly tightens next-season win/revenue targets.
 */
export const OWNER_PATIENCE_COMPLETE_DELTA = 4;
export const OWNER_PATIENCE_FAIL_DELTA = -6;
export const OWNER_PATIENCE_PRIMARY_FAIL_EXTRA = -4;

/** Multiplier on win targets when patience is below this. */
export const OWNER_PATIENCE_TIGHTEN_THRESHOLD = 40;
export const OWNER_PATIENCE_TIGHTEN_WIN_FACTOR = 1.05;

export const OWNER_PHILOSOPHY_PROFILES: Record<
  OwnerPhilosophy,
  OwnerPhilosophyProfile
> = {
  win_now: {
    philosophy: "win_now",
    categoryWeights: {
      competitive: 5,
      strategic: 2,
      financial: 1,
      franchise: 1,
      long_term: 2,
    },
    winTolerance: { unacceptable: 35, acceptable: 45, strong: 50 },
    payrollPressure: 0.25,
    requiresProfitability: false,
    sentimentFloor: 40,
    awarenessFloor: 35,
    attendanceFloorPct: 55,
    startingPatience: 45,
    preferredPrimary: [
      "make_playoffs",
      "minimum_win_total",
      "playoff_seed",
      "win_championship",
    ],
    preferredSecondary: ["playoff_round", "payroll_limit", "reputation"],
    preferredLongTerm: ["championship_count", "playoff_count", "franchise_value"],
  },
  build_for_the_future: {
    philosophy: "build_for_the_future",
    categoryWeights: {
      strategic: 5,
      long_term: 4,
      competitive: 2,
      financial: 2,
      franchise: 2,
    },
    winTolerance: { unacceptable: 22, acceptable: 30, strong: 42 },
    payrollPressure: 0.55,
    requiresProfitability: false,
    sentimentFloor: 35,
    awarenessFloor: 30,
    attendanceFloorPct: 45,
    startingPatience: 70,
    preferredPrimary: [
      "develop_young_players",
      "roster_direction",
      "minimum_win_total",
    ],
    preferredSecondary: [
      "payroll_limit",
      "improve_finances",
      "fan_sentiment",
    ],
    preferredLongTerm: [
      "franchise_value",
      "championship_count",
      "playoff_count",
    ],
  },
  financially_conservative: {
    philosophy: "financially_conservative",
    categoryWeights: {
      financial: 5,
      franchise: 2,
      competitive: 2,
      strategic: 2,
      long_term: 3,
    },
    winTolerance: { unacceptable: 28, acceptable: 36, strong: 46 },
    payrollPressure: 0.9,
    requiresProfitability: true,
    sentimentFloor: 40,
    awarenessFloor: 35,
    attendanceFloorPct: 50,
    startingPatience: 55,
    preferredPrimary: [
      "improve_finances",
      "positive_cash",
      "payroll_limit",
      "revenue_target",
    ],
    preferredSecondary: [
      "minimum_win_total",
      "franchise_value",
      "fan_sentiment",
    ],
    preferredLongTerm: ["franchise_value", "revenue_target", "positive_cash"],
  },
  market_expansion: {
    philosophy: "market_expansion",
    categoryWeights: {
      franchise: 5,
      financial: 3,
      competitive: 2,
      strategic: 2,
      long_term: 3,
    },
    winTolerance: { unacceptable: 28, acceptable: 38, strong: 48 },
    payrollPressure: 0.5,
    requiresProfitability: false,
    sentimentFloor: 50,
    awarenessFloor: 45,
    attendanceFloorPct: 65,
    startingPatience: 60,
    preferredPrimary: [
      "attendance",
      "fan_sentiment",
      "awareness",
      "reputation",
    ],
    preferredSecondary: [
      "revenue_target",
      "arena_level",
      "minimum_win_total",
    ],
    preferredLongTerm: ["franchise_value", "awareness", "reputation"],
  },
  /**
   * Balanced is a coherent generalist: moderate contention, payroll discipline,
   * profitability, and stable market metrics — not equal category weights.
   */
  balanced: {
    philosophy: "balanced",
    categoryWeights: {
      competitive: 3,
      financial: 3,
      franchise: 2,
      strategic: 2,
      long_term: 3,
    },
    winTolerance: { unacceptable: 32, acceptable: 40, strong: 48 },
    payrollPressure: 0.65,
    requiresProfitability: true,
    sentimentFloor: 45,
    awarenessFloor: 40,
    attendanceFloorPct: 55,
    startingPatience: 55,
    preferredPrimary: [
      "minimum_win_total",
      "make_playoffs",
      "improve_finances",
      "payroll_limit",
    ],
    preferredSecondary: [
      "fan_sentiment",
      "attendance",
      "develop_young_players",
      "revenue_target",
    ],
    preferredLongTerm: [
      "franchise_value",
      "championship_count",
      "playoff_count",
    ],
  },
};

export function getOwnerPhilosophyProfile(
  philosophy: OwnerPhilosophy = "balanced",
): OwnerPhilosophyProfile {
  return OWNER_PHILOSOPHY_PROFILES[philosophy];
}

/** Fixed mandate weights after owner philosophy was removed as a user concept. */
export function getDefaultOwnerMandateProfile(): OwnerPhilosophyProfile {
  return OWNER_PHILOSOPHY_PROFILES.balanced;
}

export function clampOwnerPatience(value: number): number {
  if (!Number.isFinite(value)) {
    return OWNER_PHILOSOPHY_PROFILES.balanced.startingPatience;
  }
  return Math.max(
    OWNER_PATIENCE_MIN,
    Math.min(OWNER_PATIENCE_MAX, Math.round(value)),
  );
}

export function defaultOwnerPatience(
  _philosophy: OwnerPhilosophy = "balanced",
): number {
  return OWNER_PHILOSOPHY_PROFILES.balanced.startingPatience;
}

/** Human-readable mandate priorities for the owner dashboard. */
export function mandatePriorityLabels(
  _philosophy: OwnerPhilosophy = "balanced",
): readonly string[] {
  return [
    "Compete while staying solvent",
    "Keep payroll under control",
    "Grow long-term franchise value",
  ];
}
