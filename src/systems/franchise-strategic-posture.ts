/**
 * Derived strategic posture — compact interpretation of current franchise strategy.
 * Never persisted. Identity provides inertia; trajectory provides circumstance.
 *
 * Posture must not flip on short-term noise (multi-season / smoothed inputs).
 */

import type { OrganizationalTraits } from "@/systems/franchise-organizational-traits";
import type { FranchiseTrajectoryContext } from "@/systems/franchise-trajectory-context";
import type { FranchiseContext } from "@/systems/franchise-ai-context";
import { clampPreference } from "@/systems/franchise-ai-preferences-config";

export type StrategicPosture =
  | "rebuilding"
  | "developing"
  | "maintaining"
  | "contending"
  | "all_in"
  | "retrenching"
  | "growing";

export const STRATEGIC_POSTURES: readonly StrategicPosture[] = [
  "rebuilding",
  "developing",
  "maintaining",
  "contending",
  "all_in",
  "retrenching",
  "growing",
] as const;

export type StrategicPostureResult = {
  posture: StrategicPosture;
  /** Confidence / strength of the posture assignment 0–1. */
  strength: number;
  /** Top reasons for harness/tests. */
  reasons: readonly string[];
};

type PostureScore = {
  posture: StrategicPosture;
  score: number;
  reason: string;
};

/**
 * Derive strategic posture from traits + trajectory + current context.
 * Uses multi-season trajectory signals for inertia (not single-week variance).
 */
export function deriveStrategicPosture(
  traits: OrganizationalTraits,
  trajectory: FranchiseTrajectoryContext,
  context: FranchiseContext,
): StrategicPostureResult {
  const scores: PostureScore[] = [];

  // ALL_IN: high window + competitiveness/prestige + financial capacity
  const allInScore =
    trajectory.competitiveWindow * 0.45 +
    traits.competitiveness * 0.25 +
    traits.prestigePreference * 0.15 +
    (1 - trajectory.financialStress) * 0.15 +
    (trajectory.hasYoungStar ? 0.1 : 0) +
    (context.winPct >= 0.6 ? 0.08 : 0);
  scores.push({
    posture: "all_in",
    score: allInScore,
    reason: "competitive window + competitiveness",
  });

  // CONTENDING: solid window, not necessarily all-in spend
  const contendingScore =
    trajectory.competitiveWindow * 0.4 +
    clampPreference(context.winPct) * 0.25 +
    (context.rosterStrength >= 58 ? 0.2 : 0.05) +
    traits.competitiveness * 0.15 +
    trajectory.organizationalMomentum * 0.1;
  scores.push({
    posture: "contending",
    score: contendingScore,
    reason: "sustained competitiveness",
  });

  // DEVELOPING: development org + young roster + rebuild pressure
  const developingScore =
    traits.developmentPreference * 0.4 +
    trajectory.rebuildPressure * 0.2 +
    clampPreference(context.youngRosterSharePct / 100) * 0.25 +
    (trajectory.hasYoungStar ? 0.15 : 0) +
    (1 - traits.competitiveness) * 0.1;
  scores.push({
    posture: "developing",
    score: developingScore,
    reason: "development focus + youth",
  });

  // REBUILDING: high rebuild + asset accumulation, weak window
  const rebuildingScore =
    trajectory.rebuildPressure * 0.4 +
    traits.assetAccumulation * 0.3 +
    (1 - trajectory.competitiveWindow) * 0.2 +
    clampPreference(trajectory.consecutiveLosingSeasons / 3) * 0.15;
  scores.push({
    posture: "rebuilding",
    score: rebuildingScore,
    reason: "rebuild pressure + assets",
  });

  // RETRENCHING: financial stress + declining trajectory (prestige orgs under failure)
  const retrenchingScore =
    trajectory.financialStress * 0.4 +
    clampPreference(-trajectory.winsVsOwnBaseline) * 0.2 +
    clampPreference(-trajectory.valueVsOwnBaseline) * 0.15 +
    clampPreference(trajectory.consecutiveLosingSeasons / 3) * 0.15 +
    traits.financialConservatism * 0.1 +
    (trajectory.consecutiveLosingSeasons >= 2 ? 0.15 : 0);
  scores.push({
    posture: "retrenching",
    score: retrenchingScore,
    reason: "financial stress + decline",
  });

  // GROWING: market growth trait + market opportunity
  const growingScore =
    traits.marketGrowth * 0.45 +
    trajectory.marketOpportunity * 0.35 +
    clampPreference(trajectory.attendanceVsOwnBaseline) * 0.1 +
    (context.marketingAwareness >= 50 ? 0.1 : 0);
  scores.push({
    posture: "growing",
    score: growingScore,
    reason: "market growth opportunity",
  });

  // MAINTAINING: mid-pack default with patience
  const maintainingScore =
    0.35 +
    traits.patience * 0.2 +
    (1 - Math.abs(trajectory.organizationalMomentum - 0.5)) * 0.15 +
    (trajectory.financialStress < 0.4 ? 0.1 : 0) +
    (trajectory.competitiveWindow > 0.3 &&
    trajectory.competitiveWindow < 0.65
      ? 0.15
      : 0);
  scores.push({
    posture: "maintaining",
    score: maintainingScore,
    reason: "stable mid-tier posture",
  });

  // Patience dampens extreme shifts: blend top score toward maintaining when patient.
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  let top = ranked[0]!;
  const runnerUp = ranked[1];

  // Require clear separation from maintaining unless score is strong —
  // strategic inertia: short-term noise shouldn't flip posture.
  const inertiaThreshold = 0.12 + traits.patience * 0.12;
  if (
    top.posture !== "maintaining" &&
    runnerUp &&
    top.score - runnerUp.score < inertiaThreshold * 0.35 &&
    Math.abs(top.score - maintainingScore) < inertiaThreshold
  ) {
    top = scores.find((entry) => entry.posture === "maintaining")!;
  }

  // Catastrophic financial stress forces retrenching over all_in/contending.
  if (
    trajectory.financialStress >= 0.75 &&
    (top.posture === "all_in" || top.posture === "contending")
  ) {
    top = scores.find((entry) => entry.posture === "retrenching")!;
  }

  // Strong development identity prefers developing over rebuilding when youth present.
  if (
    top.posture === "rebuilding" &&
    traits.developmentPreference >= 0.7 &&
    context.youngRosterSharePct >= 40
  ) {
    const developing = scores.find((entry) => entry.posture === "developing");
    if (developing && developing.score >= top.score - 0.08) {
      top = developing;
    }
  }

  return {
    posture: top.posture,
    strength: clampPreference(top.score),
    reasons: [top.reason, ...ranked.slice(1, 3).map((entry) => entry.reason)],
  };
}

