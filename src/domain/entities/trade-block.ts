import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";

export type TradeBlockStatus =
  | "available"
  | "actively_shopping"
  | "open_to_offers";

export const TRADE_BLOCK_STATUSES: readonly TradeBlockStatus[] = [
  "available",
  "actively_shopping",
  "open_to_offers",
];

export const DEFAULT_TRADE_BLOCK_STATUS: TradeBlockStatus = "available";

/**
 * Trade Block status is metadata on the block entry.
 * It must never be persisted onto Player or DraftPick.
 */
export type TradeBlockAsset =
  | {
      kind: "player";
      playerId: PlayerId;
      status: TradeBlockStatus;
    }
  | {
      kind: "draftPick";
      draftPickId: DraftPickId;
      status: TradeBlockStatus;
    };

export type TradeBlock = {
  teamId: TeamId;
  assets: TradeBlockAsset[];
};

export function createEmptyTradeBlock(teamId: TeamId): TradeBlock {
  return { teamId, assets: [] };
}

export function isTradeBlockStatus(value: string): value is TradeBlockStatus {
  return TRADE_BLOCK_STATUSES.includes(value as TradeBlockStatus);
}
