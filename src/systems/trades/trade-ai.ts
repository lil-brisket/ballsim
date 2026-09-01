import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { generateCpuTradeCandidates } from "@/systems/trades/cpu-trade-generator";
import { validateTrade } from "@/systems/trades/trade-validation";

/**
 * Builds a TradeProposal for the from-team using ranked CPU candidates.
 * Returns undefined when no valid pairing exists.
 * Caller must still run evaluateTradeOffer / executeTrade.
 */
export function generateAiTradeProposal(
  state: GameState,
  fromTeamId: TeamId,
): TradeProposal | undefined {
  const candidates = generateCpuTradeCandidates(state, fromTeamId, {
    maxCandidates: 20,
  });
  for (const candidate of candidates) {
    if (validateTrade(state, candidate.proposal).valid) {
      return candidate.proposal;
    }
  }
  return undefined;
}
