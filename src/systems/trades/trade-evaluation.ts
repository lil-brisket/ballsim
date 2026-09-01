import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { gmTradeAcceptanceThreshold } from "@/systems/staff-effects";
import {
  evaluateTrade,
  type TradeEvaluation,
} from "@/systems/trades/asset-valuation/complete-trade-evaluation";
import {
  makeTradeDecision,
  tradeDecisionSeed,
} from "@/systems/trades/asset-valuation/trade-decision";
import { validateTrade } from "@/systems/trades/trade-validation";
import { tradeOfferFingerprint } from "@/domain/entities/owner-decision";
import {
  organizationalPlayerValue as orgPlayerValue,
  organizationalPickValue as orgPickValue,
} from "@/systems/trades/asset-valuation/legacy-org-value";

export type TradeOfferEvaluation = {
  accepted: boolean;
  netValue: number;
  incomingValue: number;
  outgoingValue: number;
  tradeBlockBonus: number;
  /** Objective net before organizational preference adjustment. */
  objectiveNetValue?: number;
  /** Full deterministic evaluation when available. */
  evaluation?: TradeEvaluation;
  decisionAction?: "accept" | "reject" | "counter";
};

/**
 * AI acceptance wrapper: deterministic evaluateTrade + seeded makeTradeDecision.
 * UI/Review should call evaluateTrade() directly — not this function — to avoid
 * implying a decision. RNG is not taken from GameState.meta.rngState.
 */
export function evaluateTradeOffer(
  state: GameState,
  evaluatingTeamId: TeamId,
  proposal: TradeProposal,
): TradeOfferEvaluation {
  const evaluation = evaluateTrade(state, evaluatingTeamId, proposal);
  const valid = validateTrade(state, proposal).valid;
  const otherTeamId =
    proposal.sideA.teamId === evaluatingTeamId
      ? proposal.sideB.teamId
      : proposal.sideA.teamId;
  const fingerprint = tradeOfferFingerprint(
    evaluatingTeamId,
    otherTeamId,
    proposal,
  );
  const seed = tradeDecisionSeed(evaluatingTeamId, fingerprint);
  const decision = makeTradeDecision(
    evaluation,
    {
      teamId: evaluatingTeamId,
      gmThreshold: gmTradeAcceptanceThreshold(state, evaluatingTeamId),
      tradeIsValid: valid,
    },
    seed,
  );

  return {
    accepted: decision.action === "accept",
    netValue: evaluation.netValue,
    incomingValue: evaluation.incomingValue,
    outgoingValue: evaluation.outgoingValue,
    tradeBlockBonus: evaluation.tradeBlockBonus,
    objectiveNetValue: evaluation.objectiveNetValue,
    evaluation,
    decisionAction: decision.action,
  };
}

export {
  evaluateTrade,
  type TradeEvaluation,
} from "@/systems/trades/asset-valuation/complete-trade-evaluation";

/** @deprecated Prefer getTeamAssetValue — kept for external imports. */
export function organizationalPlayerValue(
  state: GameState,
  playerId: Parameters<typeof orgPlayerValue>[1],
  prefs: Parameters<typeof orgPlayerValue>[2],
): number {
  return orgPlayerValue(state, playerId, prefs);
}

/** @deprecated Prefer getTeamAssetValue — kept for external imports. */
export function organizationalPickValue(
  state: GameState,
  pickId: Parameters<typeof orgPickValue>[1],
  prefs: Parameters<typeof orgPickValue>[2],
): number {
  return orgPickValue(state, pickId, prefs);
}
