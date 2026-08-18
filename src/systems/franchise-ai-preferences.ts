/**
 * Pure franchise AI preference resolver.
 *
 * Identity wants → EffectivePreferences (bounded).
 * No mutation, commands, RNG, or simulation side effects.
 *
 * One transform per concept — do not stack aliases (e.g. riskTolerance and
 * riskAppetite and tradeRisk as independent multipliers).
 */

import type { AiProfile } from "@/domain/entities/franchise-ops";
import {
  buildFranchiseContext,
  readFranchiseIdentity,
  type FranchiseContext,
  type FranchiseIdentitySnapshot,
} from "@/systems/franchise-ai-context";
import {
  clampPreference,
} from "@/systems/franchise-ai-preferences-config";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/**
 * Small interpretable preference set shared by owner AI and team AI.
 * Each field: documented source + intended use.
 */
export type EffectivePreferences = {
  /** Situation-driven win-now urge 0–1. Does not mutate stored strategy. */
  winNowPressure: number;
  /** Situation-driven rebuild urge 0–1. */
  rebuildPressure: number;
  /** Value young players in trades/FA/draft. Identity + strategy baseline. */
  youthValue: number;
  /** Value draft picks as assets (trades). Not used for prospect sort. */
  pickValue: number;
  /** Value established / ready veterans. */
  establishedPlayerValue: number;
  /** Willingness to spend cash/cap among legal options. */
  spendWillingness: number;
  /** Preference to preserve cash / avoid discretionary spend. */
  cashPreservation: number;
  /** Risk appetite from riskTolerance + situation (single downstream risk knob). */
  riskAppetite: number;
  /** Pressure from low patience + poor performance (single patience knob). */
  patiencePressure: number;
  /** Marketing investment priority (ops AI). Not scaled by marketSize. */
  marketingPriority: number;
  /** Prefer accessible pricing / attendance over gate max. */
  attendancePriority: number;
  /** Development facilities + youth retention. */
  developmentPriority: number;
};

export type PreferenceDebugSnapshot = {
  strategy: AiProfile;
  spendingTolerance: number;
  patience: number;
  riskTolerance: number;
  preferences: EffectivePreferences;
  /** Top influences for harness/tests (developer-only). */
  primaryInfluences: readonly { key: keyof EffectivePreferences; value: number }[];
};

export type ResolvedFranchisePreferences = {
  identity: FranchiseIdentitySnapshot;
  context: FranchiseContext;
  preferences: EffectivePreferences;
  debug: PreferenceDebugSnapshot;
};

function axis01(axis1to99: number): number {
  return clampPreference((axis1to99 - 1) / 98);
}

function strategyBaseline(profile: AiProfile): {
  youthValue: number;
  pickValue: number;
  establishedPlayerValue: number;
  marketingPriority: number;
  attendancePriority: number;
  developmentPriority: number;
  winNowBias: number;
  rebuildBias: number;
} {
  switch (profile) {
    case "win_now":
      return {
        youthValue: 0.35,
        pickValue: 0.3,
        establishedPlayerValue: 0.75,
        marketingPriority: 0.45,
        attendancePriority: 0.35,
        developmentPriority: 0.35,
        winNowBias: 0.7,
        rebuildBias: 0.15,
      };
    case "rebuild":
      return {
        youthValue: 0.75,
        pickValue: 0.8,
        establishedPlayerValue: 0.25,
        marketingPriority: 0.35,
        attendancePriority: 0.45,
        developmentPriority: 0.55,
        winNowBias: 0.15,
        rebuildBias: 0.75,
      };
    case "development":
      return {
        youthValue: 0.8,
        pickValue: 0.55,
        establishedPlayerValue: 0.3,
        marketingPriority: 0.4,
        attendancePriority: 0.5,
        developmentPriority: 0.85,
        winNowBias: 0.25,
        rebuildBias: 0.45,
      };
    case "market_growth":
      return {
        youthValue: 0.5,
        pickValue: 0.45,
        establishedPlayerValue: 0.45,
        marketingPriority: 0.85,
        attendancePriority: 0.8,
        developmentPriority: 0.4,
        winNowBias: 0.35,
        rebuildBias: 0.3,
      };
    case "aggressive":
      return {
        youthValue: 0.45,
        pickValue: 0.4,
        establishedPlayerValue: 0.6,
        marketingPriority: 0.7,
        attendancePriority: 0.3,
        developmentPriority: 0.4,
        winNowBias: 0.65,
        rebuildBias: 0.2,
      };
    case "conservative":
      return {
        youthValue: 0.45,
        pickValue: 0.5,
        establishedPlayerValue: 0.45,
        marketingPriority: 0.3,
        attendancePriority: 0.55,
        developmentPriority: 0.45,
        winNowBias: 0.3,
        rebuildBias: 0.35,
      };
  }
}

function healthSpendFactor(health: FranchiseContext["financialHealth"]): {
  spend: number;
  preserve: number;
} {
  switch (health) {
    case "healthy":
      return { spend: 0.15, preserve: -0.15 };
    case "stable":
      return { spend: 0.05, preserve: -0.05 };
    case "warning":
      return { spend: -0.2, preserve: 0.25 };
    case "critical":
    case "insolvent":
      return { spend: -0.35, preserve: 0.4 };
  }
}

