import type { GameState } from "@/state/game-state";
import { canTradeDraftPick } from "@/systems/league-rules/draft-rules";
import {
  checkContractExtensionWindow,
  checkPlayerReleaseWindow,
} from "@/systems/league-rules/contract-rules";
import { checkFreeAgencySigning } from "@/systems/league-rules/free-agency-rules";
import {
  canActivateDraft,
  isDraftCompleteForYear,
} from "@/systems/league-rules/draft-rules";
import {
  canAdvanceFromPhase,
  canBeginPlayoffs,
  canBeginRegularSeason,
  canEnterPhase,
} from "@/systems/league-rules/phase-prerequisites";
import { readActivePhaseId } from "@/systems/league-rules/phase-ids";
import {
  checkDeclineMatch,
  checkIssueQualifyingOffer,
  checkMatchRfaOffer,
  checkSubmitRfaOfferSheet,
} from "@/systems/league-rules/rfa-rules";
import { checkRetiredPlayerBlocked } from "@/systems/league-rules/retirement-rules";
import { checkTradeWindow } from "@/systems/league-rules/trade-rules";
import type {
  LeagueAction,
  RuleCheckResult,
  RuleViolation,
} from "@/systems/league-rules/types";

export function canPerformAction(
  state: GameState,
  action: LeagueAction,
): RuleCheckResult {
  const violations: RuleViolation[] = [];

  switch (action.kind) {
    case "trade":
    case "player_trade":
    case "pick_trade": {
      const window = checkTradeWindow(state);
      violations.push(...window.violations);
      for (const playerId of [
        ...action.proposal.sideA.playerIds,
        ...action.proposal.sideB.playerIds,
      ]) {
        violations.push(
          ...checkRetiredPlayerBlocked(state, playerId, "trade"),
        );
      }
      for (const pickId of [
        ...action.proposal.sideA.draftPickIds,
        ...action.proposal.sideB.draftPickIds,
      ]) {
        const pickCheck = canTradeDraftPick(state, pickId);
        violations.push(...pickCheck.violations);
      }
      break;
    }
    case "sign_free_agent":
    case "make_free_agent_offer": {
      violations.push(
        ...checkFreeAgencySigning(state, action.playerId).violations,
      );
      break;
    }
    case "submit_rfa_offer_sheet": {
      violations.push(
        ...checkRetiredPlayerBlocked(
          state,
          action.playerId,
          "submit_rfa_offer_sheet",
        ),
      );
      violations.push(
        ...checkSubmitRfaOfferSheet(
          state,
          action.playerId,
          action.offeringTeamId,
        ).violations,
      );
      break;
    }
    case "issue_rfa_qualifying_offer": {
      violations.push(
        ...checkIssueQualifyingOffer(
          state,
          action.playerId,
          action.teamId,
        ).violations,
      );
      break;
    }
    case "match_rfa_offer": {
      violations.push(
        ...checkMatchRfaOffer(state, action.playerId, action.teamId)
          .violations,
      );
      break;
    }
    case "decline_rfa_match": {
      violations.push(
        ...checkDeclineMatch(state, action.playerId, action.teamId).violations,
      );
      break;
    }
    case "contract_extension": {
      violations.push(
        ...checkRetiredPlayerBlocked(
          state,
          action.playerId,
          "contract_extension",
        ),
      );
      violations.push(
        ...checkContractExtensionWindow(
          state,
          action.playerId,
          action.teamId,
        ).violations,
      );
      break;
    }
    case "player_release": {
      violations.push(
        ...checkRetiredPlayerBlocked(state, action.playerId, "player_release"),
      );
      violations.push(...checkPlayerReleaseWindow(state).violations);
      break;
    }
    case "draft_selection": {
      if (readActivePhaseId(state) !== "offseason.draft") {
        violations.push({
          code: "DRAFT_WRONG_PHASE",
          message: "Draft selections are only allowed during the draft phase.",
          tier: "phase_lock",
          action: "draft_selection",
        });
      }
      break;
    }
    case "activate_draft": {
      violations.push(...canActivateDraft(state).violations);
      break;
    }
    case "advance_phase": {
      const from = readActivePhaseId(state);
      violations.push(...canAdvanceFromPhase(state, from).violations);
      violations.push(...canEnterPhase(state, action.toPhaseId).violations);
      break;
    }
    case "begin_regular_season": {
      violations.push(...canBeginRegularSeason(state).violations);
      break;
    }
    case "begin_playoffs": {
      violations.push(...canBeginPlayoffs(state).violations);
      break;
    }
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
}

export function getActionBlockReason(
  state: GameState,
  action: LeagueAction,
): string | null {
  const result = canPerformAction(state, action);
  return result.violations[0]?.message ?? null;
}

export function assertActionAllowed(
  state: GameState,
  action: LeagueAction,
): void {
  const result = canPerformAction(state, action);
  if (!result.allowed) {
    throw new Error(
      result.violations[0]?.message ?? "Action is not allowed by league rules.",
    );
  }
}

// Re-export helper used by tests
export { isDraftCompleteForYear };
