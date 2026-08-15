import {
  createEmptyTradeBlock,
  DEFAULT_TRADE_BLOCK_STATUS,
  type TradeBlock,
  type TradeBlockAsset,
  type TradeBlockStatus,
} from "@/domain/entities/trade-block";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

export type TradeBlockAssetRef =
  | { kind: "player"; playerId: PlayerId }
  | { kind: "draftPick"; draftPickId: DraftPickId };

/**
 * Pure view of a team's trade block with stale (unowned) assets filtered out.
 * Does not persist cleanup.
 */
export function getTradeBlock(state: GameState, teamId: TeamId): TradeBlock {
  const existing = state.business.tradeBlocks[teamId];
  const block = existing ?? createEmptyTradeBlock(teamId);
  return {
    teamId: block.teamId,
    assets: block.assets.filter((asset) => isAssetOwnedByTeam(state, teamId, asset)),
  };
}

/**
 * Adds an owned asset to the team's trade block. Does not change roster or pick ownership.
 */
export function addToTradeBlock(
  state: GameState,
  teamId: TeamId,
  assetRef: TradeBlockAssetRef,
  status: TradeBlockStatus = DEFAULT_TRADE_BLOCK_STATUS,
): SystemResult {
  assertTeamExists(state, teamId);
  const asset = toTradeBlockAsset(assetRef, status);
  if (!isAssetOwnedByTeam(state, teamId, asset)) {
    throw new Error(
      `Cannot add asset to trade block: not owned by team "${teamId}".`,
    );
  }

  const existing = state.business.tradeBlocks[teamId] ?? createEmptyTradeBlock(teamId);
  if (assetAlreadyListed(existing, asset)) {
    return systemResult(state);
  }

  const nextBlock: TradeBlock = {
    teamId,
    assets: [...existing.assets, asset],
  };

  return systemResult({
    ...state,
    business: {
      ...state.business,
      tradeBlocks: {
        ...state.business.tradeBlocks,
        [teamId]: nextBlock,
      },
    },
  });
}

/**
 * Removes an asset from the team's trade block if present.
 */
export function removeFromTradeBlock(
  state: GameState,
  teamId: TeamId,
  assetRef: TradeBlockAssetRef,
): SystemResult {
  assertTeamExists(state, teamId);
  const existing = state.business.tradeBlocks[teamId];
  if (existing === undefined) {
    return systemResult(state);
  }

  const assets = existing.assets.filter((asset) => !assetMatchesRef(asset, assetRef));
  if (assets.length === existing.assets.length) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    business: {
      ...state.business,
      tradeBlocks: {
        ...state.business.tradeBlocks,
        [teamId]: { teamId, assets },
      },
    },
  });
}

export function isAssetOwnedByTeam(
  state: GameState,
  teamId: TeamId,
  asset: TradeBlockAsset | TradeBlockAssetRef,
): boolean {
  if (asset.kind === "player") {
    const player = state.world.players[asset.playerId];
    if (player === undefined) {
      return false;
    }
    const team = state.world.teams[teamId];
    if (team === undefined) {
      return false;
    }
    return player.teamId === teamId && team.roster.includes(asset.playerId);
  }
  const pick = state.world.draftPicks[asset.draftPickId];
  return pick !== undefined && pick.ownerTeamId === teamId;
}

function toTradeBlockAsset(
  ref: TradeBlockAssetRef,
  status: TradeBlockStatus,
): TradeBlockAsset {
  if (ref.kind === "player") {
    return { kind: "player", playerId: ref.playerId, status };
  }
  return { kind: "draftPick", draftPickId: ref.draftPickId, status };
}

function assetAlreadyListed(block: TradeBlock, asset: TradeBlockAsset): boolean {
  return block.assets.some((existing) => assetMatchesRef(existing, asset));
}

function assetMatchesRef(
  asset: TradeBlockAsset,
  ref: TradeBlockAssetRef | TradeBlockAsset,
): boolean {
  if (asset.kind === "player" && ref.kind === "player") {
    return asset.playerId === ref.playerId;
  }
  if (asset.kind === "draftPick" && ref.kind === "draftPick") {
    return asset.draftPickId === ref.draftPickId;
  }
  return false;
}

function assertTeamExists(state: GameState, teamId: TeamId): void {
  if (state.world.teams[teamId] === undefined) {
    throw new Error(`Team "${teamId}" does not exist.`);
  }
}

/**
 * Removes traded assets from both teams' persisted trade blocks.
 * Used by executeTrade only.
 */
export function stripTradedAssetsFromTradeBlocks(
  tradeBlocks: Record<string, TradeBlock>,
  teamIdA: TeamId,
  teamIdB: TeamId,
  playerIds: readonly PlayerId[],
  pickIds: readonly DraftPickId[],
): Record<string, TradeBlock> {
  const playerSet = new Set(playerIds.map(String));
  const pickSet = new Set(pickIds.map(String));
  const next: Record<string, TradeBlock> = { ...tradeBlocks };

  for (const teamId of [teamIdA, teamIdB]) {
    const block = next[teamId];
    if (block === undefined) {
      continue;
    }
    const assets = block.assets.filter((asset) => {
      if (asset.kind === "player") {
        return !playerSet.has(asset.playerId);
      }
      return !pickSet.has(asset.draftPickId);
    });
    next[teamId] = { teamId, assets };
  }

  return next;
}
