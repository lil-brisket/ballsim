import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { TRADE_BLOCK_VALUE_BONUS } from "@/systems/trades-config";
import { calculateDraftPickValue } from "@/systems/trades/draft-pick-value";
import { getTradeBlock } from "@/systems/trades/trade-block";
import { gmTradeAcceptanceThreshold } from "@/systems/staff-effects";

export type TradeOfferEvaluation = {
  accepted: boolean;
  netValue: number;
  incomingValue: number;
  outgoingValue: number;
  tradeBlockBonus: number;
};

/**
 * Deterministic AI acceptance: accept iff netValue >= threshold.
 * Threshold defaults to 0; better GM softens acceptance (negative threshold).
 * netValue = incomingValue - outgoingValue (+ trade-block bonuses).
 * Not a second validator — legality is validateTrade's job.
 */
export function evaluateTradeOffer(
  state: GameState,
  evaluatingTeamId: TeamId,
  proposal: TradeProposal,
): TradeOfferEvaluation {
  const { incomingPlayerIds, outgoingPlayerIds, incomingPickIds, outgoingPickIds } =
    assetsFromPerspective(evaluatingTeamId, proposal);

  let incomingValue = 0;
  let outgoingValue = 0;

  for (const playerId of incomingPlayerIds) {
    incomingValue += playerValue(state, playerId);
  }
  for (const playerId of outgoingPlayerIds) {
    outgoingValue += playerValue(state, playerId);
  }
  for (const pickId of incomingPickIds) {
    incomingValue += pickValue(state, pickId);
  }
  for (const pickId of outgoingPickIds) {
    outgoingValue += pickValue(state, pickId);
  }

  const block = getTradeBlock(state, evaluatingTeamId);
  let tradeBlockBonus = 0;
  for (const playerId of incomingPlayerIds) {
    if (
      block.assets.some(
        (asset) => asset.kind === "player" && asset.playerId === playerId,
      )
    ) {
      tradeBlockBonus += TRADE_BLOCK_VALUE_BONUS;
    }
  }
  for (const pickId of incomingPickIds) {
    if (
      block.assets.some(
        (asset) => asset.kind === "draftPick" && asset.draftPickId === pickId,
      )
    ) {
      tradeBlockBonus += TRADE_BLOCK_VALUE_BONUS;
    }
  }

  const netValue = incomingValue + tradeBlockBonus - outgoingValue;
  const threshold = gmTradeAcceptanceThreshold(state, evaluatingTeamId);
  return {
    accepted: netValue >= threshold,
    netValue,
    incomingValue,
    outgoingValue,
    tradeBlockBonus,
  };
}

function assetsFromPerspective(
  evaluatingTeamId: TeamId,
  proposal: TradeProposal,
): {
  incomingPlayerIds: PlayerId[];
  outgoingPlayerIds: PlayerId[];
  incomingPickIds: DraftPickId[];
  outgoingPickIds: DraftPickId[];
} {
  if (proposal.sideA.teamId === evaluatingTeamId) {
    return {
      outgoingPlayerIds: proposal.sideA.playerIds,
      outgoingPickIds: proposal.sideA.draftPickIds,
      incomingPlayerIds: proposal.sideB.playerIds,
      incomingPickIds: proposal.sideB.draftPickIds,
    };
  }
  if (proposal.sideB.teamId === evaluatingTeamId) {
    return {
      outgoingPlayerIds: proposal.sideB.playerIds,
      outgoingPickIds: proposal.sideB.draftPickIds,
      incomingPlayerIds: proposal.sideA.playerIds,
      incomingPickIds: proposal.sideA.draftPickIds,
    };
  }
  throw new Error(
    `Evaluating team "${evaluatingTeamId}" is not a party to the proposal.`,
  );
}

function playerValue(state: GameState, playerId: PlayerId): number {
  const player = state.world.players[playerId];
  if (player === undefined) {
    return 0;
  }
  return calculatePlayerOverall(player.position, player.attributes);
}

function pickValue(state: GameState, pickId: DraftPickId): number {
  const pick = state.world.draftPicks[pickId];
  if (pick === undefined) {
    return 0;
  }
  return calculateDraftPickValue(pick);
}
