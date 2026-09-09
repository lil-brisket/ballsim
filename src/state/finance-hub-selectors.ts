/**
 * Finance Hub presentation — position → performance → commitments → activity → trend.
 * Composes existing finance selectors; does not recreate financial calculations.
 * Warnings only when business health is critical/tight or Action Center has financial items.
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
  toEventLogView,
  toFinancesView,
  type EventLogEntryView,
  type FinancesView,
} from "@/state/selectors";
import {
  toFranchiseBusinessView,
  type FranchiseBusinessView,
} from "@/state/franchise-selectors";
import {
  toFranchisePnLView,
  type FranchisePnLView,
} from "@/state/franchise-pnl";
import {
  calculateBusinessHealth,
  type BusinessHealthState,
} from "@/systems/financial-health";

export type FinanceTrendPoint = {
  monthKey: string;
  revenue: number;
  expenses: number;
  net: number;
};

export type FinanceHubView = {
  saveId: string;
  teamName: string;
  currentDate: string;
  seasonYear: number;
  finances: FinancesView;
  business: FranchiseBusinessView;
  pnl: FranchisePnLView;
  businessHealth: BusinessHealthState;
  /** Only true problems — never fabricate from low revenue alone. */
  warnings: ActionCenterItem[];
  decisions: ActionCenterItem[];
  ledger: EventLogEntryView[];
  trend: FinanceTrendPoint[];
};

const FINANCE_EVENT_TYPES = new Set([
  "RevenueRecorded",
  "ExpenseRecorded",
  "HomeGameDaySettled",
]);

export function toFinanceHubView(state: GameState): FinanceHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const finances = toFinancesView(state);
  const business = toFranchiseBusinessView(state);
  const pnl = toFranchisePnLView(state);
  const owner = toOwnerDashboardView(state);
  const { cashRunway } = business;

  const businessHealth = calculateBusinessHealth({
    businessFunds: finances.businessFunds,
    weeklyOutflow: cashRunway.weeklyOutflow,
    netWeeklyBurn: cashRunway.netWeeklyBurn,
    runwayWeeks: cashRunway.runwayWeeks,
    projectedBusinessFunds: cashRunway.projectedCash,
  });

  const actionCenter = buildActionCenterView({
    actionItems: owner.actionItems,
    phaseResponsibility: owner.phaseResponsibility,
    currentDate: owner.currentDate,
    saveId: owner.saveId,
    daysUntilTradeDeadline: owner.daysUntilTradeDeadline,
  });

  const decisions = filterDomainDecisions(
    actionCenter.items,
    ["financial"],
    8,
  );

  // Warnings: only critical/tight health OR existing financial action items.
  const warnings: ActionCenterItem[] = [];
  if (businessHealth === "critical" || businessHealth === "tight") {
    const existing = decisions.find((d) => d.id === "action_financial");
    if (existing) {
      warnings.push(existing);
    } else {
      warnings.push({
        id: "finance_health_warning",
        priority: 80,
        severity: businessHealth === "critical" ? "critical" : "warning",
        category: "financial",
        urgency: businessHealth === "critical" ? "immediate" : "soon",
        deadline: null,
        relevance: "franchise",
        title: "Business funds pressure",
        description: `Business health is ${businessHealth.replaceAll("_", " ")}.`,
        href: `/dashboard/${saveId}/finances`,
        hrefLabel: "Review Finances",
      });
    }
  } else {
    warnings.push(...decisions.filter((d) => d.severity !== "info"));
  }

  const ledger = toEventLogView(state).filter((e) =>
    FINANCE_EVENT_TYPES.has(e.type),
  );

  const teamFinances = state.business.finances[teamId];
  const trend: FinanceTrendPoint[] = [];
  if (teamFinances?.booksByMonth) {
    const keys = Object.keys(teamFinances.booksByMonth).sort();
    for (const monthKey of keys.slice(-6)) {
      const books = teamFinances.booksByMonth[monthKey];
      if (!books) continue;
      const revenue =
        books.revenue.tickets +
        books.revenue.premium +
        books.revenue.merchandise +
        books.revenue.concessions +
        books.revenue.sponsorships +
        books.revenue.broadcast +
        books.revenue.playoffs +
        books.revenue.other;
      const expenses =
        books.expenses.staff +
        books.expenses.facilities +
        books.expenses.operations +
        books.expenses.marketing +
        books.expenses.capital;
      trend.push({
        monthKey,
        revenue,
        expenses,
        net: revenue - expenses,
      });
    }
  }

  return {
    saveId,
    teamName: team ? `${team.city} ${team.name}` : "Team",
    currentDate: owner.currentDate,
    seasonYear: state.competition.season.year,
    finances,
    business,
    pnl,
    businessHealth,
    warnings,
    decisions,
    ledger,
    trend,
  };
}
