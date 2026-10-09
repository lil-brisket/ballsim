import type { PlayerPosition } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import {
  CPU_TRADE_ACQUIRE_MIN_OVERALL,
  CPU_TRADE_ACQUIRE_TARGET_CAP,
  CPU_TRADE_PACKAGE_MAX_ASSETS,
  CPU_TRADE_PACKAGE_VALUE_RATIO,
  TRADE_FINDER_MAX_CANDIDATES,
  TRADE_OFFER_QUALITY_FLOOR,
  TRADE_ROSTER_RULES,
} from "@/systems/trades-config";
import { calculateTradeNeeds } from "@/systems/trades/trade-needs";
import { getTradeBlock } from "@/systems/trades/trade-block";
import { validateTrade } from "@/systems/trades/trade-validation";
import { evaluateTrade } from "@/systems/trades/asset-valuation/complete-trade-evaluation";
import { evaluateTradeOffer } from "@/systems/trades/trade-evaluation";
import { getTradeDesirability } from "@/systems/trades/asset-valuation/trade-desirability";
import { shouldNotShopPlayer } from "@/systems/trades/asset-valuation/retention-priority";
import { getBaseAssetValue } from "@/systems/trades/asset-valuation/base-asset-value";
import { getTeamAssetValue } from "@/systems/trades/asset-valuation/team-asset-value";
import { findTrades, ownedAvailablePickIds } from "@/systems/trades/trade-finder";
import type { TradeAssetRef } from "@/systems/trades/asset-valuation/types";

export type TradeMotivation =
  | { type: "positional_need"; targetPosition: PlayerPosition }
  | { type: "salary_relief" }
  | { type: "rebuild" }
  | { type: "contender_upgrade" }
  | { type: "asset_accumulation" };

export type CpuTradeCandidate = {
  proposal: TradeProposal;
  counterpartyTeamId: TeamId;
  score: number;
  motivation: TradeMotivation;
  evaluationNet: number;
};

/**
 * Ranked CPU trade candidates using trade needs, desirability, and evaluateTrade.
 * Does not execute. Caller validates + decides.
 */
export function generateCpuTradeCandidates(
  state: GameState,
  fromTeamId: TeamId,
  options: {
    maxCandidates?: number;
    counterpartyFilter?: (id: TeamId) => boolean;
  } = {},
): CpuTradeCandidate[] {
  const max = options.maxCandidates ?? TRADE_FINDER_MAX_CANDIDATES;
  const motivation = deriveMotivation(state, fromTeamId);
  const expendable = listExpendableAssets(state, fromTeamId);
  const packagePool = listPackageAssets(state, fromTeamId);
  const candidates: CpuTradeCandidate[] = [];

  for (const asset of expendable) {
    const found = findTrades(state, {
      direction: "move",
      teamId: fromTeamId,
      asset,
    });
    for (const row of found) {
      maybeRecordCpuCandidate(
        state,
        fromTeamId,
        row.proposal,
        row.counterpartyTeamId,
        motivation,
        options.counterpartyFilter,
        candidates,
      );
    }
  }

  if (motivation.type !== "rebuild" && motivation.type !== "asset_accumulation") {
    for (const target of listAcquireTargets(state, fromTeamId)) {
      const proposal = assembleAcquirePackage(
        state,
        fromTeamId,
        target,
        packagePool,
      );
      if (proposal === null) {
        continue;
      }
      maybeRecordCpuCandidate(
        state,
        fromTeamId,
        proposal,
        proposal.sideB.teamId,
        motivation,
        options.counterpartyFilter,
        candidates,
      );
    }
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.counterpartyTeamId < b.counterpartyTeamId
      ? -1
      : a.counterpartyTeamId > b.counterpartyTeamId
        ? 1
        : 0;
  });

  return candidates.slice(0, max);
}

