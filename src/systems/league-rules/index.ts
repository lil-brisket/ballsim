export {
  DRAFT_ROUNDS,
  DRAFT_PICK_TRADE_HORIZON_YEARS,
  TRADE_DEADLINE_SEASON_FRACTION,
  RFA_MATCH_WINDOW_DAYS,
  RFA_MAX_YEARS_OF_SERVICE,
  RFA_QUALIFYING_OFFER_MULTIPLIER,
  PLAYER_RETIREMENT_MIN_AGE,
  PLAYER_RETIREMENT_HIGH_AGE,
} from "@/systems/league-rules/invariants";

export type {
  RuleTier,
  RuleViolation,
  RuleCheckResult,
  LeagueAction,
  LeagueActionKind,
} from "@/systems/league-rules/types";

export {
  canPerformAction,
  getActionBlockReason,
  assertActionAllowed,
} from "@/systems/league-rules/action-guards";

export {
  readActivePhaseId,
  isLeaguePhaseId,
  seasonPhaseFromPhaseId,
} from "@/systems/league-rules/phase-ids";

export {
  canEnterPhase,
  canAdvanceFromPhase,
  canBeginRegularSeason,
  canBeginPlayoffs,
} from "@/systems/league-rules/phase-prerequisites";

export {
  canTradeDraftPick,
  canActivateDraft,
  isPickConsumed,
  isPickAvailable,
  maxTradablePickSeasonYear,
  isDraftCompleteForYear,
} from "@/systems/league-rules/draft-rules";

export {
  resolveHardLockTradeDeadlineDate,
  areTradesOpenHardLock,
  checkTradeWindow,
} from "@/systems/league-rules/trade-rules";

export {
  isFreeAgencyOpen,
  checkFreeAgencySigning,
} from "@/systems/league-rules/free-agency-rules";

export {
  getRfaStatus,
  isPlayerActiveRfa,
  checkIssueQualifyingOffer,
  checkSubmitRfaOfferSheet,
  checkMatchRfaOffer,
  checkDeclineMatch,
  computeQualifyingOfferSalary,
  createPendingRfaStatus,
  buildOfferSheet,
  isRfaQualificationComplete,
  isRfaEligibleByService,
  yearsOfServiceFromContract,
} from "@/systems/league-rules/rfa-rules";

export {
  checkContractExtensionWindow,
  checkPlayerReleaseWindow,
} from "@/systems/league-rules/contract-rules";

export {
  isPlayerRetired,
  checkRetiredPlayerBlocked,
} from "@/systems/league-rules/retirement-rules";

export {
  getLeagueMilestones,
  type LeagueMilestone,
  type LeagueMilestoneKey,
} from "@/systems/league-rules/calendar-events";

export {
  TRANSACTION_LEGALITY_MATRIX,
  resolveTradeWindowSegment,
  type TradeWindowSegment,
  type MatrixVerdict,
} from "@/systems/league-rules/transaction-matrix";

export {
  collectLeagueInvariantIssues,
  assertLeagueInvariants,
} from "@/systems/league-rules/lifecycle-invariants";

export { snapshotTradeDeadline } from "@/systems/league-rules/snapshot-trade-deadline";


export {
  phaseOrderIndex, getNextPhaseInOrder, resolveSeasonAnchors, resolveOffseasonWindows, getExpectedPhaseWindow, resolvePhaseResolution, PHASE_ORDER,
} from "@/systems/league-rules/league-calendar";
export type {
  SeasonAnchors, PhaseResolutionReason, PhaseBlockedBy, PhaseResolution, ResolvedPhaseWindow,
} from "@/systems/league-rules/league-calendar";
