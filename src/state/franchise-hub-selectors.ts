/**
 * Franchise Hub — intentionally high-level organizational state.
 * Does not duplicate detailed staff/finance/roster information.
 */

import type { GameState } from "@/state/game-state";
import type { ActionCenterItem } from "@/state/action-center-selectors";
import {
  buildActionCenterView,
  filterDomainDecisions,
} from "@/state/action-center-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toFacilitiesView,
  toFranchiseBusinessView,
  toFranchiseHistoryView,
  toSponsorshipsView,
  type FranchiseHistoryView,
} from "@/state/franchise-selectors";
import { explainFranchiseValue } from "@/state/franchise-value";
import { calculateFranchiseHealth } from "@/state/franchise-health";
import {
  toObjectivesView,
  type ObjectiveView,
} from "@/state/selectors";

export type FranchiseHubSnapshot = {
  wins: number;
  losses: number;
  fanSentiment: number;
  franchiseHealthLabel: string | null;
  franchiseValue: number;
};

export type FranchiseHubLink = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

export type FranchiseHubView = {
  saveId: string;
  teamId: string;
  teamName: string;
  currentDate: string;
  ownerTenureYears: number;
  franchiseValue: number;
  snapshot: FranchiseHubSnapshot;
  objectives: ObjectiveView[];
  history: FranchiseHistoryView;
  links: FranchiseHubLink[];
  decisions: ActionCenterItem[];
};

/**
 * Sort: active status → deadline/horizon → importance (role) → id
 */
export function sortFranchiseObjectives(
  objectives: ObjectiveView[],
): ObjectiveView[] {
  const statusOrder: Record<string, number> = {
    active: 0,
    in_progress: 0,
    pending: 1,
    completed: 2,
    failed: 3,
  };
  const roleOrder: Record<string, number> = {
    primary: 0,
    secondary: 1,
    long_term: 2,
  };
  return [...objectives].sort((a, b) => {
    const sa = statusOrder[a.status] ?? 5;
    const sb = statusOrder[b.status] ?? 5;
    if (sa !== sb) return sa - sb;
    const ha = a.horizonYears ?? 999;
    const hb = b.horizonYears ?? 999;
    if (ha !== hb) return ha - hb;
    const ra = roleOrder[a.role] ?? 5;
    const rb = roleOrder[b.role] ?? 5;
    if (ra !== rb) return ra - rb;
    return a.id.localeCompare(b.id);
  });
}

export function toFranchiseHubView(state: GameState): FranchiseHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const business = toFranchiseBusinessView(state);
  const value = explainFranchiseValue(state, teamId);
  const history = toFranchiseHistoryView(state);
  const facilities = toFacilitiesView(state);
  const sponsorships = toSponsorshipsView(state);
  const owner = toOwnerDashboardView(state);
  const standing = state.competition.standings.byTeamId[teamId];
  const health = calculateFranchiseHealth(state);

  const activeObjectives = sortFranchiseObjectives(
    toObjectivesView(state).filter(
      (o) => o.status === "active" || o.status === "in_progress" || o.status === "pending",
    ),
  );

  const arena = facilities.find((f) => f.category === "arena");
  const activeSponsorships = sponsorships.filter(
    (s) => s.status === "active",
  ).length;
  const base = `/dashboard/${saveId}`;

  const actionCenter = buildActionCenterView({
    actionItems: owner.actionItems,
    phaseResponsibility: owner.phaseResponsibility,
    currentDate: owner.currentDate,
    saveId: owner.saveId,
    daysUntilTradeDeadline: owner.daysUntilTradeDeadline,
  });

  return {
    saveId,
    teamId,
    teamName: team ? `${team.city} ${team.name}` : "Franchise",
    currentDate: owner.currentDate,
    ownerTenureYears: history.ownerTenureYears,
    franchiseValue: value.total,
    snapshot: {
      wins: standing?.wins ?? 0,
      losses: standing?.losses ?? 0,
      fanSentiment: business.fanSentiment,
      franchiseHealthLabel: health.condition
        ? `${health.condition.replaceAll("_", " ")}${health.summary ? ` — ${health.summary}` : ""}`
        : null,
      franchiseValue: value.total,
    },
    objectives: activeObjectives,
    history,
    links: [
      {
        title: "Facilities",
        description: arena
          ? `Arena level ${arena.level} · ${facilities.length} categories`
          : `${facilities.length} facility categories`,
        href: `${base}/facilities`,
        cta: "Manage Facilities",
      },
      {
        title: "Brand & marketing",
        description: `Reputation ${business.reputation} · awareness ${business.awareness}`,
        href: `${base}/business`,
        cta: "Manage Branding",
      },
      {
        title: "Sponsorships",
        description:
          activeSponsorships > 0
            ? `${activeSponsorships} active deal${activeSponsorships === 1 ? "" : "s"}`
            : "No active sponsorship",
        href: `${base}/sponsorships`,
        cta: "Review Sponsorships",
      },
      {
        title: "Finances",
        description: "Cash, payroll, and season P&L",
        href: `${base}/finances`,
        cta: "View Finances",
      },
      {
        title: "History",
        description:
          history.seasons.length > 0
            ? `${history.seasons.length} season${history.seasons.length === 1 ? "" : "s"} recorded`
            : "Franchise season archive",
        href: `${base}/history`,
        cta: "View History",
      },
    ],
    decisions: filterDomainDecisions(actionCenter.items, ["facilities"], 5),
  };
}
