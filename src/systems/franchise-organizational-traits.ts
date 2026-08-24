/**
 * Composable organizational traits derived from persisted FranchiseOps identity.
 * Traits are never persisted — recomputed from aiProfile + ownership axes.
 *
 * Strength / failure-mode pairs create characteristic tradeoffs, not bonuses.
 */

import type { AiProfile } from "@/domain/entities/franchise-ops";
import type { FranchiseIdentitySnapshot } from "@/systems/franchise-ai-context";
import { clampPreference } from "@/systems/franchise-ai-preferences-config";

export type OrganizationalTraits = {
  /** Win-now / star pursuit intensity 0–1. */
  competitiveness: number;
  /** Cash preservation / spending caution 0–1. */
  financialConservatism: number;
  /** Youth + development infrastructure preference 0–1. */
  developmentPreference: number;
  /** Draft picks + flexibility preference 0–1. */
  assetAccumulation: number;
  /** Marketing + attendance / commercial growth 0–1. */
  marketGrowth: number;
  /** Risk acceptance 0–1 (from riskTolerance axis). */
  riskTolerance: number;
  /** Brand / facilities / reputation spend preference 0–1. */
  prestigePreference: number;
  /** Tolerance for poor results before strategic shift 0–1. */
  patience: number;
};

export type OrganizationalProfile = {
  traits: OrganizationalTraits;
  /** Developer/debug label only — not player-facing. */
  strength: string;
  /** Developer/debug label only — not player-facing. */
  failureMode: string;
};

function axis01(axis1to99: number): number {
  return clampPreference((axis1to99 - 1) / 98);
}

type TraitSeed = {
  competitiveness: number;
  financialConservatism: number;
  developmentPreference: number;
  assetAccumulation: number;
  marketGrowth: number;
  prestigePreference: number;
  strength: string;
  failureMode: string;
};

function profileSeed(profile: AiProfile): TraitSeed {
  switch (profile) {
    case "win_now":
      return {
        competitiveness: 0.85,
        financialConservatism: 0.25,
        developmentPreference: 0.3,
        assetAccumulation: 0.25,
        marketGrowth: 0.4,
        prestigePreference: 0.8,
        strength: "Aggressively pursues winning",
        failureMode: "Overspends; tolerates financial inefficiency",
      };
    case "aggressive":
      return {
        competitiveness: 0.75,
        financialConservatism: 0.2,
        developmentPreference: 0.35,
        assetAccumulation: 0.35,
        marketGrowth: 0.65,
        prestigePreference: 0.7,
        strength: "Aggressively pursues winning",
        failureMode: "Overspends; tolerates financial inefficiency",
      };
    case "conservative":
      return {
        competitiveness: 0.35,
        financialConservatism: 0.85,
        developmentPreference: 0.4,
        assetAccumulation: 0.45,
        marketGrowth: 0.3,
        prestigePreference: 0.3,
        strength: "Protects financial health",
        failureMode: "Misses competitive opportunities",
      };
    case "development":
      return {
        competitiveness: 0.3,
        financialConservatism: 0.45,
        developmentPreference: 0.9,
        assetAccumulation: 0.55,
        marketGrowth: 0.4,
        prestigePreference: 0.35,
        strength: "Builds young talent",
        failureMode: "Can stay rebuilding too long",
      };
    case "rebuild":
      return {
        competitiveness: 0.2,
        financialConservatism: 0.5,
        developmentPreference: 0.7,
        assetAccumulation: 0.9,
        marketGrowth: 0.35,
        prestigePreference: 0.25,
        strength: "Accumulates flexibility",
        failureMode: "Doesn't capitalize on assets when window opens",
      };
    case "market_growth":
      return {
        competitiveness: 0.4,
        financialConservatism: 0.35,
        developmentPreference: 0.35,
        assetAccumulation: 0.4,
        marketGrowth: 0.9,
        prestigePreference: 0.55,
        strength: "Builds commercial demand",
        failureMode: "Spends on marketing without winning basketball",
      };
  }
}

/**
 * Derive organizational traits from persisted identity.
 * Axes blend into risk/patience/conservatism; profile seeds the rest.
 */
export function deriveOrganizationalTraits(
  identity: FranchiseIdentitySnapshot,
): OrganizationalProfile {
  const seed = profileSeed(identity.aiProfile);
  const spendAxis = axis01(identity.spendingTolerance);
  const patienceAxis = axis01(identity.patience);
  const riskAxis = axis01(identity.riskTolerance);

  // Spending axis softens/hardens conservatism and competitiveness.
  const financialConservatism = clampPreference(
    seed.financialConservatism * 0.7 + (1 - spendAxis) * 0.3,
  );
  const competitiveness = clampPreference(
    seed.competitiveness * 0.75 + spendAxis * 0.15 + riskAxis * 0.1,
  );
  const prestigePreference = clampPreference(
    seed.prestigePreference * 0.8 + spendAxis * 0.2,
  );

  const traits: OrganizationalTraits = {
    competitiveness,
    financialConservatism,
    developmentPreference: clampPreference(seed.developmentPreference),
    assetAccumulation: clampPreference(seed.assetAccumulation),
    marketGrowth: clampPreference(seed.marketGrowth),
    riskTolerance: riskAxis,
    prestigePreference,
    patience: patienceAxis,
  };

  return {
    traits,
    strength: seed.strength,
    failureMode: seed.failureMode,
  };
}

/**
 * Failure-mode floors/ceilings that resist identity erasure under stress.
 * Returns additive deltas applied after posture modulation (still clamped).
 */
export function failureModePreferenceBias(
  profile: AiProfile,
  traits: OrganizationalTraits,
): Partial<{
  spendWillingnessFloor: number;
  cashPreservationCeiling: number;
  youthValueFloor: number;
  pickValueFloor: number;
  marketingPriorityFloor: number;
  establishedPlayerValueFloor: number;
}> {
  switch (profile) {
    case "win_now":
    case "aggressive":
      // Overspend failure mode: resist collapsing spend under moderate stress.
      return {
        spendWillingnessFloor: clampPreference(
          0.35 + traits.prestigePreference * 0.15,
        ),
        establishedPlayerValueFloor: 0.4,
      };
    case "conservative":
      // Misses opportunities: keep cash preservation elevated.
      return {
        cashPreservationCeiling: 0.95,
        spendWillingnessFloor: 0.08,
      };
    case "development":
      // Stays rebuilding too long: youth value resists win-now erasure.
      return {
        youthValueFloor: clampPreference(
          0.45 + traits.developmentPreference * 0.2,
        ),
      };
    case "rebuild":
      // Doesn't capitalize: pick value stays high even in windows.
      return {
        pickValueFloor: clampPreference(
          0.4 + traits.assetAccumulation * 0.25,
        ),
        youthValueFloor: 0.4,
      };
    case "market_growth":
      // Markets without winning: marketing floor stays high.
      return {
        marketingPriorityFloor: clampPreference(
          0.45 + traits.marketGrowth * 0.25,
        ),
      };
  }
}
