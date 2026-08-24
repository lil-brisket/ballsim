/**
 * Living ownership mandate — derived from philosophy + franchise state.
 * Not persisted; rebuilt when evaluating decisions or posture.
 */

import type { OwnerPhilosophy } from "@/domain/entities/owner-philosophy";

export type CompetitiveStance = "rebuild" | "develop" | "compete" | "contend";

export const COMPETITIVE_STANCES: readonly CompetitiveStance[] = [
  "rebuild",
  "develop",
  "compete",
  "contend",
] as const;

export function isCompetitiveStance(value: string): value is CompetitiveStance {
  return (COMPETITIVE_STANCES as readonly string[]).includes(value);
}

export type RosterStance = "youth_focus" | "balanced" | "win_now_roster";

export const ROSTER_STANCES: readonly RosterStance[] = [
  "youth_focus",
  "balanced",
  "win_now_roster",
] as const;

export function isRosterStance(value: string): value is RosterStance {
  return (ROSTER_STANCES as readonly string[]).includes(value);
}

export type FinancialStance = "preserve_cash" | "sustainable" | "invest";

export const FINANCIAL_STANCES: readonly FinancialStance[] = [
  "preserve_cash",
  "sustainable",
  "invest",
] as const;

export function isFinancialStance(value: string): value is FinancialStance {
  return (FINANCIAL_STANCES as readonly string[]).includes(value);
}

export type MarketStance = "maintain" | "grow" | "aggressive_growth";

export const MARKET_STANCES: readonly MarketStance[] = [
  "maintain",
  "grow",
  "aggressive_growth",
] as const;

export function isMarketStance(value: string): value is MarketStance {
  return (MARKET_STANCES as readonly string[]).includes(value);
}

export type OwnershipExpectationTolerance = {
  /** How much payroll growth ownership tolerates (0–1). */
  payrollGrowth: number;
  /** Willingness to trade future picks for present talent (0–1). */
  assetSacrifice: number;
  /** Soft win floor derived from philosophy + trajectory. */
  winTotalFloor: number;
};

/**
 * Current ownership expectations for the controlled franchise.
 * Philosophy sets priorities; franchise state sets the living mandate.
 */
export type OwnershipExpectations = {
  philosophy: OwnerPhilosophy;
  mandateSummary: string;
  competitiveExpectation: CompetitiveStance;
  rosterBuildingExpectation: RosterStance;
  financialExpectation: FinancialStance;
  marketExpectation: MarketStance;
  tolerance: OwnershipExpectationTolerance;
  priorityBullets: string[];
};

export type StanceGap<T extends string> = {
  expected: T;
  observed: T;
  aligned: boolean;
};

/**
 * Expectation vs observed organizational direction.
 * Observed stances come from strategic posture, not individual transactions.
 */
export type ExpectationRealityGap = {
  competitive: StanceGap<CompetitiveStance>;
  rosterBuilding: StanceGap<RosterStance>;
  financial: StanceGap<FinancialStance>;
  market: StanceGap<MarketStance>;
  overallAligned: boolean;
  summary: string;
};

export function competitiveStanceLabel(stance: CompetitiveStance): string {
  switch (stance) {
    case "rebuild":
      return "rebuild";
    case "develop":
      return "meaningful progress";
    case "compete":
      return "playoff competition";
    case "contend":
      return "contention";
  }
}

export function rosterStanceLabel(stance: RosterStance): string {
  switch (stance) {
    case "youth_focus":
      return "youth development";
    case "balanced":
      return "balanced roster building";
    case "win_now_roster":
      return "immediate roster quality";
  }
}
