import { addCalendarDays } from "@/domain/calendar-date";
import {
  OWNER_DECISION_HISTORY_MAX,
  TRADE_OFFER_REJECTION_COOLDOWN_DAYS,
  cloneProposal,
  getActiveOwnerDecision,
  normalizeTradeOfferPayload,
  tradeOfferFingerprint,
  type OwnerDecisionRecord,
  type OwnerDecisionSource,
  type OwnerDecisionStatus,
  type PendingOwnerDecision,
  type TradeMotivation,
  type TradeOfferDecisionPayload,
  type TradeNegotiationEntry,
} from "@/domain/entities/owner-decision";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { asOwnerDecisionId, type OwnerDecisionId, type TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { TRADE_OFFER_EXPIRATION } from "@/systems/trades-config";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { evaluateTrade } from "@/systems/trades/asset-valuation/complete-trade-evaluation";

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

export type EnqueueTradeOfferOptions = {
  targetOwnedTeamId?: TeamId;
  motivation?: TradeMotivation;
};

/**
 * Queue an incoming trade offer for an owned franchise.
 * Appends to FIFO queue (multi-offer). Skips duplicate fingerprint cooldown.
 */
export function enqueueTradeOfferForOwner(
  state: GameState,
  offeringTeamId: TeamId,
  proposal: TradeProposal,
  options: EnqueueTradeOfferOptions = {},
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

  if (
    state.user.pendingOwnerDecisions.some(
      (d) =>
        d.payload.fingerprint === fingerprint &&
        (d.payload.status === "pending" || d.payload.status === "negotiating"),
    )
  ) {
    return {
      outcome: "skipped",
      state,
      reason: "duplicate_pending_fingerprint",
    };
  }

  const createdOn = state.world.calendar.currentDate;
  const id = asOwnerDecisionId(
    `od_trade_${offeringTeamId}_${createdOn}_${fingerprint.slice(0, 24)}`,
  );

  if (state.user.pendingOwnerDecisions.some((d) => d.id === id)) {
    return {
      outcome: "skipped",
      state,
      reason: "duplicate_pending_id",
    };
  }

  const cloned = cloneProposal(proposal);
  const evaluation = evaluateTrade(state, userTeamId, cloned);
  const historyEntry: TradeNegotiationEntry = {
    proposedByTeamId: offeringTeamId,
    proposal: cloned,
    proposedOn: createdOn,
    evaluation,
  };

  const payload: TradeOfferDecisionPayload = {
    offerId: id,
    offeringTeamId,
    userTeamId,
    proposal: cloned,
    originalProposal: cloned,
    currentProposal: cloned,
    negotiationHistory: [historyEntry],
    status: "pending",
    motivation: options.motivation,
    fingerprint,
    createdOn,
    expiresOn: computeExpiresOn(state, createdOn),
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
        pendingOwnerDecisions: [
          ...state.user.pendingOwnerDecisions,
          decision,
        ],
      },
    },
    decision,
  };
}

export function computeExpiresOn(state: GameState, createdOn: string): string {
  const calendar = getCalendarContext(state);
  let days: number = TRADE_OFFER_EXPIRATION.normalDays;
  if (calendar.lifecyclePhase === "offseason") {
    days = TRADE_OFFER_EXPIRATION.offseasonDays;
  } else if (
    calendar.daysUntilTradeDeadline !== null &&
    calendar.daysUntilTradeDeadline <= TRADE_OFFER_EXPIRATION.deadlineProximityDays
  ) {
    days = TRADE_OFFER_EXPIRATION.nearDeadlineDays;
  }
  return addCalendarDays(createdOn, days);
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
 * Move a pending decision into history and clear it from the queue.
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
  const normalized = normalizeTradeOfferPayload(
    pending.payload,
    pending.id,
    pending.createdOn,
  );
  const record: OwnerDecisionRecord = {
    id: pending.id,
    type: pending.type,
    status: input.status,
    decisionSource: input.decisionSource,
    createdOn: pending.createdOn,
    resolvedOn,
    fingerprint: normalized.fingerprint,
    blockingLevel: pending.blockingLevel,
    primaryTeamId: pending.primaryTeamId,
    participantTeamIds: [...pending.participantTeamIds],
    payload: {
      ...normalized,
      status:
        input.status === "accepted"
          ? "accepted"
          : input.status === "expired"
            ? "expired"
            : "declined",
    },
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

/**
 * Apply a user counteroffer. CPU Accept → execute path handled by caller.
 * CPU Reject → declined. CPU Counter → stays negotiating with new currentProposal.
 */
export function applyTradeCounterofferState(
  state: GameState,
  decisionId: OwnerDecisionId,
  counterProposal: TradeProposal,
  cpuDecision: "accepted" | "rejected" | "countered",
  cpuCounterProposal?: TradeProposal,
): GameState {
  const pending = state.user.pendingOwnerDecisions.find(
    (d) => d.id === decisionId,
  );
  if (!pending) return state;

  const today = state.world.calendar.currentDate;
  const userEval = evaluateTrade(
    state,
    pending.payload.userTeamId,
    counterProposal,
  );
  const history: TradeNegotiationEntry[] = [
    ...(pending.payload.negotiationHistory ?? []),
    {
      proposedByTeamId: pending.payload.userTeamId,
      proposal: cloneProposal(counterProposal),
      proposedOn: today,
      evaluation: userEval,
      decision:
        cpuDecision === "accepted"
          ? "accepted"
          : cpuDecision === "rejected"
            ? "rejected"
            : "countered",
    },
  ];

  if (cpuDecision === "countered" && cpuCounterProposal) {
    const cpuEval = evaluateTrade(
      state,
      pending.payload.offeringTeamId,
      cpuCounterProposal,
    );
    history.push({
      proposedByTeamId: pending.payload.offeringTeamId,
      proposal: cloneProposal(cpuCounterProposal),
      proposedOn: today,
      evaluation: cpuEval,
      decision: "countered",
    });
  }

  const nextProposal =
    cpuDecision === "countered" && cpuCounterProposal
      ? cloneProposal(cpuCounterProposal)
      : cloneProposal(counterProposal);

  const nextPayload: TradeOfferDecisionPayload = {
    ...normalizeTradeOfferPayload(
      pending.payload,
      pending.id,
      pending.createdOn,
    ),
    proposal: nextProposal,
    currentProposal: nextProposal,
    negotiationHistory: history,
    status: "negotiating",
  };

  return {
    ...state,
    user: {
      ...state.user,
      pendingOwnerDecisions: state.user.pendingOwnerDecisions.map((d) =>
        d.id === decisionId ? { ...d, payload: nextPayload } : d,
      ),
    },
  };
}

/**
 * Expire offers past expiresOn. Returns updated state + expired ids.
 */
export function expireDatedTradeOffers(state: GameState): {
  state: GameState;
  expiredIds: OwnerDecisionId[];
} {
  const today = state.world.calendar.currentDate;
  let working = state;
  const expiredIds: OwnerDecisionId[] = [];
  for (const decision of state.user.pendingOwnerDecisions) {
    const expiresOn = decision.payload.expiresOn;
    if (!expiresOn || expiresOn >= today) continue;
    const resolved = resolvePendingOwnerDecision(working, {
      decisionId: decision.id,
      status: "expired",
      decisionSource: "system",
    });
    working = resolved.state;
    expiredIds.push(decision.id);
  }
  return { state: working, expiredIds };
}

/** @deprecated use getActiveOwnerDecision — re-export for callers. */
export { getActiveOwnerDecision };