export function deriveMotivation(
  state: GameState,
  teamId: TeamId,
): TradeMotivation {
  const needs = calculateTradeNeeds(state, teamId);
  const resolved = resolveFranchisePreferences(state, teamId);
  const posture = resolved?.posture ?? "maintaining";
  const topNeed = needs.priorityPositions[0];
  if (topNeed) {
    return { type: "positional_need", targetPosition: topNeed };
  }
  if (posture === "rebuilding" || posture === "developing") {
    return { type: "rebuild" };
  }
  if (posture === "contending" || posture === "all_in") {
    return { type: "contender_upgrade" };
  }
  if ((resolved?.preferences.pickValue ?? 0.5) >= 0.62) {
    return { type: "asset_accumulation" };
  }
  return { type: "salary_relief" };
}

export function motivationDisplayLabel(motivation: TradeMotivation): string {
  switch (motivation.type) {
    case "positional_need":
      return `Looking for help at ${motivation.targetPosition}`;
    case "salary_relief":
      return "Seeking salary flexibility";
    case "rebuild":
      return "Rebuilding — prioritizing future assets";
    case "contender_upgrade":
      return "Looking to upgrade for a playoff push";
    case "asset_accumulation":
      return "Accumulating long-term assets";
  }
}

type AssetRef = TradeAssetRef;

function maybeRecordCpuCandidate(
  state: GameState,
  fromTeamId: TeamId,
  proposal: TradeProposal,
  counterpartyTeamId: TeamId,
  motivation: TradeMotivation,
  counterpartyFilter: ((id: TeamId) => boolean) | undefined,
  candidates: CpuTradeCandidate[],
): void {
  if (counterpartyFilter && !counterpartyFilter(counterpartyTeamId)) {
    return;
  }
  if (!validateTrade(state, proposal).valid) {
    return;
  }
  const evaluation = evaluateTrade(state, fromTeamId, proposal);
  const score =
    evaluation.valueDifference * 1.2 +
    evaluation.rosterFit * 25 +
    evaluation.strategicFit * 20;
  const allowOverpay =
    motivation.type === "contender_upgrade" ||
    motivation.type === "positional_need";
  if (!allowOverpay && evaluation.valueDifference < -40) {
    return;
  }
  if (
    !allowOverpay &&
    score < TRADE_OFFER_QUALITY_FLOOR - 40 &&
    evaluation.valueDifference < 0
  ) {
    return;
  }
  candidates.push({
    proposal,
    counterpartyTeamId,
    score,
    motivation,
    evaluationNet: evaluation.netValue,
  });
}

