import { addCalendarDays } from "@/domain/calendar-date";
import {
  OWNER_DECISION_HISTORY_MAX,
  TRADE_OFFER_REJECTION_COOLDOWN_DAYS,
  getActiveOwnerDecision,
  tradeOfferFingerprint,
  type OwnerDecisionRecord,
  type OwnerDecisionSource,
  type OwnerDecisionStatus,
  type PendingOwnerDecision,
  type TradeOfferDecisionPayload,
} from "@/domain/entities/owner-decision";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { asOwnerDecisionId, type OwnerDecisionId, type TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export type TradeOfferEnqueueOutcome =
  | "queued"
  | "executed"
  | "rejected"
  | "skipped";

export type EnqueueTradeOfferResult = {
  outcome: TradeOfferEnqueueOutcome;
  state: GameState;
  decision?: PendingOwnerDecision;
  reason?: string;
};

/**
 * Queue an incoming trade offer for an owned franchise.
 * Enforces: at most one active decision; rejection fingerprint cooldown.
 */
export function enqueueTradeOfferForOwner(
  state: GameState,
  offeringTeamId: TeamId,
  proposal: TradeProposal,
  options: { targetOwnedTeamId?: TeamId } = {},
): EnqueueTradeOfferResult {
  const userTeamId =
    options.targetOwnedTeamId ??
    (state.user.ownedTeamIds.includes(proposal.sideA.teamId)
      ? proposal.sideA.teamId
      : state.user.ownedTeamIds.includes(proposal.sideB.teamId)
        ? proposal.sideB.teamId
        : state.user.activeOwnerTeamId);

  if (!state.user.ownedTeamIds.includes(userTeamId)) {
    return {
      outcome: "rejected",
      state,
      reason: "target_not_owned",
    };
  }
  if (
    proposal.sideA.teamId !== userTeamId &&
    proposal.sideB.teamId !== userTeamId
  ) {
    return {
      outcome: "rejected",
      state,
      reason: "proposal_does_not_involve_user",
    };
  }
  if (
    proposal.sideA.teamId !== offeringTeamId &&
    proposal.sideB.teamId !== offeringTeamId
  ) {
    return {
      outcome: "rejected",
      state,
      reason: "offering_team_not_in_proposal",
    };
  }

  if (getActiveOwnerDecision(state.user)) {
    return {
      outcome: "skipped",
      state,
      reason: "active_decision_exists",
    };
  }

  const fingerprint = tradeOfferFingerprint(
    offeringTeamId,
    userTeamId,
    proposal,
  );

  if (isFingerprintOnCooldown(state, fingerprint)) {
    return {
      outcome: "skipped",
      state,
      reason: "fingerprint_cooldown",
    };
  }

  const createdOn = state.world.calendar.currentDate;
  const id = asOwnerDecisionId(
    `od_trade_${offeringTeamId}_${createdOn}_${fingerprint.slice(0, 24)}`,
  );

  // Idempotent: same id already pending (should not happen with empty queue).
  if (state.user.pendingOwnerDecisions.some((d) => d.id === id)) {
    return {
      outcome: "skipped",
      state,
      reason: "duplicate_pending_id",
    };
  }

  const payload: TradeOfferDecisionPayload = {
    offeringTeamId,
    userTeamId,
    proposal: cloneProposal(proposal),
    fingerprint,
  };

  const participantTeamIds = [userTeamId, offeringTeamId].filter(
    (id, index, arr) => arr.indexOf(id) === index,
  );

  const decision: PendingOwnerDecision = {
    id,
    type: "trade_offer",
    createdOn,
    blockingLevel: "blocking",
    primaryTeamId: userTeamId,
    participantTeamIds,
    payload,
  };

  return {
    outcome: "queued",
    state: {
      ...state,
      user: {
        ...state.user,
        pendingOwnerDecisions: [decision],
      },
    },
    decision,
  };
}

export function isFingerprintOnCooldown(
  state: GameState,
  fingerprint: string,
): boolean {
  const today = state.world.calendar.currentDate;
  return state.user.ownerDecisionHistory.some(
    (record) =>
      record.type === "trade_offer" &&
      record.status === "declined" &&
      record.fingerprint === fingerprint &&
      record.expiresOn !== undefined &&
      record.expiresOn >= today,
  );
}

export type ResolveOwnerDecisionInput = {
  decisionId: OwnerDecisionId;
  status: OwnerDecisionStatus;
  decisionSource: OwnerDecisionSource;
};

/**
 * Move a pending decision into history and clear the pending slot.
 * Idempotent when the decision is already gone — returns unchanged state.
 */
export function resolvePendingOwnerDecision(
  state: GameState,
  input: ResolveOwnerDecisionInput,
): { state: GameState; resolved: OwnerDecisionRecord | undefined } {
  const pending = state.user.pendingOwnerDecisions.find(
    (d) => d.id === input.decisionId,
  );
  if (!pending) {
    return { state, resolved: undefined };
  }

  const resolvedOn = state.world.calendar.currentDate;
  const record: OwnerDecisionRecord = {
    id: pending.id,
    type: pending.type,
    status: input.status,
    decisionSource: input.decisionSource,
    createdOn: pending.createdOn,
    resolvedOn,
    fingerprint: pending.payload.fingerprint,
    blockingLevel: pending.blockingLevel,
    primaryTeamId: pending.primaryTeamId,
    participantTeamIds: [...pending.participantTeamIds],
    payload: pending.payload,
  };

  if (input.status === "declined") {
    record.expiresOn = addCalendarDays(
      resolvedOn,
      TRADE_OFFER_REJECTION_COOLDOWN_DAYS,
    );
  }

  const history = [record, ...state.user.ownerDecisionHistory].slice(
    0,
    OWNER_DECISION_HISTORY_MAX,
  );

  return {
    state: {
      ...state,
      user: {
        ...state.user,
        pendingOwnerDecisions: state.user.pendingOwnerDecisions.filter(
          (d) => d.id !== input.decisionId,
        ),
        ownerDecisionHistory: history,
      },
    },
    resolved: record,
  };
}

function cloneProposal(proposal: TradeProposal): TradeProposal {
  return {
    sideA: {
      teamId: proposal.sideA.teamId,
      playerIds: [...proposal.sideA.playerIds],
      draftPickIds: [...proposal.sideA.draftPickIds],
    },
    sideB: {
      teamId: proposal.sideB.teamId,
      playerIds: [...proposal.sideB.playerIds],
      draftPickIds: [...proposal.sideB.draftPickIds],
    },
  };
}
