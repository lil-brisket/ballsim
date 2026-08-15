import type { TradeBlockAsset } from "@/domain/entities/trade-block";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { TRADE_FINDER_MAX_CANDIDATES } from "@/systems/trades-config";
import { getTradeBlock, type TradeBlockAssetRef } from "@/systems/trades/trade-block";
import { validateTrade } from "@/systems/trades/trade-validation";

export type TradeFinderAsset =
  | { kind: "player"; playerId: PlayerId }
  | { kind: "draftPick"; draftPickId: DraftPickId };

export type FindTradesInput =
  | {
      direction: "move";
      teamId: TeamId;
      asset: TradeFinderAsset;
    }
  | {
      direction: "acquire";
      teamId: TeamId;
      asset: TradeFinderAsset;
    };

export type TradeFinderCandidate = {
  proposal: TradeProposal;
  counterpartyTeamId: TeamId;
};

/**
 * Candidate-generation only. Calls validateTrade; never executeTrade.
 * Returns legally valid candidates regardless of AI acceptance.
 *
 * v1 boundary:
 * - one outgoing asset (search target)
 * - one incoming trade-block asset
 * - optionally one additional incoming pick (player+pick packages)
 * - deterministic order; max TRADE_FINDER_MAX_CANDIDATES
 */
export function findTrades(
  state: GameState,
  input: FindTradesInput,
): TradeFinderCandidate[] {
  const candidates: TradeFinderCandidate[] = [];

  if (input.direction === "move") {
    collectMoveCandidates(state, input.teamId, input.asset, candidates);
  } else {
    collectAcquireCandidates(state, input.teamId, input.asset, candidates);
  }

  return candidates.slice(0, TRADE_FINDER_MAX_CANDIDATES);
}

function collectMoveCandidates(
  state: GameState,
  teamId: TeamId,
  outgoing: TradeFinderAsset,
  candidates: TradeFinderCandidate[],
): void {
  const counterparties = sortedOtherTeamIds(state, teamId);
  for (const otherTeamId of counterparties) {
    if (candidates.length >= TRADE_FINDER_MAX_CANDIDATES) {
      return;
    }
    const block = getTradeBlock(state, otherTeamId);
    const assets = sortBlockAssets(block.assets);

    // 1-for-1
    for (const incoming of assets) {
      if (candidates.length >= TRADE_FINDER_MAX_CANDIDATES) {
        return;
      }
      const proposal = buildProposal(teamId, outgoing, otherTeamId, [
        toFinderAsset(incoming),
      ]);
      maybePush(state, candidates, proposal, otherTeamId);
    }

    // player-for-player + optional extra pick packages
    for (const incoming of assets) {
      if (incoming.kind !== "player") {
        continue;
      }
      for (const extraPick of assets) {
        if (extraPick.kind !== "draftPick") {
          continue;
        }
        if (candidates.length >= TRADE_FINDER_MAX_CANDIDATES) {
          return;
        }
        const proposal = buildProposal(teamId, outgoing, otherTeamId, [
          toFinderAsset(incoming),
          toFinderAsset(extraPick),
        ]);
        maybePush(state, candidates, proposal, otherTeamId);
      }
    }
  }
}

