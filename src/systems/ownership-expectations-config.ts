/**
 * Rules for resolving living ownership expectations from philosophy + franchise state.
 */

import type { OwnerPhilosophy } from "@/domain/entities/owner-philosophy";
import type {
  CompetitiveStance,
  FinancialStance,
  MarketStance,
  RosterStance,
} from "@/domain/entities/ownership-expectations";

/** Projected or current win totals used to place competitive trajectory. */
export type CompetitiveTrajectoryBand =
  | "collapse"
  | "rebuild"
  | "developing"
  | "playoff_chase"
  | "contender";

export function competitiveBandFromWins(wins: number): CompetitiveTrajectoryBand {
  if (wins < 28) {
    return "collapse";
  }
  if (wins < 36) {
    return "rebuild";
  }
  if (wins < 44) {
    return "developing";
  }
  if (wins < 52) {
    return "playoff_chase";
  }
  return "contender";
}

/**
 * Map philosophy + win band → competitive expectation.
 * Philosophy biases the ladder; poor records still allow rebuild for win_now.
 */
export function resolveCompetitiveExpectation(
  philosophy: OwnerPhilosophy,
  band: CompetitiveTrajectoryBand,
): CompetitiveStance {
  switch (philosophy) {
    case "win_now":
      switch (band) {
        case "collapse":
        case "rebuild":
          return "rebuild";
        case "developing":
          return "develop";
        case "playoff_chase":
          return "compete";
        case "contender":
          return "contend";
      }
      break;
    case "build_for_the_future":
      switch (band) {
        case "collapse":
        case "rebuild":
          return "rebuild";
        case "developing":
          return "develop";
        case "playoff_chase":
          return "develop";
        case "contender":
          return "compete";
      }
      break;
    case "financially_conservative":
      switch (band) {
        case "collapse":
        case "rebuild":
          return "rebuild";
        case "developing":
          return "develop";
        case "playoff_chase":
          return "compete";
        case "contender":
          return "compete";
      }
      break;
    case "market_expansion":
      switch (band) {
        case "collapse":
        case "rebuild":
          return "develop";
        case "developing":
          return "develop";
        case "playoff_chase":
          return "compete";
        case "contender":
          return "contend";
      }
      break;
    case "balanced":
      switch (band) {
        case "collapse":
        case "rebuild":
          return "rebuild";
        case "developing":
          return "develop";
        case "playoff_chase":
          return "compete";
        case "contender":
          return "contend";
      }
      break;
  }
}

export function resolveRosterExpectation(
  philosophy: OwnerPhilosophy,
  competitive: CompetitiveStance,
  youngCoreReady: boolean,
): RosterStance {
  if (philosophy === "build_for_the_future") {
    if (youngCoreReady && (competitive === "compete" || competitive === "contend")) {
      return "balanced";
    }
    return "youth_focus";
  }
  if (philosophy === "win_now") {
    if (competitive === "rebuild" || competitive === "develop") {
      return "balanced";
    }
    return "win_now_roster";
  }
  if (philosophy === "financially_conservative") {
    return competitive === "contend" ? "win_now_roster" : "balanced";
  }
  if (philosophy === "market_expansion") {
    return competitive === "contend" ? "win_now_roster" : "balanced";
  }
  // balanced
  if (competitive === "rebuild") {
    return "youth_focus";
  }
  if (competitive === "contend") {
    return "win_now_roster";
  }
  return "balanced";
}

export function resolveFinancialExpectation(
  philosophy: OwnerPhilosophy,
  revenueGrowing: boolean,
  cashHealthy: boolean,
): FinancialStance {
  if (philosophy === "financially_conservative") {
    if (revenueGrowing && cashHealthy) {
      return "sustainable";
    }
    return "preserve_cash";
  }
  if (philosophy === "win_now") {
    return cashHealthy ? "invest" : "sustainable";
  }
  if (philosophy === "market_expansion") {
    return "invest";
  }
  if (philosophy === "build_for_the_future") {
    return revenueGrowing ? "sustainable" : "preserve_cash";
  }
  return cashHealthy ? "sustainable" : "preserve_cash";
}

export function resolveMarketExpectation(
  philosophy: OwnerPhilosophy,
  awarenessLow: boolean,
  attendanceSoft: boolean,
): MarketStance {
  if (philosophy === "market_expansion") {
    if (awarenessLow || attendanceSoft) {
      return "aggressive_growth";
    }
    return "grow";
  }
  if (philosophy === "financially_conservative") {
    return attendanceSoft ? "grow" : "maintain";
  }
  if (philosophy === "win_now") {
    return "maintain";
  }
  if (philosophy === "build_for_the_future") {
    return attendanceSoft ? "grow" : "maintain";
  }
  return awarenessLow || attendanceSoft ? "grow" : "maintain";
}

export function resolveTolerance(
  philosophy: OwnerPhilosophy,
  competitive: CompetitiveStance,
): { payrollGrowth: number; assetSacrifice: number; winTotalFloor: number } {
  const winFloorByStance: Record<CompetitiveStance, number> = {
    rebuild: 24,
    develop: 34,
    compete: 44,
    contend: 50,
  };
  const winTotalFloor = winFloorByStance[competitive];

  switch (philosophy) {
    case "win_now":
      return {
        payrollGrowth: competitive === "rebuild" ? 0.35 : 0.75,
        assetSacrifice: competitive === "rebuild" ? 0.25 : 0.7,
        winTotalFloor,
      };
    case "build_for_the_future":
      return {
        payrollGrowth: 0.35,
        assetSacrifice: competitive === "contend" ? 0.45 : 0.2,
        winTotalFloor,
      };
    case "financially_conservative":
      return {
        payrollGrowth: 0.2,
        assetSacrifice: 0.35,
        winTotalFloor,
      };
    case "market_expansion":
      return {
        payrollGrowth: 0.55,
        assetSacrifice: 0.45,
        winTotalFloor,
      };
    case "balanced":
      return {
        payrollGrowth: 0.45,
        assetSacrifice: 0.45,
        winTotalFloor,
      };
  }
}

/** Young-core readiness: high young share + solid roster strength. */
export const YOUNG_CORE_SHARE_PCT = 45;
export const YOUNG_CORE_STRENGTH_FLOOR = 58;

export const AWARENESS_LOW_THRESHOLD = 40;
export const ATTENDANCE_SOFT_FILL_PCT = 55;
