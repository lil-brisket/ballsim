import type { LeaguePhaseId } from "@/systems/phase-engine/phase-types";
import type { LeagueActionKind } from "@/systems/league-rules/types";

/**
 * Transaction legality windows by coarse segment.
 * Fine-grained phase checks live in action-guards / free-agency-rules.
 */
export type TradeWindowSegment =
  | "offseason_non_fa"
  | "offseason_fa"
  | "offseason_roster_decisions"
  | "preseason"
  | "regular_pre_deadline"
  | "regular_deadline_closed"
  | "playoffs_postseason";

export type MatrixVerdict = "allowed" | "blocked" | "phase_defined";

/**
 * Coarse matrix for HARD_LOCKS.md / tests.
 * "phase_defined" means allowed only in specific LeaguePhaseId values.
 */
export const TRANSACTION_LEGALITY_MATRIX: Readonly<
  Record<
    Extract<
      LeagueActionKind,
      | "trade"
      | "player_trade"
      | "pick_trade"
      | "sign_free_agent"
      | "submit_rfa_offer_sheet"
      | "issue_rfa_qualifying_offer"
      | "match_rfa_offer"
      | "decline_rfa_match"
      | "contract_extension"
      | "player_release"
      | "draft_selection"
    >,
    Readonly<Record<TradeWindowSegment, MatrixVerdict>>
  >
> = {
  trade: {
    offseason_non_fa: "phase_defined",
    offseason_fa: "allowed",
    offseason_roster_decisions: "allowed",
    preseason: "allowed",
    regular_pre_deadline: "allowed",
    regular_deadline_closed: "blocked",
    playoffs_postseason: "blocked",
  },
  player_trade: {
    offseason_non_fa: "phase_defined",
    offseason_fa: "allowed",
    offseason_roster_decisions: "allowed",
    preseason: "allowed",
    regular_pre_deadline: "allowed",
    regular_deadline_closed: "blocked",
    playoffs_postseason: "blocked",
  },
  pick_trade: {
    offseason_non_fa: "phase_defined",
    offseason_fa: "allowed",
    offseason_roster_decisions: "allowed",
    preseason: "allowed",
    regular_pre_deadline: "allowed",
    regular_deadline_closed: "blocked",
    playoffs_postseason: "blocked",
  },
  sign_free_agent: {
    offseason_non_fa: "blocked",
    offseason_fa: "allowed",
    offseason_roster_decisions: "blocked",
    preseason: "blocked",
    regular_pre_deadline: "blocked",
    regular_deadline_closed: "blocked",
    playoffs_postseason: "blocked",
  },
  submit_rfa_offer_sheet: {
    offseason_non_fa: "blocked",
    offseason_fa: "allowed",
    offseason_roster_decisions: "blocked",
    preseason: "blocked",
    regular_pre_deadline: "blocked",
    regular_deadline_closed: "blocked",
    playoffs_postseason: "blocked",
  },
  issue_rfa_qualifying_offer: {
    offseason_non_fa: "blocked",
    offseason_fa: "blocked",
    offseason_roster_decisions: "allowed",
    preseason: "blocked",
    regular_pre_deadline: "blocked",
    regular_deadline_closed: "blocked",
    playoffs_postseason: "blocked",
  },
  match_rfa_offer: {
    offseason_non_fa: "blocked",
    offseason_fa: "allowed",
    offseason_roster_decisions: "blocked",
    preseason: "blocked",
    regular_pre_deadline: "blocked",
    regular_deadline_closed: "blocked",
    playoffs_postseason: "blocked",
  },
  decline_rfa_match: {
    offseason_non_fa: "blocked",
    offseason_fa: "allowed",
    offseason_roster_decisions: "blocked",
    preseason: "blocked",
    regular_pre_deadline: "blocked",
    regular_deadline_closed: "blocked",
    playoffs_postseason: "blocked",
  },
  contract_extension: {
    offseason_non_fa: "phase_defined",
    offseason_fa: "phase_defined",
    offseason_roster_decisions: "allowed",
    preseason: "phase_defined",
    regular_pre_deadline: "phase_defined",
    regular_deadline_closed: "phase_defined",
    playoffs_postseason: "blocked",
  },
  player_release: {
    offseason_non_fa: "phase_defined",
    offseason_fa: "phase_defined",
    offseason_roster_decisions: "allowed",
    preseason: "phase_defined",
    regular_pre_deadline: "phase_defined",
    regular_deadline_closed: "phase_defined",
    playoffs_postseason: "phase_defined",
  },
  draft_selection: {
    offseason_non_fa: "blocked",
    offseason_fa: "blocked",
    offseason_roster_decisions: "blocked",
    preseason: "blocked",
    regular_pre_deadline: "blocked",
    regular_deadline_closed: "blocked",
    playoffs_postseason: "blocked",
  },
};

/** Map active LeaguePhaseId + trades-open flag → matrix segment. */
export function resolveTradeWindowSegment(
  phaseId: LeaguePhaseId,
  tradesOpen: boolean,
): TradeWindowSegment {
  if (phaseId === "offseason.free_agency") {
    return "offseason_fa";
  }
  if (phaseId === "offseason.roster_decisions") {
    return "offseason_roster_decisions";
  }
  if (phaseId.startsWith("offseason.")) {
    return "offseason_non_fa";
  }
  if (phaseId === "preseason.preparation") {
    return "preseason";
  }
  if (phaseId === "regular") {
    return tradesOpen ? "regular_pre_deadline" : "regular_deadline_closed";
  }
  return "playoffs_postseason";
}
