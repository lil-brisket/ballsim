import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { OwnerDecisionId, TeamId } from "@/domain/ids";
import type { PlayerPosition } from "@/domain/entities/player";
import type { TradeEvaluation } from "@/systems/trades/asset-valuation/complete-trade-evaluation";

/** Calendar days a declined trade fingerprint blocks re-offers. */
export const TRADE_OFFER_REJECTION_COOLDOWN_DAYS = 14;

/** Bound recent resolved decisions kept on the user slice. */
export const OWNER_DECISION_HISTORY_MAX = 50;

export type OwnerDecisionType = "trade_offer";

export type OwnerDecisionStatus =
  | "accepted"
  | "declined"
  | "delegated"
  | "expired";

export type OwnerDecisionSource = "owner" | "owner_ai" | "system";

/** Whether the decision pauses simulation advance. */
export type OwnerDecisionBlockingLevel = "blocking" | "non_blocking";

export type TradeOfferStatus =
  | "pending"
  | "negotiating"
  | "accepted"
  | "declined"
  | "expired";

export type TradeMotivation =
  | { type: "positional_need"; targetPosition: PlayerPosition }
  | { type: "salary_relief" }
  | { type: "rebuild" }
  | { type: "contender_upgrade" }
  | { type: "asset_accumulation" };

export type TradeNegotiationEntry = {
  proposedByTeamId: TeamId;
  proposal: TradeProposal;
  proposedOn: string;
  evaluation?: TradeEvaluation;
  decision?: "accepted" | "rejected" | "countered";
};

export type TradeOfferDecisionPayload = {
  /** Explicit offer id (mirrors decision.id). */
  offerId?: string;
  offeringTeamId: TeamId;
  userTeamId: TeamId;
  /**
   * @deprecated Prefer originalProposal / currentProposal.
   * Kept for v58 save compatibility during migration.
   */
  proposal: TradeProposal;
  /** Original CPU offer — never mutated after enqueue. */
  originalProposal: TradeProposal;
  /** Latest terms under consideration. */
  currentProposal: TradeProposal;
  negotiationHistory: TradeNegotiationEntry[];
  status: TradeOfferStatus;
  motivation?: TradeMotivation;
  /** Normalized asset fingerprint for cooldown / de-dupe. */
  fingerprint: string;
  createdOn?: string;
  /** Calendar date when the offer expires if unresolved. */
  expiresOn?: string;
};

export type PendingOwnerDecision = {
  id: OwnerDecisionId;
  type: "trade_offer";
  createdOn: string;
  /** Whether this decision pauses simulation advance. */
  blockingLevel: OwnerDecisionBlockingLevel;
  /** Primary franchise this decision is surfaced under / initiated for. */
  primaryTeamId: TeamId;
  /** All franchises involved (includes primaryTeamId). */
  participantTeamIds: TeamId[];
  payload: TradeOfferDecisionPayload;
};

export type OwnerDecisionRecord = {
  id: OwnerDecisionId;
  type: "trade_offer";
  status: OwnerDecisionStatus;
  decisionSource: OwnerDecisionSource;
  createdOn: string;
  resolvedOn: string;
  fingerprint: string;
  blockingLevel: OwnerDecisionBlockingLevel;
  primaryTeamId: TeamId;
  participantTeamIds: TeamId[];
  /** Present for declines — blocks matching fingerprints until this date. */
  expiresOn?: string;
  payload: TradeOfferDecisionPayload;
};

export type UserSliceRef = {
  pendingOwnerDecisions: PendingOwnerDecision[];
  ownerDecisionHistory: OwnerDecisionRecord[];
};

function isOpenOfferStatus(status: TradeOfferStatus | undefined): boolean {
  return status === undefined || status === "pending" || status === "negotiating";
}

/**
 * First blocking pending offer. Optionally scoped to a franchise.
 */
export function getActiveOwnerDecision(
  user: UserSliceRef,
  teamId?: TeamId,
): PendingOwnerDecision | undefined {
  const pool = teamId
    ? user.pendingOwnerDecisions.filter(
        (d) =>
          d.payload.userTeamId === teamId ||
          d.primaryTeamId === teamId ||
          d.participantTeamIds.includes(teamId),
      )
    : user.pendingOwnerDecisions;
  return pool.find(
    (decision) =>
      decision.blockingLevel === "blocking" &&
      isOpenOfferStatus(decision.payload.status),
  );
}

/** True when any open blocking decision exists. */
export function hasBlockingOwnerDecision(user: UserSliceRef): boolean {
  return user.pendingOwnerDecisions.some(
    (decision) =>
      decision.blockingLevel === "blocking" &&
      isOpenOfferStatus(decision.payload.status),
  );
}

/**
 * @deprecated Prefer {@link hasBlockingOwnerDecision}.
 */
