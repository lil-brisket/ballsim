import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import type { TradeOfferEvaluation } from "@/systems/trades/trade-evaluation";
import {
  USER_TRADE_INTERRUPT_MIN_ABS_NET,
  USER_TRADE_INTERRUPT_MIN_INCOMING_VALUE,
  USER_TRADE_INTERRUPT_MIN_PLAYER_OVERALL,
} from "@/systems/owner-decisions/owner-decision-config";

/**
 * Whether a CPU-accepted trade is meaningful enough to pause the owner's simulation.
 * Uses objective asset quality — not the user's organizational preferences.
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

  for (const playerId of incoming.playerIds) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    const overall = calculatePlayerOverall(player.position, player.attributes);
    incomingObjective += overall;
    if (overall >= USER_TRADE_INTERRUPT_MIN_PLAYER_OVERALL) {
      hasMeaningfulPlayer = true;
    }
  }

  for (const pickId of incoming.pickIds) {
    const pick = state.world.draftPicks[pickId];
    if (!pick) {
      continue;
    }
    if (pick.round === 1 || pick.round === 2) {
      hasMeaningfulPick = true;
      incomingObjective += pick.round === 1 ? 80 : 50;
    }
  }

  const objectiveNet = Math.abs(cpuEvaluation.objectiveNetValue ?? cpuEvaluation.netValue);

  if (hasMeaningfulPick) {
    return true;
  }
  if (
    hasMeaningfulPlayer &&
    incomingObjective >= USER_TRADE_INTERRUPT_MIN_INCOMING_VALUE
  ) {
    return true;
  }
  if (objectiveNet >= USER_TRADE_INTERRUPT_MIN_ABS_NET && incomingObjective >= 55) {
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
