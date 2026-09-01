import type { PlayerPosition } from "@/domain/entities/player";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import {
  TRADE_FINDER_MAX_CANDIDATES,
  TRADE_OFFER_QUALITY_FLOOR,
} from "@/systems/trades-config";
import { calculateTradeNeeds } from "@/systems/trades/trade-needs";
import { getTradeBlock } from "@/systems/trades/trade-block";
import { validateTrade } from "@/systems/trades/trade-validation";
import { evaluateTrade } from "@/systems/trades/asset-valuation/complete-trade-evaluation";
import { getTradeDesirability } from "@/systems/trades/asset-valuation/trade-desirability";
import { shouldNotShopPlayer } from "@/systems/trades/asset-valuation/retention-priority";
import { getBaseAssetValue } from "@/systems/trades/asset-valuation/base-asset-value";
import { findTrades } from "@/systems/trades/trade-finder";

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
  options: { maxCandidates?: number; counterpartyFilter?: (id: TeamId) => boolean } = {},
): CpuTradeCandidate[] {
  const max = options.maxCandidates ?? TRADE_FINDER_MAX_CANDIDATES;
  const motivation = deriveMotivation(state, fromTeamId);
  const expendable = listExpendableAssets(state, fromTeamId);
  const candidates: CpuTradeCandidate[] = [];

  for (const asset of expendable) {
    const found = findTrades(state, {
      direction: "move",
      teamId: fromTeamId,
      asset,
    });
    for (const row of found) {
      if (
        options.counterpartyFilter &&
        !options.counterpartyFilter(row.counterpartyTeamId)
      ) {
        continue;
      }
      if (!validateTrade(state, row.proposal).valid) {
        continue;
      }
      const evaluation = evaluateTrade(state, fromTeamId, row.proposal);
      const score =
        evaluation.valueDifference * 1.2 +
        evaluation.rosterFit * 25 +
        evaluation.strategicFit * 20;
      if (score < TRADE_OFFER_QUALITY_FLOOR - 40 && evaluation.valueDifference < 0) {
        continue;
      }
      candidates.push({
        proposal: row.proposal,
        counterpartyTeamId: row.counterpartyTeamId,
        score,
        motivation,
        evaluationNet: evaluation.netValue,
      });
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

type AssetRef =
  | { kind: "player"; playerId: PlayerId }
  | { kind: "draftPick"; draftPickId: DraftPickId };

function listExpendableAssets(state: GameState, teamId: TeamId): AssetRef[] {
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
    if (!player) continue;
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

  const scored = [...fromBlock, ...rosterExtras].map((asset) => ({
    asset,
    value: getBaseAssetValue(state, asset).value,
  }));
  scored.sort((a, b) => a.value - b.value);
  return scored.slice(0, 8).map((s) => s.asset);
}