/**
 * Pure resolve from identity + context snapshots.
 */
export function resolveFranchisePreferencesFromParts(
  identity: FranchiseIdentitySnapshot,
  context: FranchiseContext,
): ResolvedFranchisePreferences {
  const base = strategyBaseline(identity.aiProfile);
  const spendAxis = axis01(identity.spendingTolerance);
  const patienceAxis = axis01(identity.patience);
  const riskAxis = axis01(identity.riskTolerance);

  const health = healthSpendFactor(context.financialHealth);

  // One transform: riskTolerance + situation → riskAppetite
  const riskAppetite = clampPreference(
    riskAxis * 0.75 +
      (1 - context.performancePressure) * 0.1 +
      (context.financialHealth === "healthy" ||
      context.financialHealth === "stable"
        ? 0.1
        : -0.1),
  );

  // One transform: patience + performance → patiencePressure
  // Low patience + poor results → high pressure to act.
  const patiencePressure = clampPreference(
    (1 - patienceAxis) * 0.55 + context.performancePressure * 0.45,
  );

  // Situation pressures (do not rewrite stored strategy)
  let winNowPressure = clampPreference(
    base.winNowBias * 0.65 +
      patiencePressure * 0.2 +
      (context.rosterStrength >= 60 ? 0.15 : 0) +
      (context.winPct >= 0.55 ? 0.1 : 0),
  );
  let rebuildPressure = clampPreference(
    base.rebuildBias * 0.65 +
      (1 - patiencePressure) * 0.1 +
      (context.youngRosterSharePct >= 50 ? 0.1 : 0) +
      (context.draftAssetCount >= 4 ? 0.1 : 0) +
      (context.rosterStrength > 0 && context.rosterStrength < 48 ? 0.15 : 0),
  );
  // Soft normalize so they don't both sit at 1
  const pressureSum = winNowPressure + rebuildPressure;
  if (pressureSum > 1.2) {
    const scale = 1.2 / pressureSum;
    winNowPressure = clampPreference(winNowPressure * scale);
    rebuildPressure = clampPreference(rebuildPressure * scale);
  }

  const spendWillingness = clampPreference(
    spendAxis * 0.7 + health.spend + winNowPressure * 0.15 - rebuildPressure * 0.1,
  );
  const cashPreservation = clampPreference(
    (1 - spendAxis) * 0.55 + health.preserve + (1 - riskAppetite) * 0.15,
  );

  const youthValue = clampPreference(
    base.youthValue * 0.7 +
      rebuildPressure * 0.15 +
      (identity.aiProfile === "development" ? 0.1 : 0) -
      winNowPressure * 0.1,
  );
  const pickValue = clampPreference(
    base.pickValue * 0.7 + rebuildPressure * 0.2 - winNowPressure * 0.15,
  );
  const establishedPlayerValue = clampPreference(
    base.establishedPlayerValue * 0.7 +
      winNowPressure * 0.2 -
      rebuildPressure * 0.15,
  );

  const marketingPriority = clampPreference(
    base.marketingPriority * 0.75 +
      spendWillingness * 0.15 -
      cashPreservation * 0.2,
  );
  const attendancePriority = clampPreference(
    base.attendancePriority * 0.8 + cashPreservation * 0.1,
  );
  const developmentPriority = clampPreference(
    base.developmentPriority * 0.75 +
      youthValue * 0.15 +
      (spendWillingness - cashPreservation) * 0.05,
  );

  const preferences: EffectivePreferences = {
    winNowPressure,
    rebuildPressure,
    youthValue,
    pickValue,
    establishedPlayerValue,
    spendWillingness,
    cashPreservation,
    riskAppetite,
    patiencePressure,
    marketingPriority,
    attendancePriority,
    developmentPriority,
  };

  const ranked = (
    Object.entries(preferences) as [keyof EffectivePreferences, number][]
  )
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const debug: PreferenceDebugSnapshot = {
    strategy: identity.aiProfile,
    spendingTolerance: identity.spendingTolerance,
    patience: identity.patience,
    riskTolerance: identity.riskTolerance,
    preferences,
    primaryInfluences: ranked,
  };

  return { identity, context, preferences, debug };
}

/**
 * Resolve preferences for a team from live GameState (pure read).
 */
export function resolveFranchisePreferences(
  state: GameState,
  teamId: TeamId,
): ResolvedFranchisePreferences | null {
  const identity = readFranchiseIdentity(state, teamId);
  const context = buildFranchiseContext(state, teamId);
  if (!identity || !context) {
    return null;
  }
  return resolveFranchisePreferencesFromParts(identity, context);
}

/** Format developer-only decision reason line for harness/tests. */
export function formatPreferenceDecisionReason(
  debug: PreferenceDebugSnapshot,
  action: string,
): string {
  const influences = debug.primaryInfluences
    .slice(0, 4)
    .map((i) => `${i.key} ${i.value.toFixed(2)}`)
    .join(", ");
  return `strategy=${debug.strategy} action=${action} influences=[${influences}]`;
}
