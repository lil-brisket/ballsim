import { isContractActive } from "@/domain/entities/contract";
import type { Player } from "@/domain/entities/player";
import type { Team } from "@/domain/entities/team";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import type { TradeValidationIssue } from "@/systems/trades/trade-types";

export type TradeEligibilityContext = {
  state: GameState;
  player: Player;
  offeringTeam: Team;
  seasonYear: number;
};

export type TradeEligibilityRule = (
  context: TradeEligibilityContext,
) => TradeValidationIssue | null;

/**
 * v1 eligibility: player must have an active contract consistent with the
 * offering team. Additional rules can be appended without changing TradeProposal.
 */
export const defaultTradeEligibilityRules: TradeEligibilityRule[] = [
  (context) => {
    if (context.player.contractId === null) {
      return {
        code: "PLAYER_INELIGIBLE",
        message: `Player "${context.player.id}" has no contract and cannot be traded.`,
      };
    }
    const contract = context.state.business.contracts[context.player.contractId];
    if (contract === undefined) {
      return {
        code: "PLAYER_INELIGIBLE",
        message: `Player "${context.player.id}" contract "${context.player.contractId}" is missing.`,
      };
    }
    if (!isContractActive(contract, context.seasonYear)) {
      return {
        code: "PLAYER_INELIGIBLE",
        message: `Player "${context.player.id}" does not have an active contract.`,
      };
    }
    if (contract.teamId !== context.offeringTeam.id) {
      return {
        code: "PLAYER_INELIGIBLE",
        message: `Player "${context.player.id}" contract team does not match offering team.`,
      };
    }
    if (context.player.teamId !== context.offeringTeam.id) {
      return {
        code: "PLAYER_INELIGIBLE",
        message: `Player "${context.player.id}" teamId does not match offering team.`,
      };
    }
    if (!context.offeringTeam.roster.includes(context.player.id as PlayerId)) {
      return {
        code: "PLAYER_INELIGIBLE",
        message: `Player "${context.player.id}" is not on offering team roster.`,
      };
    }
    return null;
  },
];

export function checkPlayerTradeEligibility(
  context: TradeEligibilityContext,
  rules: TradeEligibilityRule[] = defaultTradeEligibilityRules,
): TradeValidationIssue[] {
  const issues: TradeValidationIssue[] = [];
  for (const rule of rules) {
    const issue = rule(context);
    if (issue !== null) {
      issues.push(issue);
    }
  }
  return issues;
}
