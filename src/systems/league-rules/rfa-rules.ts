import { addCalendarDays } from "@/domain/calendar-date";
import type { ContractInput } from "@/domain/entities/contract";
import {
  createRfaStatus,
  isActiveRfa,
  type RfaStatus,
} from "@/domain/entities/rfa-status";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  RFA_MATCH_WINDOW_DAYS,
  RFA_MAX_YEARS_OF_SERVICE,
  RFA_QUALIFYING_OFFER_MULTIPLIER,
} from "@/systems/league-rules/invariants";
import { readActivePhaseId } from "@/systems/league-rules/phase-ids";
import type { RuleViolation } from "@/systems/league-rules/types";

export function getRfaStatus(
  state: GameState,
  playerId: PlayerId,
): RfaStatus | undefined {
  return state.business.rfaStatuses?.[playerId];
}

export function isPlayerActiveRfa(state: GameState, playerId: PlayerId): boolean {
  const status = getRfaStatus(state, playerId);
  return status !== undefined && isActiveRfa(status);
}

export function yearsOfServiceFromContract(
  startYear: number,
  seasonYear: number,
): number {
  return Math.max(0, seasonYear - startYear + 1);
}

export function computeQualifyingOfferSalary(
  priorYearSalary: number,
  leagueMinimum: number,
): number {
  return Math.max(
    Math.round(priorYearSalary * RFA_QUALIFYING_OFFER_MULTIPLIER),
    leagueMinimum,
  );
}

export function checkIssueQualifyingOffer(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): { allowed: boolean; violations: RuleViolation[] } {
  const violations: RuleViolation[] = [];
  if (readActivePhaseId(state) !== "offseason.roster_decisions") {
    violations.push({
      code: "RFA_QO_WRONG_PHASE",
      message: "Qualifying offers may only be issued during roster decisions.",
      tier: "phase_lock",
      action: "issue_rfa_qualifying_offer",
    });
  }
  const existing = getRfaStatus(state, playerId);
  if (existing?.hasQualifyingOffer) {
    violations.push({
      code: "RFA_QO_ALREADY_ISSUED",
      message: "A qualifying offer has already been issued for this player.",
      tier: "hard_lock",
      action: "issue_rfa_qualifying_offer",
    });
  }
  const player = state.world.players[playerId];
  if (!player || player.teamId !== teamId) {
    violations.push({
      code: "RFA_QO_WRONG_TEAM",
      message: "Only the player's current team may issue a qualifying offer.",
      tier: "hard_lock",
      action: "issue_rfa_qualifying_offer",
    });
  }
  return { allowed: violations.length === 0, violations };
}

export function checkSubmitRfaOfferSheet(
  state: GameState,
  playerId: PlayerId,
  offeringTeamId: TeamId,
): { allowed: boolean; violations: RuleViolation[] } {
  const violations: RuleViolation[] = [];
  if (readActivePhaseId(state) !== "offseason.free_agency") {
    violations.push({
      code: "RFA_SHEET_WRONG_PHASE",
      message: "RFA offer sheets may only be submitted during free agency.",
      tier: "phase_lock",
      action: "submit_rfa_offer_sheet",
    });
  }
  const status = getRfaStatus(state, playerId);
  if (!status || !isActiveRfa(status)) {
    violations.push({
      code: "RFA_NOT_ELIGIBLE",
      message: "Player is not an active restricted free agent.",
      tier: "hard_lock",
      action: "submit_rfa_offer_sheet",
    });
    return { allowed: false, violations };
  }
  if (status.activeOfferSheet !== null) {
    violations.push({
      code: "RFA_SHEET_ALREADY_ACTIVE",
      message:
        "Only one active RFA offer sheet is allowed at a time for this player.",
      tier: "hard_lock",
      action: "submit_rfa_offer_sheet",
    });
  }
  if (offeringTeamId === status.originalTeamId) {
    violations.push({
      code: "RFA_SHEET_OWN_TEAM",
      message: "The original team cannot submit an offer sheet to itself.",
      tier: "hard_lock",
      action: "submit_rfa_offer_sheet",
    });
  }
  return { allowed: violations.length === 0, violations };
}

