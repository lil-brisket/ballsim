/**
 * Franchise Hub — intentionally high-level organizational state.
 * Does not duplicate detailed staff/finance/roster information.
 */

import type { FacilityCategory } from "@/domain/entities/franchise-ops";
import type { RelocationProcess } from "@/domain/entities/relocation";
import type { SeasonPhase } from "@/domain/entities/season";
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
  toRelocationView,
  toSponsorshipsView,
  type FranchiseHistoryView,
} from "@/state/franchise-selectors";
import {
  explainFranchiseValue,
  type FranchiseStanding,
  type FranchiseValueDriverKey,
} from "@/state/franchise-value";
import {
  calculateFranchiseHealth,
  formatDimensionStatus,
} from "@/state/franchise-health";
import {
  assessRelocation,
  type RelocationAssessment,
} from "@/state/relocation-assessment";
import { toObjectivesView, type ObjectiveView } from "@/state/selectors";
import type { FinancialHealthState } from "@/systems/financial-health";

export type FranchiseHubSnapshot = {
  wins: number;
  losses: number;
  fanSentiment: number;
  franchiseHealthLabel: string | null;
  franchiseHealthSummary: string | null;
  franchiseValue: number;
};

export type FranchiseHubLink = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

export type FranchiseValueExplanationSummary = {
  standing: FranchiseStanding;
  topPositiveDriver: FranchiseValueDriverKey | null;
  topNegativeDriver: FranchiseValueDriverKey | null;
};

export type FranchiseFinanceSnapshot = {
  cash: number;
  health: FinancialHealthState;
  runwayWeeks: number | null;
  projectedCash: number;
};

export type FacilityLevelSummary = {
  category: FacilityCategory;
  level: number;
  upgrading: boolean;
};

export type FranchiseFacilitiesSummary = {
  levels: FacilityLevelSummary[];
  upgradingCount: number;
  availableUpgradeCount: number;
  weeklyOpex: number;
  arenaCapacity: number;
};

export type RelocationSummaryState =
  | "not_available"
  | "eligible"
  | "in_progress"
  | "cooldown";

export type FranchiseRelocationSummary = {
  state: RelocationSummaryState;
  statusLabel: string;
  marketSize: number;
  estimatedFee: number;
  cooldownSeasonsRemaining: number;
  primaryDriver: string | null;
  /** Set only when the relocation workflow page is actually open. */
  href: string | null;
};

export type FranchiseHubView = {
  saveId: string;
  teamId: string;
  teamName: string;
  currentDate: string;
  ownerTenureYears: number;
  franchiseValue: number;
  snapshot: FranchiseHubSnapshot;
  valueExplanation: FranchiseValueExplanationSummary;
  financeSnapshot: FranchiseFinanceSnapshot;
  facilitiesSummary: FranchiseFacilitiesSummary;
  relocationSummary: FranchiseRelocationSummary;
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

function toRelocationPresentationState(
  assessment: RelocationAssessment,
  process: RelocationProcess,
  phase: SeasonPhase,
): RelocationSummaryState {
  if (assessment.status === "in_progress") {
    return "in_progress";
  }
  const cooldownRemaining = Math.max(
    assessment.tenure.cooldownSeasonsRemaining,
    assessment.tenure.failedAttemptCooldownSeasonsRemaining,
    process.cooldownSeasonsRemaining,
    process.failedAttemptCooldownSeasonsRemaining,
  );
  if (assessment.status === "blocked_tenure" || cooldownRemaining > 0) {
    return "cooldown";
  }
  if (assessment.canStart && phase === "offseason") {
    return "eligible";
  }
  return "not_available";
}

export function toFranchiseRelocationSummary(
  saveId: string,
  assessment: RelocationAssessment,
  process: RelocationProcess,
  phase: SeasonPhase,
): FranchiseRelocationSummary {
  const state = toRelocationPresentationState(assessment, process, phase);
  const href =
    state === "eligible" || (state === "in_progress" && phase === "offseason")
      ? `/dashboard/${saveId}/relocation`
      : null;
  return {
    state,
    statusLabel: assessment.status.replaceAll("_", " "),
    marketSize: assessment.marketConstraint.marketSize,
    estimatedFee: assessment.estimatedCost.fee,
    cooldownSeasonsRemaining: Math.max(
      assessment.tenure.cooldownSeasonsRemaining,
      assessment.tenure.failedAttemptCooldownSeasonsRemaining,
      process.cooldownSeasonsRemaining,
      process.failedAttemptCooldownSeasonsRemaining,
    ),
    primaryDriver: assessment.primaryDrivers[0] ?? null,
    href,
  };
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
  const assessment = assessRelocation(state);
  const relocationProcess = toRelocationView(state);
  const phase = state.competition.season.phase;
  const relocationSummary = toFranchiseRelocationSummary(
    saveId,
    assessment,
    relocationProcess,
    phase,
  );

  const activeObjectives = sortFranchiseObjectives(
    toObjectivesView(state).filter(
      (o) =>
        o.status === "active" ||
        o.status === "in_progress" ||
        o.status === "pending",
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

  const facilityDecisions = filterDomainDecisions(
    actionCenter.items,
    ["facilities"],
    5,
  );
  const relocationDecision = relocationDecisionFromSummary(relocationSummary);
  const decisions = relocationDecision
    ? [relocationDecision, ...facilityDecisions].slice(0, 5)
    : facilityDecisions;

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
        ? formatDimensionStatus(health.condition)
        : null,
      franchiseHealthSummary: health.summary || null,
      franchiseValue: value.total,
    },
    valueExplanation: {
      standing: value.standing,
      topPositiveDriver: value.topPositiveDriver,
      topNegativeDriver: value.topNegativeDriver,
    },
    financeSnapshot: {
      cash: business.cashRunway.cash,
      health: business.cashRunway.health,
      runwayWeeks: business.cashRunway.runwayWeeks,
      projectedCash: business.cashRunway.projectedCash,
    },
    facilitiesSummary: {
      levels: facilities.map((row) => ({
        category: row.category,
        level: row.level,
        upgrading: row.upgradeWeeksRemaining > 0,
      })),
      upgradingCount: facilities.filter((row) => row.upgradeWeeksRemaining > 0)
        .length,
      availableUpgradeCount: facilities.filter((row) => row.upgradeCost != null)
        .length,
      weeklyOpex: business.cashRunway.outflowBreakdown.facilities,
      arenaCapacity: business.arenaCapacity,
    },
    relocationSummary,
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
    decisions,
  };
}

/**
 * Front Office caps action items at ACTION_QUEUE_CAP, so relocation is often
 * dropped. When the Franchise presentation href is live, surface that same
 * destination without inventing a new action.
 */
function relocationDecisionFromSummary(
  summary: FranchiseRelocationSummary,
): ActionCenterItem | null {
  if (summary.href == null) {
    return null;
  }
  return {
    id: "action_relocation",
    priority: 12,
    severity: summary.state === "in_progress" ? "warning" : "info",
    category: "relocation",
    urgency: summary.state === "in_progress" ? "soon" : "routine",
    deadline: null,
    relevance: "franchise",
    title:
      summary.state === "in_progress"
        ? "Relocation in progress"
        : "Relocation opportunity",
    description:
      summary.primaryDriver ??
      "Market and franchise conditions make relocation a legitimate option.",
    href: summary.href,
    hrefLabel: "Review Stay vs Move",
  };
}
