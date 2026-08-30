import { addCalendarDays } from "@/domain/calendar-date";
import {
  getContractSalaryForYear,
  isContractActive,
} from "@/domain/entities/contract";
import {
  createRfaStatus,
  type RfaStatus,
} from "@/domain/entities/rfa-status";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { PlayerId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  computeQualifyingOfferSalary,
  isRfaEligibleByService,
} from "@/systems/league-rules/rfa-rules";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";

/**
 * Classify expiring players as RFA (eligible) or leave as UFA.
 * Does not auto-issue QOs — AI/user issue during roster_decisions.
 * Sets rfaQualificationComplete when all expiring players are classified.
 *
 * Idempotent for a given season year.
 */
export function finalizeRfaQualification(
  state: GameState,
  options: { autoIssueQoForAiTeams?: boolean } = {},
): SystemResult {
  if (state.competition.season.rfaQualificationComplete === true) {
    return systemResult(state);
  }

  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  let current = state;
  const rfaStatuses: Record<string, RfaStatus> = {
    ...(current.business.rfaStatuses ?? {}),
  };
  const leagueMin = Math.round(getLeagueSalaryCap(current) * 0.01);

  const owned = new Set(current.user.ownedTeamIds);

  for (const player of Object.values(current.world.players)) {
    if (player.retired === true) continue;
    if (player.contractId == null) continue;
    const contract = current.business.contracts[player.contractId];
    if (!contract) continue;
    if (contract.endYear !== year) continue;
    // Still active through this season year; will expire on release
    if (!isRfaEligibleByService(contract.startYear, year)) {
      continue;
    }
    if (rfaStatuses[player.id] !== undefined) {
      continue;
    }

    const priorSalary =
      getContractSalaryForYear(contract, year) ??
      getContractSalaryForYear(contract, year - 1) ??
      leagueMin;
    const qoSalary = computeQualifyingOfferSalary(priorSalary, leagueMin);

    const isAiTeam =
      player.teamId != null && !owned.has(player.teamId);
    const autoIssue =
      options.autoIssueQoForAiTeams === true && isAiTeam;

    if (autoIssue && player.teamId != null) {
      rfaStatuses[player.id] = createRfaStatus({
        playerId: player.id,
        originalTeamId: player.teamId,
        seasonYear: year,
        qualifyingOfferSalary: qoSalary,
        hasQualifyingOffer: true,
        activeOfferSheet: null,
        resolution: "pending_rfa",
      });
      events.push(
        createDomainEvent({
          type: "RfaQualifyingOfferIssued",
          occurredOn: current.world.calendar.currentDate,
          payload: {
            playerId: player.id,
            teamId: player.teamId,
            salary: qoSalary,
          },
        }),
      );
    } else if (player.teamId != null) {
      // Placeholder eligibility record without QO yet — user must issue or decline
      rfaStatuses[player.id] = createRfaStatus({
        playerId: player.id,
        originalTeamId: player.teamId,
        seasonYear: year,
        qualifyingOfferSalary: qoSalary,
        hasQualifyingOffer: false,
        activeOfferSheet: null,
        resolution: "unsigned_ufa",
      });
    }
  }

  // Mark complete: all owned-team expiring RFA-eligible either have QO decision
  // For v1: complete after this pass (AI auto-QO; owned default to UFA unless issued)
  current = {
    ...current,
    business: {
      ...current.business,
      rfaStatuses,
    },
    competition: {
      ...current.competition,
      season: {
        ...current.competition.season,
        rfaQualificationComplete: true,
      },
    },
  };

  return systemResult(current, events);
}

/**
 * Issue a qualifying offer for an owned-team player (idempotent).
 */
export function issueQualifyingOffer(
  state: GameState,
  playerId: PlayerId,
): SystemResult {
  const player = state.world.players[playerId];
  if (!player || player.teamId == null || player.contractId == null) {
    throw new Error("Cannot issue QO: player not under contract.");
  }
  const contract = state.business.contracts[player.contractId];
  if (!contract) {
    throw new Error("Cannot issue QO: contract missing.");
  }
  const year = state.competition.season.year;
  const leagueMin = Math.round(getLeagueSalaryCap(state) * 0.01);
  const priorSalary =
    getContractSalaryForYear(contract, year) ?? leagueMin;
  const qoSalary = computeQualifyingOfferSalary(priorSalary, leagueMin);

  const status = createRfaStatus({
    playerId,
    originalTeamId: player.teamId,
    seasonYear: year,
    qualifyingOfferSalary: qoSalary,
    hasQualifyingOffer: true,
    activeOfferSheet: null,
    resolution: "pending_rfa",
  });

  const event = createDomainEvent({
    type: "RfaQualifyingOfferIssued",
    occurredOn: state.world.calendar.currentDate,
    payload: {
      playerId,
      teamId: player.teamId,
      salary: qoSalary,
    },
  });

  return systemResult(
    {
      ...state,
      business: {
        ...state.business,
        rfaStatuses: {
          ...(state.business.rfaStatuses ?? {}),
          [playerId]: status,
        },
      },
    },
    [event],
  );
}

/**
 * Expire RFA offer sheets whose match deadline has passed.
 * Idempotent: clears already-null sheets.
 */
export function expireRfaOfferSheets(state: GameState): SystemResult {
  const currentDate = state.world.calendar.currentDate;
  const rfaStatuses = { ...(state.business.rfaStatuses ?? {}) };
  let changed = false;
  const events: DomainEvent[] = [];

  for (const [playerId, status] of Object.entries(rfaStatuses)) {
    const sheet = status.activeOfferSheet;
    if (sheet == null) continue;
    if (currentDate <= sheet.matchDeadlineDate) continue;
    rfaStatuses[playerId] = {
      ...status,
      activeOfferSheet: null,
      resolution: "pending_rfa",
    };
    changed = true;
    events.push(
      createDomainEvent({
        type: "RfaOfferSheetExpired",
        occurredOn: currentDate,
        payload: { playerId },
      }),
    );
  }

  if (!changed) {
    return systemResult(state);
  }
  return systemResult(
    {
      ...state,
      business: { ...state.business, rfaStatuses },
    },
    events,
  );
}

// silence unused import if isContractActive not used
void isContractActive;
void addCalendarDays;