/**
 * Posture → preference modulation deltas (applied with identity inertia caps).
 * Values are additive adjustments before clamping.
 */
export function posturePreferenceDeltas(posture: StrategicPosture): {
  winNowPressure: number;
  rebuildPressure: number;
  spendWillingness: number;
  cashPreservation: number;
  youthValue: number;
  pickValue: number;
  establishedPlayerValue: number;
  marketingPriority: number;
  attendancePriority: number;
  developmentPriority: number;
  riskAppetite: number;
} {
  switch (posture) {
    case "all_in":
      return {
        winNowPressure: 0.2,
        rebuildPressure: -0.15,
        spendWillingness: 0.18,
        cashPreservation: -0.15,
        youthValue: -0.08,
        pickValue: -0.12,
        establishedPlayerValue: 0.15,
        marketingPriority: 0.05,
        attendancePriority: -0.05,
        developmentPriority: -0.05,
        riskAppetite: 0.12,
      };
    case "contending":
      return {
        winNowPressure: 0.12,
        rebuildPressure: -0.08,
        spendWillingness: 0.1,
        cashPreservation: -0.08,
        youthValue: -0.04,
        pickValue: -0.06,
        establishedPlayerValue: 0.1,
        marketingPriority: 0.04,
        attendancePriority: 0,
        developmentPriority: 0,
        riskAppetite: 0.06,
      };
    case "developing":
      return {
        winNowPressure: -0.1,
        rebuildPressure: 0.08,
        spendWillingness: -0.05,
        cashPreservation: 0.05,
        youthValue: 0.15,
        pickValue: 0.08,
        establishedPlayerValue: -0.1,
        marketingPriority: 0,
        attendancePriority: 0.05,
        developmentPriority: 0.18,
        riskAppetite: -0.05,
      };
    case "rebuilding":
      return {
        winNowPressure: -0.15,
        rebuildPressure: 0.2,
        spendWillingness: -0.08,
        cashPreservation: 0.08,
        youthValue: 0.12,
        pickValue: 0.18,
        establishedPlayerValue: -0.15,
        marketingPriority: -0.05,
        attendancePriority: 0.05,
        developmentPriority: 0.1,
        riskAppetite: -0.08,
      };
    case "retrenching":
      return {
        winNowPressure: -0.08,
        rebuildPressure: 0.05,
        spendWillingness: -0.18,
        cashPreservation: 0.22,
        youthValue: 0.05,
        pickValue: 0.08,
        establishedPlayerValue: -0.08,
        marketingPriority: -0.12,
        attendancePriority: 0.08,
        developmentPriority: 0,
        riskAppetite: -0.15,
      };
    case "growing":
      return {
        winNowPressure: 0,
        rebuildPressure: 0,
        spendWillingness: 0.05,
        cashPreservation: -0.05,
        youthValue: 0,
        pickValue: 0,
        establishedPlayerValue: 0,
        marketingPriority: 0.2,
        attendancePriority: 0.18,
        developmentPriority: 0,
        riskAppetite: 0.05,
      };
    case "maintaining":
      return {
        winNowPressure: 0,
        rebuildPressure: 0,
        spendWillingness: 0,
        cashPreservation: 0.02,
        youthValue: 0,
        pickValue: 0,
        establishedPlayerValue: 0,
        marketingPriority: 0,
        attendancePriority: 0.02,
        developmentPriority: 0,
        riskAppetite: 0,
      };
  }
}
