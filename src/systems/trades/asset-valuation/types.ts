import type { DraftPickId, PlayerId } from "@/domain/ids";

export type TradeAssetRef =
  | { kind: "player"; playerId: PlayerId }
  | { kind: "draftPick"; draftPickId: DraftPickId };

export type AssetValueResult = {
  value: number;
  reasons: string[];
};

export type StandingsTierLabel =
  | "strong_lottery"
  | "likely_lottery"
  | "play_in_range"
  | "likely_playoff"
  | "contender";

export type PickProjection = {
  projectedOverallPick: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: "low" | "medium" | "high";
  tier: StandingsTierLabel;
  seasonProgress: number;
};
