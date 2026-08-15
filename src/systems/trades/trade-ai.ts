import type { TradeBlockAsset } from "@/domain/entities/trade-block";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getTradeBlock } from "@/systems/trades/trade-block";
import { validateTrade } from "@/systems/trades/trade-validation";

/**
 * Builds a normal TradeProposal from trade-block assets.
 * Returns undefined when no valid 1-for-1 pairing exists.
 * Caller must still run evaluateTradeOffer / executeTrade.
 */
export function generateAiTradeProposal(
  state: GameState,
  fromTeamId: TeamId,
): TradeProposal | undefined {
  const ourBlock = getTradeBlock(state, fromTeamId);
  if (ourBlock.assets.length === 0) {
    return undefined;
  }

  const ourAssets = sortAssets(ourBlock.assets);
  const otherTeamIds = (Object.keys(state.world.teams) as TeamId[])
    .filter((id) => id !== fromTeamId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const outgoing of ourAssets) {
    for (const otherTeamId of otherTeamIds) {
      const theirBlock = getTradeBlock(state, otherTeamId);
      const theirAssets = sortAssets(theirBlock.assets);
      for (const incoming of theirAssets) {
        const proposal = buildOneForOne(fromTeamId, outgoing, otherTeamId, incoming);
        if (validateTrade(state, proposal).valid) {
          return proposal;
        }
      }
    }
  }

  return undefined;
}

function buildOneForOne(
  fromTeamId: TeamId,
  outgoing: TradeBlockAsset,
  toTeamId: TeamId,
  incoming: TradeBlockAsset,
): TradeProposal {
  return {
    sideA: {
      teamId: fromTeamId,
      playerIds: outgoing.kind === "player" ? [outgoing.playerId] : [],
      draftPickIds:
        outgoing.kind === "draftPick" ? [outgoing.draftPickId] : [],
    },
    sideB: {
      teamId: toTeamId,
      playerIds: incoming.kind === "player" ? [incoming.playerId] : [],
      draftPickIds:
        incoming.kind === "draftPick" ? [incoming.draftPickId] : [],
    },
  };
}

function sortAssets(assets: readonly TradeBlockAsset[]): TradeBlockAsset[] {
  return [...assets].sort((a, b) => {
    const keyA =
      a.kind === "player" ? `player:${a.playerId}` : `pick:${a.draftPickId}`;
    const keyB =
      b.kind === "player" ? `player:${b.playerId}` : `pick:${b.draftPickId}`;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
}
