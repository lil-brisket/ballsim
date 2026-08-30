import type { ContractInput } from "@/domain/entities/contract";
import type {
  DraftPickId,
  PlayerId,
  TeamId,
} from "@/domain/ids";
import type { LeaguePhaseId } from "@/systems/phase-engine/phase-types";
import type { TradeProposal } from "@/domain/entities/trade-proposal";

/** Three rule tiers — see HARD_LOCKS.md. */
export type RuleTier = "hard_lock" | "phase_lock" | "league_setting";

export type RuleViolation = {
  code: string;
  message: string;
  tier: RuleTier;
  action?: LeagueAction["kind"];
};

export type RuleCheckResult = {
  allowed: boolean;
  violations: readonly RuleViolation[];
};

export type LeagueAction =
  | { kind: "player_trade"; proposal: TradeProposal }
  | { kind: "pick_trade"; proposal: TradeProposal }
  | { kind: "trade"; proposal: TradeProposal }
  | { kind: "sign_free_agent"; playerId: PlayerId; teamId: TeamId }
  | { kind: "make_free_agent_offer"; playerId: PlayerId; teamId: TeamId }
  | {
      kind: "submit_rfa_offer_sheet";
      playerId: PlayerId;
      offeringTeamId: TeamId;
      terms: ContractInput;
    }
  | { kind: "issue_rfa_qualifying_offer"; playerId: PlayerId; teamId: TeamId }
  | { kind: "match_rfa_offer"; playerId: PlayerId; teamId: TeamId }
  | { kind: "decline_rfa_match"; playerId: PlayerId; teamId: TeamId }
  | { kind: "contract_extension"; playerId: PlayerId; teamId: TeamId }
  | { kind: "player_release"; playerId: PlayerId; teamId: TeamId }
  | {
      kind: "draft_selection";
      draftPickId: DraftPickId;
      teamId: TeamId;
    }
  | { kind: "advance_phase"; toPhaseId: LeaguePhaseId }
  | { kind: "activate_draft" }
  | { kind: "begin_regular_season" }
  | { kind: "begin_playoffs" };

export type LeagueActionKind = LeagueAction["kind"];
