import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getTradeBlock } from "@/systems/trades/trade-block";
import {
  TRADE_DESIRABILITY_WEIGHTS,
} from "@/systems/trades-config";
import { getRetentionPriority } from "@/systems/trades/asset-valuation/retention-priority";
import { calculateTradeNeeds, tradeNeedLevelScore } from "@/systems/trades/trade-needs";
import type { TradeAssetRef } from "@/systems/trades/asset-valuation/types";

export type TradeDirection = "send" | "receive";

export type TradeDesirabilityResult = {
  /** 0–100; higher = more willing to move (send) or acquire (receive). */
  score: number;
  reasons: string[];
};

/**
 * Willingness to include an asset in a trade — separate from asset/team value.
 */
export function getTradeDesirability(
  state: GameState,
  teamId: TeamId,
  asset: TradeAssetRef,
  direction: TradeDirection,
): TradeDesirabilityResult {
  if (asset.kind === "draftPick") {
    return pickDesirability(state, teamId, asset.draftPickId, direction);
  }
  return playerDesirability(state, teamId, asset.playerId, direction);
}

function playerDesirability(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
  direction: TradeDirection,
): TradeDesirabilityResult {
  const player = state.world.players[playerId];
  if (!player) {
    return { score: 0, reasons: ["Unknown player"] };
  }

  const reasons: string[] = [];
  let score = 50;

  if (direction === "send") {
    const block = getTradeBlock(state, teamId);
    if (
      block.assets.some(
        (a) => a.kind === "player" && a.playerId === playerId,
      )
    ) {
      score += TRADE_DESIRABILITY_WEIGHTS.onBlockBonus;
      reasons.push("Already on trade block");
    }

    const needs = calculateTradeNeeds(state, teamId);
    const pos = needs.byPosition.find((p) => p.position === player.position);
    if (pos?.surplus) {
      score += TRADE_DESIRABILITY_WEIGHTS.surplusBonus;
      reasons.push("Positional surplus");
    }

    const retention = getRetentionPriority(state, teamId, playerId);
    score -= retention * TRADE_DESIRABILITY_WEIGHTS.retentionPenaltyScale;
    if (retention >= 75) {
      reasons.push("High retention priority");
    }
  } else {
    const needs = calculateTradeNeeds(state, teamId);
    const pos = needs.byPosition.find((p) => p.position === player.position);
    if (pos && tradeNeedLevelScore(pos.level) >= tradeNeedLevelScore("moderate")) {
      score += TRADE_DESIRABILITY_WEIGHTS.needAcquireBonus;
      reasons.push(`Team has a positional need at ${player.position}`);
    }
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}

function pickDesirability(
  state: GameState,
  teamId: TeamId,
  pickId: DraftPickId,
  direction: TradeDirection,
): TradeDesirabilityResult {
  const reasons: string[] = [];
  let score = 50;
  const block = getTradeBlock(state, teamId);
  if (
    direction === "send" &&
    block.assets.some(
      (a) => a.kind === "draftPick" && a.draftPickId === pickId,
    )
  ) {
    score += TRADE_DESIRABILITY_WEIGHTS.onBlockBonus;
    reasons.push("Pick listed on trade block");
  }
  if (direction === "receive") {
    score += 10;
    reasons.push("Future asset interest");
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}
