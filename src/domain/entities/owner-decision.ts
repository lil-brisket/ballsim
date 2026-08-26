import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { OwnerDecisionId, TeamId } from "@/domain/ids";

/** Calendar days a declined trade fingerprint blocks re-offers. */
export const TRADE_OFFER_REJECTION_COOLDOWN_DAYS = 14;

/** Bound recent resolved decisions kept on the user slice. */
export const OWNER_DECISION_HISTORY_MAX = 50;

export type OwnerDecisionType = "trade_offer";

export type OwnerDecisionStatus = "accepted" | "declined" | "delegated";

export type OwnerDecisionSource = "owner" | "owner_ai";

export type TradeOfferDecisionPayload = {
  offeringTeamId: TeamId;
  userTeamId: TeamId;
  proposal: TradeProposal;
  /** Normalized asset fingerprint for cooldown / de-dupe. */
  fingerprint: string;
};

export type PendingOwnerDecision = {
  id: OwnerDecisionId;
  type: "trade_offer";
  createdOn: string;
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
  /** Present for declines — blocks matching fingerprints until this date. */
  expiresOn?: string;
  payload: TradeOfferDecisionPayload;
};

export type UserSliceRef = {
  pendingOwnerDecisions: PendingOwnerDecision[];
  ownerDecisionHistory: OwnerDecisionRecord[];
};

/** At most one active owner decision may exist. */
export function getActiveOwnerDecision(
  user: UserSliceRef,
): PendingOwnerDecision | undefined {
  return user.pendingOwnerDecisions[0];
}

export function hasActiveOwnerDecision(user: UserSliceRef): boolean {
  return user.pendingOwnerDecisions.length > 0;
}

export function getPendingTradeOffers(
  user: UserSliceRef,
): PendingOwnerDecision[] {
  return user.pendingOwnerDecisions.filter(
    (decision) => decision.type === "trade_offer",
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
