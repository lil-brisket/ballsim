/**
 * Free Agency Hub presentation.
 * Market / My Offers / Recent Signings. True OVR intentionally exposed (existing model).
 */

import {
  toFreeAgentInterestView,
  type FreeAgentInterestView,
} from "@/state/free-agent-interest-selectors";
import {
  toPayrollRulesView,
  type PayrollRulesView,
} from "@/state/payroll-rules-selectors";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toFreeAgentViews,
  toFreeAgencyOfferViews,
  toOpenFreeAgencyOfferViews,
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
import {
  rfaTagForPlayer,
  toOwnerRfaView,
  type OwnerRfaView,
  type RfaTag,
} from "@/state/rfa-selectors";
import {
  getContractSigningYear,
  getTeamCapSpace,
  getTeamPayroll,
} from "@/systems/salary-cap";

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
  /** Offer sheets to answer and sheets the owner has out. */
  rfa: OwnerRfaView;
  /** Restricted free agents in the market, by player id. */
  rfaTags: Record<string, RfaTag>;
  /** Interest panel per market player (first 40 rows), by player id. */
  interest: Record<string, FreeAgentInterestView>;
  /** Tax line / floor, for "this signing crosses the tax line" warnings. */
  payrollRules: PayrollRulesView;
};

export function toFreeAgencyHubView(state: GameState): FreeAgencyHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const signingYear = getContractSigningYear(state);
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
    // Offers start with the upcoming season in the offseason, so show the
    // payroll and cap space they are checked against.
    playerPayroll: getTeamPayroll(teamId, signingYear, state),
    capSpace: getTeamCapSpace(teamId, signingYear, state),
    availableCount: market.length,
    exposesTrueOverall: true,
    market,
    myOffers: allOffers,
    openOffers,
    recentSignings,
    decisions,
    rfa: toOwnerRfaView(state),
    payrollRules: toPayrollRulesView(state),
    interest: Object.fromEntries(
      market
        .slice(0, 40)
        .map((p) => [p.playerId, toFreeAgentInterestView(state, p.playerId)])
        .filter(
          (entry): entry is [string, FreeAgentInterestView] =>
            entry[1] !== null,
        ),
    ),
    rfaTags: Object.fromEntries(
      market
        .map((p) => [p.playerId, rfaTagForPlayer(state, p.playerId)] as const)
        .filter(
          (entry): entry is readonly [string, RfaTag] => entry[1] !== null,
        ),
    ),
  };
}
