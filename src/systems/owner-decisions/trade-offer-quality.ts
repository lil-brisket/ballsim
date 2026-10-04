import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import type { TradeOfferEvaluation } from "@/systems/trades/trade-evaluation";
import { getBaseAssetValue } from "@/systems/trades/asset-valuation/base-asset-value";
import { TRADE_OFFER_QUALITY_FLOOR } from "@/systems/trades-config";
import {
  USER_TRADE_INTERRUPT_MIN_ABS_NET,
  USER_TRADE_INTERRUPT_MIN_INCOMING_VALUE,
  USER_TRADE_INTERRUPT_MIN_PLAYER_OVERALL,
} from "@/systems/owner-decisions/owner-decision-config";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { projectDraftPick } from "@/systems/trades/asset-valuation/pick-projection";

/**
 * Whether a CPU-accepted trade is meaningful enough to pause simulation.
 * Uses centralized base asset values — not duplicated 80/50 pick constants.
 */
export function isInterruptWorthyTradeOffer(
  state: GameState,
  userTeamId: TeamId,
  proposal: TradeProposal,
  cpuEvaluation: TradeOfferEvaluation,
): boolean {
  if (!cpuEvaluation.accepted) {
    return false;
  }

  const incoming = assetsIncomingToTeam(userTeamId, proposal);
  let incomingObjective = 0;
  let hasMeaningfulPlayer = false;
  let hasMeaningfulPick = false;
  let bestPlayerOverall = 0;

  for (const playerId of incoming.playerIds) {
    const player = state.world.players[playerId];
    if (!player) continue;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    bestPlayerOverall = Math.max(bestPlayerOverall, overall);
    incomingObjective += getBaseAssetValue(state, {
      kind: "player",
      playerId,
    }).value;
    if (overall >= USER_TRADE_INTERRUPT_MIN_PLAYER_OVERALL) {
      hasMeaningfulPlayer = true;
    }
  }

  for (const pickId of incoming.pickIds) {
    const pick = state.world.draftPicks[pickId];
    const value = getBaseAssetValue(state, {
      kind: "draftPick",
      draftPickId: pickId,
    }).value;
    if (pick) {
      const projection = projectDraftPick(state, pick);
      const lottery =
        projection.tier === "strong_lottery" ||
        projection.tier === "likely_lottery";
      if (lottery) {
        hasMeaningfulPick = true;
      }
    }
    if (value > 0) {
      incomingObjective += value;
    }
  }

  const objectiveNet = Math.abs(
    cpuEvaluation.objectiveNetValue ?? cpuEvaluation.netValue,
  );

  const offerScore = Math.max(
    incomingObjective,
    bestPlayerOverall,
    Math.abs(cpuEvaluation.netValue) + 40,
  );

  if (offerScore < TRADE_OFFER_QUALITY_FLOOR && !hasMeaningfulPick) {
    return false;
  }

  if (hasMeaningfulPick) {
    return true;
  }
  if (hasMeaningfulPlayer) {
    return true;
  }
  if (
    incomingObjective >= USER_TRADE_INTERRUPT_MIN_INCOMING_VALUE &&
    objectiveNet >= USER_TRADE_INTERRUPT_MIN_ABS_NET * 2
  ) {
    return true;
  }
  return false;
}

function assetsIncomingToTeam(
  teamId: TeamId,
  proposal: TradeProposal,
): { playerIds: PlayerId[]; pickIds: DraftPickId[] } {
  if (proposal.sideA.teamId === teamId) {
    return {
      playerIds: proposal.sideB.playerIds,
      pickIds: proposal.sideB.draftPickIds,
    };
  }
  if (proposal.sideB.teamId === teamId) {
    return {
      playerIds: proposal.sideA.playerIds,
      pickIds: proposal.sideA.draftPickIds,
    };
  }
  throw new Error(`Team "${teamId}" is not a party to the proposal.`);
}
