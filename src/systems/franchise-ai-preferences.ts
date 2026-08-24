/**
 * Pure franchise AI preference resolver.
 *
 * Flow:
 *   organizational traits (identity)
 *     → franchise trajectory (history)
 *     → strategic posture (interpretation)
 *     → franchise pressure signals
 *     → EffectivePreferences
 *
 * Identity is never mutated. Trajectory/posture modulate within inertia caps.
 * No commands, RNG, or simulation side effects.
 */

import type { AiProfile } from "@/domain/entities/franchise-ops";
import {
  buildFranchiseContext,
  readFranchiseIdentity,
  type FranchiseContext,
  type FranchiseIdentitySnapshot,
} from "@/systems/franchise-ai-context";
import {
  applyIdentityInertia,
  clampPreference,
  IDENTITY_INERTIA_CATASTROPHIC_CAP,
  IDENTITY_INERTIA_MODIFIER_CAP,
} from "@/systems/franchise-ai-preferences-config";
import {
  deriveOrganizationalTraits,
  failureModePreferenceBias,
  type OrganizationalTraits,
} from "@/systems/franchise-organizational-traits";
import {
  buildFranchiseTrajectoryContext,
  emptyFranchiseTrajectoryContext,
  type FranchiseTrajectoryContext,
} from "@/systems/franchise-trajectory-context";
import {
  deriveStrategicPosture,
  posturePreferenceDeltas,
  type StrategicPosture,
} from "@/systems/franchise-strategic-posture";
import {
  buildFranchisePressureSignals,
  emptyFranchisePressureSignals,
  type FranchisePressureSignals,
} from "@/systems/franchise-pressure-signals";
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
  posture: StrategicPosture;
  traits: OrganizationalTraits;
  trajectory: Pick<
    FranchiseTrajectoryContext,
    | "rebuildPressure"
    | "competitiveWindow"
    | "financialStress"
    | "marketOpportunity"
    | "organizationalMomentum"
  >;
  pressure: FranchisePressureSignals;
  preferences: EffectivePreferences;
  /** Top influences for harness/tests (developer-only). */
  primaryInfluences: readonly { key: keyof EffectivePreferences; value: number }[];
};

export type ResolvedFranchisePreferences = {
  identity: FranchiseIdentitySnapshot;
  context: FranchiseContext;
  traits: OrganizationalTraits;
  trajectory: FranchiseTrajectoryContext;
  posture: StrategicPosture;
  pressure: FranchisePressureSignals;
  preferences: EffectivePreferences;
  debug: PreferenceDebugSnapshot;
};

