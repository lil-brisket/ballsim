/**
 * Trades between two human participants (local shared or online leagues).
 *
 * A proposal becomes a pending owner decision in the receiving participant's
 * inbox. It never blocks the league from advancing (one player must not be
 * able to freeze everyone else) and expires like a CPU offer. Only the
 * receiving participant can accept; the AI never decides for a human team.
 */

import {
  cloneProposal,
  tradeOfferFingerprint,
  type PendingOwnerDecision,
  type TradeOfferDecisionPayload,
} from "@/domain/entities/owner-decision";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { asOwnerDecisionId, type TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  computeExpiresOn,
  resolvePendingOwnerDecision,
} from "@/systems/owner-decisions/enqueue-trade-offer";
import {
  getActiveParticipant,
  getParticipantForTeam,
  getSharedParticipation,
} from "@/systems/participation";
import { validateTrade } from "@/systems/trades/trade-validation";

export type PlayerTradeResult =
  | { ok: true; state: GameState; decision: PendingOwnerDecision }
  | { ok: false; error: string };

/** True when the offer was made by a human participant's franchise. */
export function isPlayerTradeOffer(
  state: GameState,
  decision: PendingOwnerDecision,
): boolean {
  return state.user.ownedTeamIds.includes(decision.payload.offeringTeamId);
}

/**
 * Queue a proposal from the active participant to another participant.
 * One side must be the active participant's team, the other side another
 * participant's team.
 */
export function proposePlayerTrade(
  state: GameState,
  proposal: TradeProposal,
): PlayerTradeResult {
  if (!getSharedParticipation(state)) {
    return { ok: false, error: "Player trades need a shared league." };
  }
  const active = getActiveParticipant(state);
  if (!active) {
    return { ok: false, error: "No active participant." };
  }
  const sides = [proposal.sideA, proposal.sideB];
  const mine = sides.find((side) => active.teamIds.includes(side.teamId));
  const theirs = sides.find((side) => side !== mine);
  if (!mine || !theirs) {
    return {
      ok: false,
      error: "The proposal must include one of your franchises.",
    };
  }
  const recipient = getParticipantForTeam(state, theirs.teamId);
  if (!recipient || recipient.id === active.id) {
    return {
      ok: false,
      error: "Player trades must be with another participant's franchise.",
    };
  }
  if (mine.playerIds.length + mine.draftPickIds.length === 0) {
    return { ok: false, error: "Offer at least one asset." };
  }
  if (theirs.playerIds.length + theirs.draftPickIds.length === 0) {
    return { ok: false, error: "Ask for at least one asset." };
  }

  const validation = validateTrade(state, proposal);
  if (!validation.valid) {
    return {
      ok: false,
      error: validation.errors[0]?.message ?? "Trade proposal is invalid.",
    };
  }

  const fromTeamId = mine.teamId;
  const toTeamId = theirs.teamId as TeamId;
  const fingerprint = tradeOfferFingerprint(fromTeamId, toTeamId, proposal);
  if (
    state.user.pendingOwnerDecisions.some(
      (d) =>
        d.payload.fingerprint === fingerprint &&
        (d.payload.status === "pending" || d.payload.status === "negotiating"),
    )
  ) {
    return {
      ok: false,
      error: `You already sent this offer to ${recipient.displayName}.`,
    };
  }

  const createdOn = state.world.calendar.currentDate;
  const id = asOwnerDecisionId(
    `od_ptrade_${fromTeamId}_${createdOn}_${fingerprint.slice(0, 24)}`,
  );
  if (state.user.pendingOwnerDecisions.some((d) => d.id === id)) {
    return {
      ok: false,
      error: `You already sent this offer to ${recipient.displayName}.`,
    };
  }

  const cloned = cloneProposal(proposal);
  const payload: TradeOfferDecisionPayload = {
    offerId: id,
    offeringTeamId: fromTeamId,
    userTeamId: toTeamId,
    proposal: cloned,
    originalProposal: cloned,
    currentProposal: cloned,
    negotiationHistory: [
      { proposedByTeamId: fromTeamId, proposal: cloned, proposedOn: createdOn },
    ],
    status: "pending",
    fingerprint,
    createdOn,
    expiresOn: computeExpiresOn(state, createdOn),
  };
  const decision: PendingOwnerDecision = {
    id,
    type: "trade_offer",
    createdOn,
    blockingLevel: "non_blocking",
    // Surfaced only in the recipient's inbox.
    primaryTeamId: toTeamId,
    participantTeamIds: [toTeamId],
    payload,
  };
  return {
    ok: true,
    decision,
    state: {
      ...state,
      user: {
        ...state.user,
        pendingOwnerDecisions: [...state.user.pendingOwnerDecisions, decision],
      },
    },
  };
}

/**
 * The recipient answers a player offer with different terms: the original
 * offer is declined and the counter goes to the original proposer.
 */
export function counterPlayerTradeOffer(
  state: GameState,
  decision: PendingOwnerDecision,
  counterProposal: TradeProposal,
): PlayerTradeResult {
  const involved = new Set([
    decision.payload.offeringTeamId,
    decision.payload.userTeamId,
  ]);
  if (
    !involved.has(counterProposal.sideA.teamId) ||
    !involved.has(counterProposal.sideB.teamId) ||
    counterProposal.sideA.teamId === counterProposal.sideB.teamId
  ) {
    return {
      ok: false,
      error: "A counteroffer must be between the same two franchises.",
    };
  }
  const declined = resolvePendingOwnerDecision(state, {
    decisionId: decision.id,
    status: "declined",
    decisionSource: "owner",
  }).state;
  return proposePlayerTrade(declined, counterProposal);
}
