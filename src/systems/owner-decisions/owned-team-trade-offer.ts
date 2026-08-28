/**
 * AI-generated trade proposals between two player-owned franchises.
 * AI evaluates both sides; human must approve — never auto-execute.
 */

import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getOwnedTeamIds, isOwnedFranchise } from "@/state/owner-context";
import {
  enqueueTradeOfferForOwner,
  type EnqueueTradeOfferResult,
} from "@/systems/owner-decisions/enqueue-trade-offer";
import { evaluateTradeOffer } from "@/systems/trades/trade-evaluation";
import { generateAiTradeProposal } from "@/systems/trades/trade-ai";
import { validateTrade } from "@/systems/trades/trade-validation";

/**
 * Try to enqueue an owned↔owned trade for human review.
 * Both sides must pass AI evaluation; neither is auto-accepted.
 */
export function tryEnqueueOwnedTeamTradeOffer(
  state: GameState,
  teamAId: TeamId,
  teamBId: TeamId,
): EnqueueTradeOfferResult {
  if (!isOwnedFranchise(state, teamAId) || !isOwnedFranchise(state, teamBId)) {
    return {
      outcome: "rejected",
      state,
      reason: "both_teams_must_be_owned",
    };
  }
  if (teamAId === teamBId) {
    return {
      outcome: "rejected",
      state,
      reason: "same_team",
    };
  }

  const proposal = generateAiTradeProposal(state, teamAId);
  if (!proposal) {
    return {
      outcome: "rejected",
      state,
      reason: "no_proposal",
    };
  }
  // Only accept proposals that specifically involve teamB.
  if (
    !(
      (proposal.sideA.teamId === teamAId && proposal.sideB.teamId === teamBId) ||
      (proposal.sideA.teamId === teamBId && proposal.sideB.teamId === teamAId)
    )
  ) {
    return {
      outcome: "rejected",
      state,
      reason: "proposal_not_between_pair",
    };
  }
  if (!validateTrade(state, proposal).valid) {
    return {
      outcome: "rejected",
      state,
      reason: "invalid_trade",
    };
  }

  const evalA = evaluateTradeOffer(state, teamAId, proposal);
  const evalB = evaluateTradeOffer(state, teamBId, proposal);
  if (!evalA.accepted || !evalB.accepted) {
    return {
      outcome: "rejected",
      state,
      reason: "ai_evaluation_rejected",
    };
  }

  // Offering side = teamA; target owned recipient = the other owned team in the proposal.
  const targetOwnedTeamId =
    proposal.sideA.teamId === teamAId
      ? proposal.sideB.teamId
      : proposal.sideA.teamId;

  return enqueueTradeOfferForOwner(state, teamAId, proposal, {
    targetOwnedTeamId,
  });
}

/**
 * Scan owned pairs for one owned↔owned trade (deterministic order).
 */
export function tryEnqueueAnyOwnedTeamTradeOffer(
  state: GameState,
): EnqueueTradeOfferResult {
  const owned = [...getOwnedTeamIds(state)].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (let i = 0; i < owned.length; i += 1) {
    for (let j = i + 1; j < owned.length; j += 1) {
      const result = tryEnqueueOwnedTeamTradeOffer(
        state,
        owned[i]!,
        owned[j]!,
      );
      if (result.outcome === "queued") {
        return result;
      }
    }
  }
  return {
    outcome: "rejected",
    state,
    reason: "no_owned_pair_match",
  };
}