function collectAcquireCandidates(
  state: GameState,
  teamId: TeamId,
  target: TradeFinderAsset,
  candidates: TradeFinderCandidate[],
): void {
  const ownerTeamId = findAssetOwner(state, target);
  if (ownerTeamId === undefined || ownerTeamId === teamId) {
    return;
  }

  const ownerBlock = getTradeBlock(state, ownerTeamId);
  const targetOnBlock = ownerBlock.assets.some((asset) =>
    assetsEqual(toFinderAsset(asset), target),
  );
  if (!targetOnBlock) {
    return;
  }

  const ourBlock = getTradeBlock(state, teamId);
  const ourAssets = sortBlockAssets(ourBlock.assets);

  for (const outgoing of ourAssets) {
    if (candidates.length >= TRADE_FINDER_MAX_CANDIDATES) {
      return;
    }
    const proposal = buildProposal(
      teamId,
      toFinderAsset(outgoing),
      ownerTeamId,
      [target],
    );
    maybePush(state, candidates, proposal, ownerTeamId);
  }

  for (const outgoing of ourAssets) {
    if (outgoing.kind !== "player") {
      continue;
    }
    for (const extraPick of ourAssets) {
      if (extraPick.kind !== "draftPick") {
        continue;
      }
      if (candidates.length >= TRADE_FINDER_MAX_CANDIDATES) {
        return;
      }
      // We send player+pick for the target
      const proposal: TradeProposal = {
        sideA: {
          teamId,
          playerIds: [outgoing.playerId],
          draftPickIds: [extraPick.draftPickId],
        },
        sideB: {
          teamId: ownerTeamId,
          playerIds: target.kind === "player" ? [target.playerId] : [],
          draftPickIds: target.kind === "draftPick" ? [target.draftPickId] : [],
        },
      };
      maybePush(state, candidates, proposal, ownerTeamId);
    }
  }
}

function buildProposal(
  sideATeamId: TeamId,
  sideAAsset: TradeFinderAsset,
  sideBTeamId: TeamId,
  sideBAssets: TradeFinderAsset[],
): TradeProposal {
  return {
    sideA: {
      teamId: sideATeamId,
      playerIds:
        sideAAsset.kind === "player" ? [sideAAsset.playerId] : [],
      draftPickIds:
        sideAAsset.kind === "draftPick" ? [sideAAsset.draftPickId] : [],
    },
    sideB: {
      teamId: sideBTeamId,
      playerIds: sideBAssets
        .filter((a): a is { kind: "player"; playerId: PlayerId } => a.kind === "player")
        .map((a) => a.playerId),
      draftPickIds: sideBAssets
        .filter(
          (a): a is { kind: "draftPick"; draftPickId: DraftPickId } =>
            a.kind === "draftPick",
        )
        .map((a) => a.draftPickId),
    },
  };
}

function maybePush(
  state: GameState,
  candidates: TradeFinderCandidate[],
  proposal: TradeProposal,
  counterpartyTeamId: TeamId,
): void {
  const validation = validateTrade(state, proposal);
  if (validation.valid) {
    candidates.push({ proposal, counterpartyTeamId });
  }
}

function sortedOtherTeamIds(state: GameState, teamId: TeamId): TeamId[] {
  return (Object.keys(state.world.teams) as TeamId[])
    .filter((id) => id !== teamId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function sortBlockAssets(assets: readonly TradeBlockAsset[]): TradeBlockAsset[] {
  return [...assets].sort((a, b) => {
    const keyA = assetSortKey(a);
    const keyB = assetSortKey(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
}

function assetSortKey(asset: TradeBlockAsset): string {
  return asset.kind === "player"
    ? `player:${asset.playerId}`
    : `pick:${asset.draftPickId}`;
}

function toFinderAsset(asset: TradeBlockAsset): TradeFinderAsset {
  if (asset.kind === "player") {
    return { kind: "player", playerId: asset.playerId };
  }
  return { kind: "draftPick", draftPickId: asset.draftPickId };
}

function assetsEqual(a: TradeFinderAsset, b: TradeFinderAsset): boolean {
  if (a.kind === "player" && b.kind === "player") {
    return a.playerId === b.playerId;
  }
  if (a.kind === "draftPick" && b.kind === "draftPick") {
    return a.draftPickId === b.draftPickId;
  }
  return false;
}

function findAssetOwner(
  state: GameState,
  asset: TradeFinderAsset,
): TeamId | undefined {
  if (asset.kind === "player") {
    const player = state.world.players[asset.playerId];
    return player?.teamId ?? undefined;
  }
  const pick = state.world.draftPicks[asset.draftPickId];
  return pick?.ownerTeamId;
}

export type { TradeBlockAssetRef };