function listShopablePlayers(state: GameState, teamId: TeamId): AssetRef[] {
  const block = getTradeBlock(state, teamId);
  const fromBlock: AssetRef[] = block.assets.map((asset) =>
    asset.kind === "player"
      ? { kind: "player" as const, playerId: asset.playerId }
      : { kind: "draftPick" as const, draftPickId: asset.draftPickId },
  );

  const team = state.world.teams[teamId];
  if (!team) return fromBlock;

  const needs = calculateTradeNeeds(state, teamId);
  const surplusPositions = new Set(
    needs.byPosition.filter((p) => p.surplus).map((p) => p.position),
  );

  const rosterExtras: AssetRef[] = [];
  for (const playerId of team.roster) {
    if (shouldNotShopPlayer(state, teamId, playerId)) continue;
    if (fromBlock.some((a) => a.kind === "player" && a.playerId === playerId)) {
      continue;
    }
    const player = state.world.players[playerId];
    if (!player || player.retired === true) continue;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    if (overall >= 82 && player.age < 32) continue;
    const des = getTradeDesirability(
      state,
      teamId,
      { kind: "player", playerId },
      "send",
    );
    if (des.score < 45 && !surplusPositions.has(player.position)) {
      continue;
    }
    rosterExtras.push({ kind: "player", playerId });
  }

  const ownedPicks: AssetRef[] = ownedAvailablePickIds(state, teamId).map(
    (draftPickId) => ({ kind: "draftPick" as const, draftPickId }),
  );
  const seen = new Set<string>();
  const merged: AssetRef[] = [];
  for (const asset of [...fromBlock, ...rosterExtras, ...ownedPicks]) {
    const key =
      asset.kind === "player" ? `player:${asset.playerId}` : `pick:${asset.draftPickId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(asset);
  }
  return merged;
}

function listExpendableAssets(state: GameState, teamId: TeamId): AssetRef[] {
  const scored = listShopablePlayers(state, teamId).map((asset) => ({
    asset,
    value: getBaseAssetValue(state, asset).value,
  }));
  scored.sort((a, b) => a.value - b.value);
  return scored.slice(0, 8).map((s) => s.asset);
}

function listPackageAssets(state: GameState, teamId: TeamId): AssetRef[] {
  const team = state.world.teams[teamId];
  const block = getTradeBlock(state, teamId);
  const fromBlock: AssetRef[] = block.assets.map((asset) =>
    asset.kind === "player"
      ? { kind: "player" as const, playerId: asset.playerId }
      : { kind: "draftPick" as const, draftPickId: asset.draftPickId },
  );
  const rosterFillers: AssetRef[] = [];
  if (team) {
    for (const playerId of team.roster) {
      if (shouldNotShopPlayer(state, teamId, playerId)) continue;
      const player = state.world.players[playerId];
      if (!player || player.retired === true) continue;
      const overall = calculatePlayerOverall(player.position, player.attributes);
      if (overall >= 82 && player.age < 32) continue;
      rosterFillers.push({ kind: "player", playerId });
    }
  }
  const ownedPicks: AssetRef[] = ownedAvailablePickIds(state, teamId).map(
    (draftPickId) => ({ kind: "draftPick" as const, draftPickId }),
  );
  const seen = new Set<string>();
  const merged: AssetRef[] = [];
  for (const asset of [...fromBlock, ...rosterFillers, ...ownedPicks]) {
    const key =
      asset.kind === "player"
        ? `player:${asset.playerId}`
        : `pick:${asset.draftPickId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(asset);
  }
  const scored = merged.map((asset) => ({
    asset,
    value: getBaseAssetValue(state, asset).value,
  }));
  scored.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    const keyA =
      a.asset.kind === "player" ? a.asset.playerId : a.asset.draftPickId;
    const keyB =
      b.asset.kind === "player" ? b.asset.playerId : b.asset.draftPickId;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
  return scored.map((s) => s.asset);
}

function listAcquireTargets(state: GameState, fromTeamId: TeamId): AssetRef[] {
  const scored: { asset: AssetRef; overall: number; playerId: PlayerId }[] = [];
  const otherTeamIds = (Object.keys(state.world.teams) as TeamId[])
    .filter((id) => id !== fromTeamId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const teamId of otherTeamIds) {
    const team = state.world.teams[teamId];
    if (!team) continue;
    for (const playerId of team.roster) {
      const player = state.world.players[playerId];
      if (!player || player.retired === true || player.teamId !== teamId) {
        continue;
      }
      const overall = calculatePlayerOverall(player.position, player.attributes);
      if (overall < CPU_TRADE_ACQUIRE_MIN_OVERALL) continue;
      scored.push({
        asset: { kind: "player", playerId },
        overall,
        playerId,
      });
    }
  }
  scored.sort((a, b) => {
    if (b.overall !== a.overall) return b.overall - a.overall;
    return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
  });
  return scored.slice(0, CPU_TRADE_ACQUIRE_TARGET_CAP).map((s) => s.asset);
}

function assembleAcquirePackage(
  state: GameState,
  fromTeamId: TeamId,
  target: AssetRef,
  packagePool: readonly AssetRef[],
): TradeProposal | null {
  if (target.kind !== "player") {
    return null;
  }
  const ownerTeamId = state.world.players[target.playerId]?.teamId;
  if (ownerTeamId == null || ownerTeamId === fromTeamId) {
    return null;
  }
  const needed =
    getTeamAssetValue(state, ownerTeamId, target).value *
    CPU_TRADE_PACKAGE_VALUE_RATIO;
  const fromRosterSize = state.world.teams[fromTeamId]?.roster.length ?? 0;
  const minRoster = TRADE_ROSTER_RULES.minRosterSize ?? 8;
  const incomingPlayers = 1;
  const maxOutgoingPlayers = Math.max(
    0,
    fromRosterSize - minRoster + incomingPlayers,
  );
  const pickFirst = [
    ...packagePool.filter((asset) => asset.kind === "draftPick"),
    ...packagePool.filter((asset) => asset.kind === "player"),
  ];
  const chosen: AssetRef[] = [];
  let sum = 0;
  let outgoingPlayers = 0;
  for (const asset of pickFirst) {
    if (asset.kind === "player" && asset.playerId === target.playerId) {
      continue;
    }
    if (chosen.length >= CPU_TRADE_PACKAGE_MAX_ASSETS) {
      break;
    }
    if (asset.kind === "player") {
      if (outgoingPlayers >= maxOutgoingPlayers) {
        continue;
      }
      outgoingPlayers += 1;
    }
    chosen.push(asset);
    sum += getTeamAssetValue(state, ownerTeamId, asset).value;
    if (sum >= needed) {
      break;
    }
  }
  if (chosen.length === 0 || sum < needed) {
    return null;
  }
  return {
    sideA: {
      teamId: fromTeamId,
      playerIds: chosen
        .filter(
          (asset): asset is { kind: "player"; playerId: PlayerId } =>
            asset.kind === "player",
        )
        .map((asset) => asset.playerId),
      draftPickIds: chosen
        .filter(
          (asset): asset is { kind: "draftPick"; draftPickId: DraftPickId } =>
            asset.kind === "draftPick",
        )
        .map((asset) => asset.draftPickId),
    },
    sideB: {
      teamId: ownerTeamId,
      playerIds: [target.playerId],
      draftPickIds: [],
    },
  };
}

/**
 * Sweetens the CPU side of a user counter until the CPU would accept,
 * or until the package cap. Keeps the user's new outgoing set.
 */
export function rebalanceCpuCounterProposal(
  state: GameState,
  cpuTeamId: TeamId,
  userTeamId: TeamId,
  cpuOutgoing: { playerIds: readonly PlayerId[]; draftPickIds: readonly DraftPickId[] },
  userOutgoing: { playerIds: readonly PlayerId[]; draftPickIds: readonly DraftPickId[] },
): TradeProposal | null {
  const cpuPlayers = [...cpuOutgoing.playerIds];
  const cpuPicks = [...cpuOutgoing.draftPickIds];
  const used = new Set<string>([
    ...cpuPlayers,
    ...cpuPicks,
    ...userOutgoing.playerIds,
    ...userOutgoing.draftPickIds,
  ]);

  const build = (): TradeProposal => ({
    sideA: {
      teamId: cpuTeamId,
      playerIds: [...cpuPlayers],
      draftPickIds: [...cpuPicks],
    },
    sideB: {
      teamId: userTeamId,
      playerIds: [...userOutgoing.playerIds],
      draftPickIds: [...userOutgoing.draftPickIds],
    },
  });

  let proposal = build();
  if (!validateTrade(state, proposal).valid) {
    return null;
  }
  if (evaluateTradeOffer(state, cpuTeamId, proposal).accepted) {
    return proposal;
  }

  const pool = listPackageAssets(state, cpuTeamId).filter((asset) => {
    const id =
      asset.kind === "player" ? asset.playerId : asset.draftPickId;
    return !used.has(id);
  });
  const pickFirst = [
    ...pool.filter((asset) => asset.kind === "draftPick"),
    ...pool.filter((asset) => asset.kind === "player"),
  ];

  for (const asset of pickFirst) {
    if (cpuPlayers.length + cpuPicks.length >= CPU_TRADE_PACKAGE_MAX_ASSETS) {
      break;
    }
    if (asset.kind === "player") {
      cpuPlayers.push(asset.playerId);
    } else {
      cpuPicks.push(asset.draftPickId);
    }
    proposal = build();
    if (!validateTrade(state, proposal).valid) {
      if (asset.kind === "player") {
        cpuPlayers.pop();
      } else {
        cpuPicks.pop();
      }
      continue;
    }
    if (evaluateTradeOffer(state, cpuTeamId, proposal).accepted) {
      return proposal;
    }
  }

  proposal = build();
  return validateTrade(state, proposal).valid ? proposal : null;
}
