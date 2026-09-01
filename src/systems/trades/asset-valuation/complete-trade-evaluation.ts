import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { TRADE_BLOCK_VALUE_BONUS } from "@/systems/trades-config";
import { getTradeBlock } from "@/systems/trades/trade-block";
import { getTeamAssetValue } from "@/systems/trades/asset-valuation/team-asset-value";
import { getTradeDesirability } from "@/systems/trades/asset-valuation/trade-desirability";
import { getBaseAssetValue } from "@/systems/trades/asset-valuation/base-asset-value";
import type { TradeAssetRef } from "@/systems/trades/asset-valuation/types";
import { getTeamCapSpace } from "@/systems/salary-cap";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import { calculateTradeNeeds, tradeNeedLevelScore } from "@/systems/trades/trade-needs";

/**
 * Deterministic complete trade evaluation. No RNG. Does not return accepted.
 */
export type TradeEvaluation = {
  receivedValue: number;
  sentValue: number;
  valueDifference: number;
  /** 0–1 */
  rosterFit: number;
  /** 0–1 */
  financialImpact: number;
  /** 0–1 */
  strategicFit: number;
  recommendation: "favor_receive" | "favor_send" | "even";
  confidence: number;
  reasons: string[];
  /** Legacy-compatible fields for evaluateTradeOffer wrapper. */
  netValue: number;
  incomingValue: number;
  outgoingValue: number;
  tradeBlockBonus: number;
  objectiveNetValue: number;
};

export function evaluateTrade(
  state: GameState,
  evaluatingTeamId: TeamId,
  proposal: TradeProposal,
): TradeEvaluation {
  const { incomingPlayerIds, outgoingPlayerIds, incomingPickIds, outgoingPickIds } =
    assetsFromPerspective(evaluatingTeamId, proposal);

  const reasons: string[] = [];
  let incomingValue = 0;
  let outgoingValue = 0;
  let objectiveIncoming = 0;
  let objectiveOutgoing = 0;

  for (const playerId of incomingPlayerIds) {
    const asset: TradeAssetRef = { kind: "player", playerId };
    incomingValue += getTeamAssetValue(state, evaluatingTeamId, asset).value;
    objectiveIncoming += getBaseAssetValue(state, asset).value;
    const des = getTradeDesirability(state, evaluatingTeamId, asset, "receive");
    reasons.push(...des.reasons.slice(0, 1));
  }
  for (const pickId of incomingPickIds) {
    const asset: TradeAssetRef = { kind: "draftPick", draftPickId: pickId };
    incomingValue += getTeamAssetValue(state, evaluatingTeamId, asset).value;
    objectiveIncoming += getBaseAssetValue(state, asset).value;
    reasons.push(...getBaseAssetValue(state, asset).reasons.slice(0, 1));
  }
  for (const playerId of outgoingPlayerIds) {
    const asset: TradeAssetRef = { kind: "player", playerId };
    outgoingValue += getTeamAssetValue(state, evaluatingTeamId, asset).value;
    objectiveOutgoing += getBaseAssetValue(state, asset).value;
  }
  for (const pickId of outgoingPickIds) {
    const asset: TradeAssetRef = { kind: "draftPick", draftPickId: pickId };
    outgoingValue += getTeamAssetValue(state, evaluatingTeamId, asset).value;
    objectiveOutgoing += getBaseAssetValue(state, asset).value;
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

  const receivedValue = incomingValue + tradeBlockBonus;
  const sentValue = outgoingValue;
  const valueDifference = receivedValue - sentValue;
  const netValue = valueDifference;
  const objectiveNetValue =
    objectiveIncoming + tradeBlockBonus - objectiveOutgoing;

  const rosterFit = computeRosterFit(
    state,
    evaluatingTeamId,
    incomingPlayerIds,
    outgoingPlayerIds,
  );
  const financialImpact = computeFinancialImpact(
    state,
    evaluatingTeamId,
    incomingPlayerIds,
    outgoingPlayerIds,
  );
  const strategicFit = clamp01(0.5 + valueDifference / 80);

  let recommendation: TradeEvaluation["recommendation"] = "even";
  if (valueDifference >= 8) recommendation = "favor_receive";
  else if (valueDifference <= -8) recommendation = "favor_send";

  if (recommendation === "favor_receive") {
    reasons.unshift("Trade favors this team on asset value");
  } else if (recommendation === "favor_send") {
    reasons.unshift("Trade favors the other side on asset value");
  } else {
    reasons.unshift("Trade is roughly even");
  }

  const confidence = clamp01(
    0.55 + Math.min(0.35, Math.abs(valueDifference) / 60),
  );

  return {
    receivedValue,
    sentValue,
    valueDifference,
    rosterFit,
    financialImpact,
    strategicFit,
    recommendation,
    confidence,
    reasons: uniqueReasons(reasons).slice(0, 8),
    netValue,
    incomingValue: receivedValue,
    outgoingValue: sentValue,
    tradeBlockBonus,
    objectiveNetValue,
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

function computeRosterFit(
  state: GameState,
  teamId: TeamId,
  incoming: PlayerId[],
  outgoing: PlayerId[],
): number {
  const needs = calculateTradeNeeds(state, teamId);
  let score = 0.5;
  for (const playerId of incoming) {
    const player = state.world.players[playerId];
    if (!player) continue;
    const pos = needs.byPosition.find((p) => p.position === player.position);
    if (pos) {
      score += tradeNeedLevelScore(pos.level) * 0.06;
      if (pos.surplus) score -= 0.08;
    }
  }
  for (const playerId of outgoing) {
    const player = state.world.players[playerId];
    if (!player) continue;
    const pos = needs.byPosition.find((p) => p.position === player.position);
    if (pos?.surplus) score += 0.05;
    else if (pos && tradeNeedLevelScore(pos.level) >= 3) score -= 0.1;
  }
  return clamp01(score);
}

function computeFinancialImpact(
  state: GameState,
  teamId: TeamId,
  incoming: PlayerId[],
  outgoing: PlayerId[],
): number {
  const year = state.competition.season.year;
  let delta = 0;
  for (const playerId of incoming) {
    const player = state.world.players[playerId];
    if (!player?.contractId) continue;
    const contract = state.business.contracts[player.contractId];
    if (!contract) continue;
    delta += getContractSalaryForYear(contract, year) ?? 0;
  }
  for (const playerId of outgoing) {
    const player = state.world.players[playerId];
    if (!player?.contractId) continue;
    const contract = state.business.contracts[player.contractId];
    if (!contract) continue;
    delta -= getContractSalaryForYear(contract, year) ?? 0;
  }
  const capSpace = getTeamCapSpace(teamId, year, state);
  if (delta <= 0) return 0.75;
  if (capSpace - delta >= 0) return 0.6;
  if (capSpace >= 0) return 0.35;
  return 0.2;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function uniqueReasons(reasons: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const reason of reasons) {
    if (!reason || seen.has(reason)) continue;
    seen.add(reason);
    out.push(reason);
  }
  return out;
}
