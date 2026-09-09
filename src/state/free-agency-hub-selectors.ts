/**
 * Free Agency Hub presentation.
 * Market / My Offers / Recent Signings. True OVR intentionally exposed (existing model).
 */

import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toFreeAgentViews,
  toFreeAgencyOfferViews,
  toOpenFreeAgencyOfferViews,
  toFinancesView,
  type FreeAgentView,
  type FreeAgencyOfferView,
} from "@/state/selectors";
import {
  buildActionCenterView,
  filterDomainDecisions,
  type ActionCenterItem,
} from "@/state/action-center-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { isInLeaguePhase } from "@/systems/phase-engine";

export type FreeAgencyRecentSigning = {
  offerId: string;
  playerId: string;
  playerName: string;
  salary: number | null;
  years: number;
  status: string;
  createdOn: string;
};

export type FreeAgencyHubView = {
  active: boolean;
  inactiveReason: string | null;
  saveId: string;
  currentDate: string;
  teamName: string;
  rosterCount: number;
  playerPayroll: number;
  capSpace: number;
  availableCount: number;
  /** Intentional: true OVR from existing FreeAgentView. */
  exposesTrueOverall: true;
  market: FreeAgentView[];
  myOffers: FreeAgencyOfferView[];
  openOffers: FreeAgencyOfferView[];
  recentSignings: FreeAgencyRecentSigning[];
  decisions: ActionCenterItem[];
};

export function toFreeAgencyHubView(state: GameState): FreeAgencyHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const finances = toFinancesView(state);
  const owner = toOwnerDashboardView(state);
  const active = isInLeaguePhase(state, "offseason.free_agency");

  const market = toFreeAgentViews(state);
  const allOffers = toFreeAgencyOfferViews(state);
  const openOffers = toOpenFreeAgencyOfferViews(state);
  const recentSignings: FreeAgencyRecentSigning[] = allOffers
    .filter((o) => o.status === "accepted")
    .map((o) => ({
      offerId: o.offerId,
      playerId: o.playerId,
      playerName: o.playerName,
      salary: o.salary,
      years: o.years,
      status: o.status,
      createdOn: o.createdOn,
    }))
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn));

  const actionCenter = buildActionCenterView({
    actionItems: owner.actionItems,
    phaseResponsibility: owner.phaseResponsibility,
    currentDate: owner.currentDate,
    saveId,
    daysUntilTradeDeadline: owner.daysUntilTradeDeadline,
  });
  const decisions = filterDomainDecisions(
    actionCenter.items,
    ["free_agency"],
    8,
  );

  return {
    active,
    inactiveReason: active
      ? null
      : "Free agency is available during the offseason free_agency stage. Use the Calendar to advance.",
    saveId,
    currentDate: owner.currentDate,
    teamName: team ? `${team.city} ${team.name}` : "Team",
    rosterCount: team?.roster.length ?? 0,
    playerPayroll: finances.playerPayroll,
    capSpace: finances.capSpace,
    availableCount: market.length,
    exposesTrueOverall: true,
    market,
    myOffers: allOffers,
    openOffers,
    recentSignings,
    decisions,
  };
}
