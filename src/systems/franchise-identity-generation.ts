/**
 * Deterministic franchise identity generation from rngSeed + teamId.
 * Market size shifts strategy probability; does not dictate identity.
 */

import type { AiProfile } from "@/domain/entities/franchise-ops";
import {
  OWNERSHIP_AXIS_MAX,
  OWNERSHIP_AXIS_MIN,
} from "@/domain/entities/franchise-ops";
import type { TeamId } from "@/domain/ids";

export type FranchiseIdentityAxes = {
  aiProfile: AiProfile;
  spendingTolerance: number;
  patience: number;
  riskTolerance: number;
};

/** Mix of strategy weights; higher weight → more likely. */
type StrategyWeights = Readonly<Record<AiProfile, number>>;

const BASE_STRATEGY_WEIGHTS: StrategyWeights = {
  conservative: 18,
  win_now: 16,
  development: 16,
  aggressive: 14,
  market_growth: 14,
  rebuild: 22,
};

/**
 * Stable 32-bit hash from seed + team id (FNV-1a style mix).
 */
export function hashFranchiseIdentitySeed(
  rngSeed: number,
  teamId: TeamId | string,
): number {
  let h = (rngSeed >>> 0) ^ 0x811c9dc5;
  const s = String(teamId);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Extra mix so nearby team ids diverge.
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function clampAxis(value: number): number {
  return Math.max(
    OWNERSHIP_AXIS_MIN,
    Math.min(OWNERSHIP_AXIS_MAX, Math.round(value)),
  );
}

/**
 * Market size (1–99) tilts weights; unusual orgs remain possible.
 */
export function strategyWeightsForMarket(marketSize: number): StrategyWeights {
  const m = Math.max(1, Math.min(99, marketSize));
  // -1 at small market, +1 at large
  const tilt = (m - 50) / 50;
  return {
    conservative: Math.max(4, BASE_STRATEGY_WEIGHTS.conservative - tilt * 8),
    win_now: Math.max(4, BASE_STRATEGY_WEIGHTS.win_now + tilt * 10),
    development: Math.max(4, BASE_STRATEGY_WEIGHTS.development - tilt * 4),
    aggressive: Math.max(4, BASE_STRATEGY_WEIGHTS.aggressive + tilt * 8),
    market_growth: Math.max(4, BASE_STRATEGY_WEIGHTS.market_growth + tilt * 6),
    rebuild: Math.max(4, BASE_STRATEGY_WEIGHTS.rebuild - tilt * 10),
  };
}

function pickWeightedStrategy(
  hash: number,
  weights: StrategyWeights,
): AiProfile {
  const entries = Object.entries(weights) as [AiProfile, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let cursor = hash % Math.max(1, Math.floor(total));
  for (const [profile, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) {
      return profile;
    }
  }
  return entries[entries.length - 1]![0];
}

/** Strategy-biased but independent axis baselines. */
function axisBaselines(profile: AiProfile): {
  spending: number;
  patience: number;
  risk: number;
} {
  switch (profile) {
    case "win_now":
      return { spending: 70, patience: 35, risk: 60 };
    case "rebuild":
      return { spending: 35, patience: 75, risk: 45 };
    case "development":
      return { spending: 50, patience: 70, risk: 40 };
    case "market_growth":
      return { spending: 55, patience: 55, risk: 50 };
    case "aggressive":
      return { spending: 75, patience: 30, risk: 80 };
    case "conservative":
      return { spending: 30, patience: 65, risk: 25 };
  }
}

/**
 * Full identity for a new franchise (or expansion with optional profile override).
 */
export function generateFranchiseIdentity(input: {
  rngSeed: number;
  teamId: TeamId | string;
  marketSize: number;
  /** When set, keep this profile and only generate axes (legacy / expansion). */
  forceProfile?: AiProfile;
}): FranchiseIdentityAxes {
  const hash = hashFranchiseIdentitySeed(input.rngSeed, input.teamId);
  const weights = strategyWeightsForMarket(input.marketSize);
  const aiProfile =
    input.forceProfile ?? pickWeightedStrategy(hash, weights);

  const baselines = axisBaselines(aiProfile);
  // Independent jitter from distinct hash slices (±20).
  const spendJitter = ((hash >>> 8) % 41) - 20;
  const patienceJitter = ((hash >>> 14) % 41) - 20;
  const riskJitter = ((hash >>> 20) % 41) - 20;

  return {
    aiProfile,
    spendingTolerance: clampAxis(baselines.spending + spendJitter),
    patience: clampAxis(baselines.patience + patienceJitter),
    riskTolerance: clampAxis(baselines.risk + riskJitter),
  };
}

/**
 * Fill missing ownership axes for a legacy ops record that already has aiProfile.
 * Does not change aiProfile.
 */
export function generateAxesForExistingProfile(input: {
  rngSeed: number;
  teamId: TeamId | string;
  aiProfile: AiProfile;
}): Pick<
  FranchiseIdentityAxes,
  "spendingTolerance" | "patience" | "riskTolerance"
> {
  const generated = generateFranchiseIdentity({
    rngSeed: input.rngSeed,
    teamId: input.teamId,
    marketSize: 50,
    forceProfile: input.aiProfile,
  });
  return {
    spendingTolerance: generated.spendingTolerance,
    patience: generated.patience,
    riskTolerance: generated.riskTolerance,
  };
}