function axis01(axis1to99: number): number {
  return clampPreference((axis1to99 - 1) / 98);
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

function applyFloor(value: number, floor: number | undefined): number {
  if (floor === undefined) {
    return value;
  }
  return Math.max(value, floor);
}

function applyCeiling(value: number, ceiling: number | undefined): number {
  if (ceiling === undefined) {
    return value;
  }
  return Math.min(value, ceiling);
}

/**
 * Identity-only baseline preferences (before trajectory/posture/pressure).
 * Used as the inertia anchor.
 */
function identityBaselinePreferences(
  identity: FranchiseIdentitySnapshot,
  traits: OrganizationalTraits,
  context: FranchiseContext,
): EffectivePreferences {
  const spendAxis = axis01(identity.spendingTolerance);
  const patienceAxis = axis01(identity.patience);
  const riskAxis = axis01(identity.riskTolerance);
  const health = healthSpendFactor(context.financialHealth);

  const riskAppetite = clampPreference(
    riskAxis * 0.75 +
      (1 - context.performancePressure) * 0.1 +
      (context.financialHealth === "healthy" ||
      context.financialHealth === "stable"
        ? 0.1
        : -0.1),
  );

  const patiencePressure = clampPreference(
    (1 - patienceAxis) * 0.55 + context.performancePressure * 0.45,
  );

  const calendarScale = 1 + context.calendarUrgency * 0.2;
  let winNowPressure = clampPreference(
    (traits.competitiveness * 0.65 +
      patiencePressure * 0.2 +
      (context.rosterStrength >= 60 ? 0.15 : 0) +
      (context.winPct >= 0.55 ? 0.1 : 0)) *
      (context.deadlineWindow && traits.competitiveness >= traits.assetAccumulation
        ? calendarScale
        : 1),
  );
  let rebuildPressure = clampPreference(
    (traits.assetAccumulation * 0.55 +
      traits.developmentPreference * 0.2 +
      (1 - patiencePressure) * 0.1 +
      (context.youngRosterSharePct >= 50 ? 0.1 : 0) +
      (context.draftAssetCount >= 4 ? 0.1 : 0) +
      (context.rosterStrength > 0 && context.rosterStrength < 48 ? 0.15 : 0)) *
      (context.deadlineWindow && traits.assetAccumulation > traits.competitiveness
        ? calendarScale
        : 1),
  );
  const pressureSum = winNowPressure + rebuildPressure;
  if (pressureSum > 1.2) {
    const scale = 1.2 / pressureSum;
    winNowPressure = clampPreference(winNowPressure * scale);
    rebuildPressure = clampPreference(rebuildPressure * scale);
  }

  const spendWillingness = clampPreference(
    spendAxis * 0.55 +
      traits.competitiveness * 0.15 +
      traits.prestigePreference * 0.1 +
      health.spend -
      traits.financialConservatism * 0.2,
  );
  const cashPreservation = clampPreference(
    traits.financialConservatism * 0.55 +
      (1 - spendAxis) * 0.25 +
      health.preserve +
      (1 - riskAppetite) * 0.1,
  );

  return {
    winNowPressure,
    rebuildPressure,
    youthValue: clampPreference(
      traits.developmentPreference * 0.55 +
        traits.assetAccumulation * 0.2 +
        rebuildPressure * 0.15 -
        winNowPressure * 0.1,
    ),
    pickValue: clampPreference(
      traits.assetAccumulation * 0.65 +
        rebuildPressure * 0.2 -
        winNowPressure * 0.15,
    ),
    establishedPlayerValue: clampPreference(
      traits.competitiveness * 0.45 +
        traits.prestigePreference * 0.25 +
        winNowPressure * 0.2 -
        rebuildPressure * 0.15,
    ),
    spendWillingness,
    cashPreservation,
    riskAppetite,
    patiencePressure,
    marketingPriority: clampPreference(
      traits.marketGrowth * 0.7 +
        traits.prestigePreference * 0.15 +
        spendWillingness * 0.1 -
        cashPreservation * 0.15 +
        (context.offseasonPlanning ? 0.05 : 0),
    ),
    attendancePriority: clampPreference(
      traits.marketGrowth * 0.45 +
        traits.financialConservatism * 0.2 +
        cashPreservation * 0.15 +
        0.2,
    ),
    developmentPriority: clampPreference(
      traits.developmentPreference * 0.75 +
        traits.assetAccumulation * 0.1 +
        (context.offseasonPlanning ? 0.1 : 0),
    ),
  };
}

export type ResolvePreferencesPartsInput = {
  identity: FranchiseIdentitySnapshot;
  context: FranchiseContext;
  trajectory?: FranchiseTrajectoryContext;
  pressure?: FranchisePressureSignals;
};

/**
 * Pure resolve from identity + context + optional trajectory/pressure.
 */
export function resolveFranchisePreferencesFromParts(
  identity: FranchiseIdentitySnapshot,
  context: FranchiseContext,
  trajectoryInput?: FranchiseTrajectoryContext,
  pressureInput?: FranchisePressureSignals,
): ResolvedFranchisePreferences {
  const org = deriveOrganizationalTraits(identity);
  const traits = org.traits;
  const trajectory = trajectoryInput ?? emptyFranchiseTrajectoryContext();
  const pressure = pressureInput ?? emptyFranchisePressureSignals();

  const postureResult = deriveStrategicPosture(traits, trajectory, context);
  const posture = postureResult.posture;
  const deltas = posturePreferenceDeltas(posture);

  const baseline = identityBaselinePreferences(identity, traits, context);

  // Trajectory soft nudges (bounded; identity inertia applied below).
  const trajectorySpendNudge =
    trajectory.competitiveWindow * 0.08 -
    trajectory.financialStress * 0.12 -
    trajectory.rebuildPressure * 0.05;
  const trajectoryYouthNudge =
    trajectory.rebuildPressure * 0.08 +
    (trajectory.hasYoungStar ? 0.04 : 0) -
    trajectory.competitiveWindow * 0.04;

  // Pressure signal nudges — shared simulation truth.
  const pressureAttendanceNudge = pressure.fanPriceFriction * 0.1;
  const pressureMarketingNudge =
    pressure.marketOpportunity * 0.08 -
    pressure.financialStress * 0.1 +
    (traits.marketGrowth > 0.6 ? pressure.attendanceDeclining * 0.06 : 0);
  const pressureCashNudge =
    pressure.financialStress * 0.12 + pressure.sponsorRisk * 0.04;

  const inertiaCap =
    trajectory.financialStress >= 0.75 || context.financialHealth === "insolvent"
      ? IDENTITY_INERTIA_CATASTROPHIC_CAP
      : IDENTITY_INERTIA_MODIFIER_CAP;

  const modulate = (key: keyof EffectivePreferences, raw: number): number =>
    applyIdentityInertia(baseline[key], raw, inertiaCap);

  let winNowPressure = modulate(
    "winNowPressure",
    baseline.winNowPressure +
      deltas.winNowPressure +
      trajectory.competitiveWindow * 0.08 -
      trajectory.rebuildPressure * 0.06,
  );
  let rebuildPressure = modulate(
    "rebuildPressure",
    baseline.rebuildPressure +
      deltas.rebuildPressure +
      trajectory.rebuildPressure * 0.15 -
      trajectory.competitiveWindow * 0.08,
  );

  const pressureSum = winNowPressure + rebuildPressure;
  if (pressureSum > 1.25) {
    const scale = 1.25 / pressureSum;
    winNowPressure = clampPreference(winNowPressure * scale);
    rebuildPressure = clampPreference(rebuildPressure * scale);
  }

  let spendWillingness = modulate(
    "spendWillingness",
    baseline.spendWillingness +
      deltas.spendWillingness +
      trajectorySpendNudge -
      pressureCashNudge,
  );
  let cashPreservation = modulate(
    "cashPreservation",
    baseline.cashPreservation +
      deltas.cashPreservation +
      trajectory.financialStress * 0.1 +
      pressureCashNudge,
  );
  let youthValue = modulate(
    "youthValue",
    baseline.youthValue + deltas.youthValue + trajectoryYouthNudge,
  );
  let pickValue = modulate(
    "pickValue",
    baseline.pickValue +
      deltas.pickValue +
      trajectory.rebuildPressure * 0.1 -
      trajectory.competitiveWindow * 0.08,
  );
  let establishedPlayerValue = modulate(
    "establishedPlayerValue",
    baseline.establishedPlayerValue +
      deltas.establishedPlayerValue +
      trajectory.competitiveWindow * 0.08 -
      trajectory.rebuildPressure * 0.08,
  );
  let marketingPriority = modulate(
    "marketingPriority",
    baseline.marketingPriority +
      deltas.marketingPriority +
      pressureMarketingNudge +
      trajectory.marketOpportunity * 0.08,
  );
  let attendancePriority = modulate(
    "attendancePriority",
    baseline.attendancePriority +
      deltas.attendancePriority +
      pressureAttendanceNudge +
      pressure.attendanceDeclining * 0.08,
  );
  let developmentPriority = modulate(
    "developmentPriority",
    baseline.developmentPriority +
      deltas.developmentPriority +
      trajectory.rebuildPressure * 0.05,
  );
  let riskAppetite = modulate(
    "riskAppetite",
    baseline.riskAppetite +
      deltas.riskAppetite -
      trajectory.financialStress * 0.1 +
      trajectory.competitiveWindow * 0.06,
  );

  // Failure-mode floors/ceilings — characteristic tradeoffs, not erasure.
  const bias = failureModePreferenceBias(identity.aiProfile, traits);
  spendWillingness = applyFloor(spendWillingness, bias.spendWillingnessFloor);
  cashPreservation = applyCeiling(
    cashPreservation,
    bias.cashPreservationCeiling,
  );
  youthValue = applyFloor(youthValue, bias.youthValueFloor);
  pickValue = applyFloor(pickValue, bias.pickValueFloor);
  marketingPriority = applyFloor(
    marketingPriority,
    bias.marketingPriorityFloor,
  );
  establishedPlayerValue = applyFloor(
    establishedPlayerValue,
    bias.establishedPlayerValueFloor,
  );

  const preferences: EffectivePreferences = {
    winNowPressure: clampPreference(winNowPressure),
    rebuildPressure: clampPreference(rebuildPressure),
    youthValue: clampPreference(youthValue),
    pickValue: clampPreference(pickValue),
    establishedPlayerValue: clampPreference(establishedPlayerValue),
    spendWillingness: clampPreference(spendWillingness),
    cashPreservation: clampPreference(cashPreservation),
    riskAppetite: clampPreference(riskAppetite),
    patiencePressure: baseline.patiencePressure,
    marketingPriority: clampPreference(marketingPriority),
    attendancePriority: clampPreference(attendancePriority),
    developmentPriority: clampPreference(developmentPriority),
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
    posture,
    traits,
    trajectory: {
      rebuildPressure: trajectory.rebuildPressure,
      competitiveWindow: trajectory.competitiveWindow,
      financialStress: trajectory.financialStress,
      marketOpportunity: trajectory.marketOpportunity,
      organizationalMomentum: trajectory.organizationalMomentum,
    },
    pressure,
    preferences,
    primaryInfluences: ranked,
  };

  return {
    identity,
    context,
    traits,
    trajectory,
    posture,
    pressure,
    preferences,
    debug,
  };
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
  const trajectory =
    buildFranchiseTrajectoryContext(state, teamId) ??
    emptyFranchiseTrajectoryContext();
  const pressure =
    buildFranchisePressureSignals(state, teamId) ??
    emptyFranchisePressureSignals();
  return resolveFranchisePreferencesFromParts(
    identity,
    context,
    trajectory,
    pressure,
  );
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
  return `strategy=${debug.strategy} posture=${debug.posture} action=${action} influences=[${influences}]`;
}