export function hasActiveOwnerDecision(user: UserSliceRef): boolean {
  return hasBlockingOwnerDecision(user);
}

export function getPendingTradeOffers(
  user: UserSliceRef,
): PendingOwnerDecision[] {
  return user.pendingOwnerDecisions.filter(
    (decision) =>
      decision.type === "trade_offer" &&
      isOpenOfferStatus(decision.payload.status),
  );
}

/** Pending decisions for a franchise (team-scoped inbox). */
export function getPendingDecisionsForTeam(
  user: UserSliceRef,
  teamId: TeamId,
): PendingOwnerDecision[] {
  return user.pendingOwnerDecisions.filter(
    (decision) =>
      isOpenOfferStatus(decision.payload.status) &&
      (decision.payload.userTeamId === teamId ||
        decision.participantTeamIds.includes(teamId)),
  );
}

export function getBlockingOwnerDecisions(
  user: UserSliceRef,
): PendingOwnerDecision[] {
  return user.pendingOwnerDecisions.filter(
    (decision) =>
      decision.blockingLevel === "blocking" &&
      isOpenOfferStatus(decision.payload.status),
  );
}

/**
 * Sorted asset fingerprint for trade offer cooldown.
 * Format: offering|user|offeredAssets|requestedAssets
 */
export function tradeOfferFingerprint(
  offeringTeamId: TeamId,
  userTeamId: TeamId,
  proposal: TradeProposal,
): string {
  const { offered, requested } = assetsRelativeToUser(
    offeringTeamId,
    userTeamId,
    proposal,
  );
  return [
    offeringTeamId,
    userTeamId,
    offered.join(","),
    requested.join(","),
  ].join("|");
}

export function assetsRelativeToUser(
  offeringTeamId: TeamId,
  userTeamId: TeamId,
  proposal: TradeProposal,
): { offered: string[]; requested: string[] } {
  const offeringSide =
    proposal.sideA.teamId === offeringTeamId
      ? proposal.sideA
      : proposal.sideB.teamId === offeringTeamId
        ? proposal.sideB
        : null;
  const userSide =
    proposal.sideA.teamId === userTeamId
      ? proposal.sideA
      : proposal.sideB.teamId === userTeamId
        ? proposal.sideB
        : null;
  if (!offeringSide || !userSide) {
    throw new Error(
      "Trade proposal sides must match offering and user team ids.",
    );
  }
  return {
    offered: sortAssetKeys(offeringSide.playerIds, offeringSide.draftPickIds),
    requested: sortAssetKeys(userSide.playerIds, userSide.draftPickIds),
  };
}

function sortAssetKeys(
  playerIds: readonly string[],
  draftPickIds: readonly string[],
): string[] {
  return [
    ...playerIds.map((id) => `player:${id}`),
    ...draftPickIds.map((id) => `pick:${id}`),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Normalize legacy payloads missing v59 fields. */
export function normalizeTradeOfferPayload(
  payload: TradeOfferDecisionPayload,
  decisionId: string,
  createdOn: string,
): TradeOfferDecisionPayload {
  const original = payload.originalProposal ?? payload.proposal;
  const current = payload.currentProposal ?? payload.proposal ?? original;
  return {
    ...payload,
    offerId: payload.offerId ?? decisionId,
    proposal: current,
    originalProposal: cloneProposal(original),
    currentProposal: cloneProposal(current),
    negotiationHistory: payload.negotiationHistory ?? [],
    status: payload.status ?? "pending",
    createdOn: payload.createdOn ?? createdOn,
    expiresOn: payload.expiresOn,
    motivation: payload.motivation,
  };
}

export function cloneProposal(proposal: TradeProposal): TradeProposal {
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

/** Build a complete v59 trade-offer payload from a minimal proposal. */
export function buildTradeOfferPayload(input: {
  offeringTeamId: TeamId;
  userTeamId: TeamId;
  proposal: TradeProposal;
  fingerprint: string;
  decisionId?: string;
  createdOn?: string;
  expiresOn?: string;
  motivation?: TradeMotivation;
  status?: TradeOfferStatus;
}): TradeOfferDecisionPayload {
  const proposal = cloneProposal(input.proposal);
  return {
    offerId: input.decisionId,
    offeringTeamId: input.offeringTeamId,
    userTeamId: input.userTeamId,
    proposal,
    originalProposal: cloneProposal(proposal),
    currentProposal: cloneProposal(proposal),
    negotiationHistory: [
      {
        proposedByTeamId: input.offeringTeamId,
        proposal: cloneProposal(proposal),
        proposedOn: input.createdOn ?? "1970-01-01",
      },
    ],
    status: input.status ?? "pending",
    motivation: input.motivation,
    fingerprint: input.fingerprint,
    createdOn: input.createdOn,
    expiresOn: input.expiresOn,
  };
}
