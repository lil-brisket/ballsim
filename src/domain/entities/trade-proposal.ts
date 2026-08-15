import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";

/**
 * Assets one team sends in a two-team trade.
 * sideA sends these to sideB (and vice versa on the other side).
 */
export type TradeSide = {
  teamId: TeamId;
  playerIds: PlayerId[];
  draftPickIds: DraftPickId[];
};

/**
 * Canonical two-team trade proposal.
 * sideA sends its listed assets to sideB; sideB sends its listed assets to sideA.
 */
export type TradeProposal = {
  sideA: TradeSide;
  sideB: TradeSide;
};

export function tradeSideAssetCount(side: TradeSide): number {
  return side.playerIds.length + side.draftPickIds.length;
}