export function checkDeclineMatch(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): { allowed: boolean; violations: RuleViolation[] } {
  const violations: RuleViolation[] = [];
  if (readActivePhaseId(state) !== "offseason.free_agency") {
    violations.push({
      code: "RFA_DECLINE_WRONG_PHASE",
      message: "RFA decline is only available during free agency.",
      tier: "phase_lock",
      action: "decline_rfa_match",
    });
  }
  const status = getRfaStatus(state, playerId);
  if (!status || status.resolution !== "pending_match") {
    violations.push({
      code: "RFA_NO_PENDING_MATCH",
      message: "There is no pending RFA offer sheet to decline.",
      tier: "hard_lock",
      action: "decline_rfa_match",
    });
    return { allowed: false, violations };
  }
  if (teamId !== status.originalTeamId) {
    violations.push({
      code: "RFA_DECLINE_WRONG_TEAM",
      message: "Only the original team may decline an RFA offer sheet.",
      tier: "hard_lock",
      action: "decline_rfa_match",
    });
  }
  return { allowed: violations.length === 0, violations };
}

export function checkMatchRfaOffer(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): { allowed: boolean; violations: RuleViolation[] } {
  const violations: RuleViolation[] = [];
  if (readActivePhaseId(state) !== "offseason.free_agency") {
    violations.push({
      code: "RFA_MATCH_WRONG_PHASE",
      message: "RFA matching is only available during free agency.",
      tier: "phase_lock",
      action: "match_rfa_offer",
    });
  }
  const status = getRfaStatus(state, playerId);
  if (!status || status.resolution !== "pending_match") {
    violations.push({
      code: "RFA_NO_PENDING_MATCH",
      message: "There is no pending RFA offer sheet to match.",
      tier: "hard_lock",
      action: "match_rfa_offer",
    });
    return { allowed: false, violations };
  }
  if (teamId !== status.originalTeamId) {
    violations.push({
      code: "RFA_MATCH_WRONG_TEAM",
      message: "Only the original team may match an RFA offer sheet.",
      tier: "hard_lock",
      action: "match_rfa_offer",
    });
  }
  const sheet = status.activeOfferSheet;
  if (sheet === null) {
    violations.push({
      code: "RFA_SHEET_MISSING",
      message: "RFA offer sheet terms are missing.",
      tier: "hard_lock",
      action: "match_rfa_offer",
    });
  } else if (state.world.calendar.currentDate > sheet.matchDeadlineDate) {
    violations.push({
      code: "RFA_MATCH_WINDOW_CLOSED",
      message: "The RFA matching window has closed.",
      tier: "hard_lock",
      action: "match_rfa_offer",
    });
  }
  return { allowed: violations.length === 0, violations };
}

export function buildOfferSheet(
  offeringTeamId: TeamId,
  terms: ContractInput,
  createdOn: string,
): NonNullable<RfaStatus["activeOfferSheet"]> {
  return {
    offeringTeamId,
    terms,
    createdOn,
    matchDeadlineDate: addCalendarDays(createdOn, RFA_MATCH_WINDOW_DAYS),
  };
}

export function createPendingRfaStatus(input: {
  playerId: PlayerId;
  originalTeamId: TeamId;
  seasonYear: number;
  qualifyingOfferSalary: number;
}): RfaStatus {
  return createRfaStatus({
    playerId: input.playerId,
    originalTeamId: input.originalTeamId,
    seasonYear: input.seasonYear,
    qualifyingOfferSalary: input.qualifyingOfferSalary,
    hasQualifyingOffer: true,
    activeOfferSheet: null,
    resolution: "pending_rfa",
  });
}

export function isRfaEligibleByService(
  contractStartYear: number,
  seasonYear: number,
): boolean {
  return (
    yearsOfServiceFromContract(contractStartYear, seasonYear) <
    RFA_MAX_YEARS_OF_SERVICE
  );
}

/** True when every expiring player has been classified for the season. */
export function isRfaQualificationComplete(state: GameState): boolean {
  // Soft gate: if any active RFA exists without classification markers, still OK.
  // Complete when no pending unclassified flag is set on season.
  return state.competition.season.rfaQualificationComplete === true;
}
