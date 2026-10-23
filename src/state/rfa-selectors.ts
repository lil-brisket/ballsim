/**
 * Restricted free agency views for the owner: qualifying offers to decide in
 * roster decisions, offer sheets to match or decline, sheets the owner has
 * out, and the RFA tag for free-agent lists. Presentation only.
 */

import { getContractSalaryForYear } from "@/domain/entities/contract";
import { isActiveRfa, type RfaStatus } from "@/domain/entities/rfa-status";
import type { PlayerId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { getActionBlockReason } from "@/systems/league-rules";
import { isRestrictedFreeAgencyEnabled } from "@/systems/rfa";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getTeamPayroll } from "@/systems/salary-cap";

export type QualifyingOfferRow = {
  playerId: string;
  playerName: string;
  position: string;
  age: number;
  overall: number;
  qualifyingOfferSalary: number;
  issued: boolean;
  /** Why the owner cannot issue it now, or null. */
  blockedReason: string | null;
};

export type IncomingOfferSheetRow = {
  playerId: string;
  playerName: string;
  offeringTeamId: string;
  offeringTeamName: string;
  salary: number;
  years: number;
  matchDeadlineDate: string;
  /** Payroll in the sheet's first season if you match. */
  payrollIfMatched: number;
  salaryCap: number;
  matchBlockedReason: string | null;
};

export type OutgoingOfferSheetRow = {
  playerId: string;
  playerName: string;
  originalTeamName: string;
  salary: number;
  years: number;
  matchDeadlineDate: string;
};

export type RfaTag = {
  originalTeamId: string;
  originalTeamName: string;
  qualifyingOfferSalary: number;
  /** A sheet is out and his team is deciding. */
  pendingMatch: boolean;
};

export type OwnerRfaView = {
  enabled: boolean;
  qualifyingOffers: QualifyingOfferRow[];
  incomingSheets: IncomingOfferSheetRow[];
  outgoingSheets: OutgoingOfferSheetRow[];
};

function playerName(state: GameState, playerId: string): string {
  const p = state.world.players[playerId];
  return p ? `${p.firstName} ${p.lastName}` : playerId;
}

function teamName(state: GameState, teamId: string): string {
  const t = state.world.teams[teamId];
  return t ? `${t.city} ${t.name}` : teamId;
}

function currentStatuses(state: GameState): RfaStatus[] {
  const year = state.competition.season.year;
  return Object.values(state.business.rfaStatuses ?? {})
    .filter((s) => s.seasonYear === year)
    .sort((a, b) => (a.playerId < b.playerId ? -1 : 1));
}

function sheetSalary(status: RfaStatus): { salary: number; years: number } {
  const terms = status.activeOfferSheet!.terms;
  return {
    salary:
      getContractSalaryForYear(
        { ...terms, salaryByYear: terms.salaryByYear } as never,
        terms.startYear,
      ) ?? 0,
    years: terms.endYear - terms.startYear + 1,
  };
}

export function toOwnerRfaView(state: GameState): OwnerRfaView {
  const teamId = getActiveOwnerTeamId(state);
  const statuses = currentStatuses(state);
  const qualifyingOffers: QualifyingOfferRow[] = [];
  const incomingSheets: IncomingOfferSheetRow[] = [];
  const outgoingSheets: OutgoingOfferSheetRow[] = [];
  const cap = getLeagueSalaryCap(state);

  for (const status of statuses) {
    const player = state.world.players[status.playerId];
    if (!player) continue;
    if (status.originalTeamId === teamId) {
      const contract =
        player.contractId != null
          ? state.business.contracts[player.contractId]
          : undefined;
      // Still under his expiring deal: the qualifying-offer decision.
      if (contract && player.teamId === teamId) {
        qualifyingOffers.push({
          playerId: status.playerId,
          playerName: playerName(state, status.playerId),
          position: player.position,
          age: player.age,
          overall: calculatePlayerOverall(player.position, player.attributes),
          qualifyingOfferSalary: status.qualifyingOfferSalary,
          issued: status.hasQualifyingOffer,
          blockedReason: status.hasQualifyingOffer
            ? null
            : getActionBlockReason(state, {
                kind: "issue_rfa_qualifying_offer",
                playerId: status.playerId as PlayerId,
                teamId,
              }),
        });
      }
      if (status.resolution === "pending_match" && status.activeOfferSheet) {
        const { salary, years } = sheetSalary(status);
        const startYear = status.activeOfferSheet.terms.startYear;
        incomingSheets.push({
          playerId: status.playerId,
          playerName: playerName(state, status.playerId),
          offeringTeamId: status.activeOfferSheet.offeringTeamId,
          offeringTeamName: teamName(
            state,
            status.activeOfferSheet.offeringTeamId,
          ),
          salary,
          years,
          matchDeadlineDate: status.activeOfferSheet.matchDeadlineDate,
          payrollIfMatched: getTeamPayroll(teamId, startYear, state) + salary,
          salaryCap: cap,
          matchBlockedReason: getActionBlockReason(state, {
            kind: "match_rfa_offer",
            playerId: status.playerId as PlayerId,
            teamId,
          }),
        });
      }
    } else if (
      status.resolution === "pending_match" &&
      status.activeOfferSheet?.offeringTeamId === teamId
    ) {
      const { salary, years } = sheetSalary(status);
      outgoingSheets.push({
        playerId: status.playerId,
        playerName: playerName(state, status.playerId),
        originalTeamName: teamName(state, status.originalTeamId),
        salary,
        years,
        matchDeadlineDate: status.activeOfferSheet.matchDeadlineDate,
      });
    }
  }

  return {
    enabled: isRestrictedFreeAgencyEnabled(state),
    qualifyingOffers,
    incomingSheets,
    outgoingSheets,
  };
}

/** RFA tag for a free agent, or null when he is unrestricted. */
export function rfaTagForPlayer(
  state: GameState,
  playerId: string,
): RfaTag | null {
  const status = state.business.rfaStatuses?.[playerId];
  if (
    !status ||
    status.seasonYear !== state.competition.season.year ||
    !isActiveRfa(status)
  ) {
    return null;
  }
  return {
    originalTeamId: status.originalTeamId,
    originalTeamName: teamName(state, status.originalTeamId),
    qualifyingOfferSalary: status.qualifyingOfferSalary,
    pendingMatch: status.resolution === "pending_match",
  };
}
