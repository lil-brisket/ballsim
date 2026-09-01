import type { TeamId } from "@/domain/ids";
import type { StrategicPosture } from "@/systems/franchise-strategic-posture";
import { TRADE_ACCEPTANCE_THRESHOLDS } from "@/systems/trades-config";
import type { TradeEvaluation } from "@/systems/trades/asset-valuation/complete-trade-evaluation";

export type TradeDecisionContext = {
  teamId: TeamId;
  gmThreshold: number;
  tradeIsValid: boolean;
  strategicPosture?: StrategicPosture;
};

export type TradeDecisionAction = "accept" | "reject" | "counter";

export type TradeDecision = {
  action: TradeDecisionAction;
  confidence: number;
  decisionScore: number;
};

/**
 * Seeded AI decision layer. Never call from UI render paths.
 * `seed` should be a stable integer derived from offer fingerprint / team id —
 * not global GameState RNG (so UI re-evaluation does not advance sim RNG).
 */
export function makeTradeDecision(
  evaluation: TradeEvaluation,
  context: TradeDecisionContext,
  seed: number,
): TradeDecision {
  if (!context.tradeIsValid) {
    return { action: "reject", confidence: 1, decisionScore: -999 };
  }

  const t = TRADE_ACCEPTANCE_THRESHOLDS;
  const weighted =
    evaluation.valueDifference * t.valueWeight +
    (evaluation.rosterFit - 0.5) * 40 * t.rosterFitWeight +
    (evaluation.strategicFit - 0.5) * 40 * t.strategicFitWeight +
    (evaluation.financialImpact - 0.5) * 30 * t.financialWeight;

  const variance = boundedVariance(seed, t.varianceBand);
  const decisionScore = weighted + variance;
  const threshold = context.gmThreshold;

  let action: TradeDecisionAction;
  if (decisionScore >= threshold) {
    action = "accept";
  } else if (
    decisionScore >= threshold + t.counterMinNet &&
    decisionScore <= threshold + t.counterMaxNet
  ) {
    action = "counter";
  } else {
    action = "reject";
  }

  const confidence = Math.max(
    0.2,
    Math.min(1, evaluation.confidence + Math.abs(decisionScore - threshold) / 40),
  );

  return { action, confidence, decisionScore };
}

/** Deterministic hash → variance in [-band, +band]. */
export function boundedVariance(seed: number, band: number): number {
  const x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  const unit = (x % 10_001) / 10_000;
  return (unit * 2 - 1) * band;
}

/** Stable seed from strings without touching GameState RNG. */
export function tradeDecisionSeed(
  evaluatingTeamId: string,
  fingerprint: string,
): number {
  let h = 2166136261;
  const input = `${evaluatingTeamId}|${fingerprint}`;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
