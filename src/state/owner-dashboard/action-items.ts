import type { CalendarContext } from "@/systems/simulation/calendar-context";
import type { GameState } from "@/state/game-state";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import { ACTION_QUEUE_CAP } from "@/state/owner-dashboard-config";
import type {
  OwnerDashboardActionCategory,
  OwnerDashboardActionSeverity,
  CanonicalDashboardData,
  OwnerDashboardHealth,
  OwnerDashboardTeam,
  OwnerDashboardActionItem,
  OwnerDashboardSituationView,
} from "@/state/owner-dashboard/types";
import { buildCalendarActionItems } from "@/state/owner-dashboard/calendar-action-items";
import {
  formatCompactMoney,
  hasAttendanceProblem,
  isTicketPriceElevated,
  attendanceWhat,
  attendanceEvidence,
  hasMarketingInsight,
  hasTeamPayrollConcern,
} from "@/state/owner-dashboard/metrics";

const CATEGORY_PRIORITY: Record<OwnerDashboardActionCategory, number> = {
  calendar: 0,
  draft: 1,
  free_agency: 2,
  contracts: 3,
  financial: 4,
  attendance: 5,
  team: 6,
  roster: 7,
  staff: 8,
  facilities: 9,
  marketing: 10,
  sponsorship: 11,
  relocation: 12,
  notifications: 13,
  narrative: 14,
};

const SEVERITY_PRIORITY: Record<OwnerDashboardActionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function buildActionItems(
  data: CanonicalDashboardData,
  health: OwnerDashboardHealth,
  team: OwnerDashboardTeam,
  calendar: CalendarContext,
): OwnerDashboardActionItem[] {
  const saveId = data.saveId;
  const items: OwnerDashboardActionItem[] = [];

  // Calendar-first decisions — what the owner should think about now.
  items.push(...buildCalendarActionItems(data, health, team, calendar));

  if (data.snapshot.userOnDraftClock) {
    items.push({
      id: "action_draft",
      category: "draft",
      severity: "critical",
      title: "Draft clock",
      what: "Your team is on the draft clock.",
      why: "You must select a prospect before advancing time.",
      evidence: ["Draft pick is waiting on your team"],
      href: `/dashboard/${saveId}/draft`,
      hrefLabel: "Open Draft",
    });
  }

  const healthState = health.financialHealth;
  if (healthState === "warning" || healthState === "critical") {
    const severity: OwnerDashboardActionSeverity =
      healthState === "warning" ? "warning" : "critical";
    const runway = data.business.cashRunway;
    items.push({
      id: "action_financial",
      category: "financial",
      severity,
      title: "Business funds pressure",
      what:
        runway.netWeeklyBurn > 0
          ? "Business funds are under pressure while weekly operating burn remains positive."
          : "Business funds health is tight or critical.",
      why: "Major facility or marketing investments may be difficult until business revenue improves.",
      evidence: [
        `Business funds: ${formatCompactMoney(health.cash)}`,
        `Health: ${healthState}`,
        runway.runwayWeeks !== null
          ? `Runway: ~${runway.runwayWeeks} weeks`
          : `Net weekly burn: ${formatCompactMoney(runway.netWeeklyBurn)}`,
        `Net income (season): ${formatCompactMoney(health.netIncome)}`,
      ],
      href: `/dashboard/${saveId}/finances`,
      hrefLabel: "Review Finances",
    });
  }

  const attendanceProblem = hasAttendanceProblem(data, health);
  if (attendanceProblem) {
    const pricingElevated = isTicketPriceElevated(data);
    items.push({
      id: "action_attendance",
      category: "attendance",
      severity: "warning",
      title: pricingElevated ? "Attendance and pricing" : "Attendance concern",
      what: attendanceWhat(data, health),
      why: "Weak gate demand can drag ticket revenue and fan sentiment over time.",
      evidence: attendanceEvidence(data, health),
      href: `/dashboard/${saveId}/business`,
      hrefLabel: pricingElevated
        ? "Review Ticket Pricing"
        : "Review Attendance",
    });
  }

  if (hasMarketingInsight(data, health)) {
    items.push({
      id: "action_marketing",
      category: "marketing",
      severity: "info",
      title: "Marketing vs attendance",
      what: `Awareness is ${health.awareness}, but last home fill rate was only ${health.attendanceFillRatePct}%.`,
      why: "Awareness has not translated into stronger attendance — marketing spend or messaging may be worth reviewing.",
      evidence: [
        `Awareness: ${health.awareness}`,
        `Last fill rate: ${health.attendanceFillRatePct}%`,
        `Ticket price: $${health.ticketPrice}`,
      ],
      href: `/dashboard/${saveId}/business`,
      hrefLabel: "Open Marketing",
    });
  }

  if (hasTeamPayrollConcern(data, team)) {
    items.push({
      id: "action_team",
      category: "team",
      severity: "warning",
      title: "Payroll vs performance",
      what: `Record is ${team.wins}–${team.losses} while payroll sits ${Math.round(data.payrollVsLeaguePct ?? 0)}% above the league average.`,
      why: "High payroll without matching results may leave less flexibility for roster or business moves.",
      evidence: [
        `Record: ${team.wins}–${team.losses}`,
        `Payroll: ${formatCompactMoney(team.payroll)}`,
        `Team strength: ${team.strength}`,
        data.payrollVsLeaguePct !== null
          ? `Payroll vs league: +${Math.round(data.payrollVsLeaguePct)}%`
          : "Payroll vs league: n/a",
      ],
      href: `/dashboard/${saveId}/team`,
      hrefLabel: "View Team",
    });
  }

  if (team.rosterProblems.length > 0) {
    items.push({
      id: "action_roster",
      category: "roster",
      severity: "warning",
      title: "Injured players",
      what: `${team.rosterProblems.length} roster player${team.rosterProblems.length === 1 ? " is" : "s are"} currently injured.`,
      why: "Injuries can reduce on-court strength and affect near-term results.",
      evidence: team.rosterProblems
        .slice(0, 3)
        .map((p) => `${p.name} (${p.kind})`),
      href: `/dashboard/${saveId}/roster`,
      hrefLabel: "Review Roster",
    });
  }

  if (data.vacantStarterRoles.length > 0) {
    items.push({
      id: "action_staff",
      category: "staff",
      severity: "warning",
      title: "Staff vacancy",
      what: `Vacant starter role${data.vacantStarterRoles.length === 1 ? "" : "s"}: ${data.vacantStarterRoles.join(", ")}.`,
      why: "Missing starter staff can weaken evaluation, development, or operations coverage.",
      evidence: data.vacantStarterRoles.map((role) => `Open: ${role}`),
      href: `/dashboard/${saveId}/staff-coaching`,
      hrefLabel: "Review Staff",
    });
  }

  if (data.hasFacilityUpgradeAvailable) {
    const upgradable = data.facilities.filter((f) => f.upgradeCost !== null);
    items.push({
      id: "action_facilities",
      category: "facilities",
      severity: "info",
      title: "Facility upgrade available",
      what: `${upgradable.length} facility categor${upgradable.length === 1 ? "y has" : "ies have"} an available upgrade.`,
      why: "Facility levels affect capacity, development, and franchise value over time.",
      evidence: upgradable
        .slice(0, 3)
        .map(
          (f) =>
            `${f.category} (level ${f.level}${f.upgradeCost !== null ? ` · ${formatCompactMoney(f.upgradeCost)}` : ""})`,
        ),
      href: `/dashboard/${saveId}/finances/facilities`,
      hrefLabel: "Manage Facilities",
    });
  }

  if (!data.hasActiveSponsorship) {
    items.push({
      id: "action_sponsorship",
      category: "sponsorship",
      severity: "info",
      title: "No active sponsorship",
      what: "Your franchise does not currently have an active sponsorship deal.",
      why: "Sponsorships are an optional revenue stream — worth considering when finances or commercial climate allow.",
      evidence: ["Active sponsorships: 0"],
      href: `/dashboard/${saveId}/sponsorships`,
      hrefLabel: "Review Sponsorship",
    });
  }

  const importantUnread = data.snapshot.notifications.filter(
    (n) => !n.read && (n.severity === "warning" || n.severity === "critical"),
  );
  if (importantUnread.length > 0) {
    const alreadyCovered =
      items.some((item) => item.category === "financial") ||
      items.some((item) => item.category === "attendance");
    if (!alreadyCovered) {
      items.push({
        id: "action_notifications",
        category: "notifications",
        severity: importantUnread.some((n) => n.severity === "critical")
          ? "critical"
          : "warning",
        title: "Important notifications",
        what: `You have ${importantUnread.length} unread warning or critical notification${importantUnread.length === 1 ? "" : "s"}.`,
        why: "These events may affect franchise decisions you have not reviewed yet.",
        evidence: importantUnread.slice(0, 2).map((n) => n.message),
        href: `/dashboard/${saveId}/notifications`,
        hrefLabel: "Open Notifications",
      });
    }
  }

  items.push(...buildNarrativeActionItems(data.state, saveId));

  return sortAndCapActionItems(items, calendar);
}

function buildNarrativeActionItems(
  state: GameState,
  saveId: string,
): OwnerDashboardActionItem[] {
  const items: OwnerDashboardActionItem[] = [];
  for (const situation of getActiveOwnedFranchise(state).narrative.situations) {
    if (
      situation.status !== "active" &&
      situation.status !== "escalated" &&
      situation.status !== "acknowledged"
    ) {
      continue;
    }
    if (
      situation.severity !== "important" &&
      situation.severity !== "critical"
    ) {
      continue;
    }
    const primaryAction = situation.actions?.[0];
    const href =
      primaryAction?.href && primaryAction.href.length > 0
        ? primaryAction.href.startsWith("/")
          ? primaryAction.href.includes(saveId)
            ? primaryAction.href
            : `/dashboard/${saveId}${primaryAction.href.replace(/^\/dashboard\/?/, "/")}`
          : `/dashboard/${saveId}/${primaryAction.href}`
        : `/dashboard/${saveId}/notifications?type=narrative`;
    const severity: OwnerDashboardActionSeverity =
      situation.severity === "critical" ? "critical" : "warning";
    const evidence = Object.entries(situation.evidence)
      .slice(0, 4)
      .map(([key, value]) => `${key}: ${String(value)}`);
    items.push({
      id: `action_narrative_${situation.id}`,
      category: "narrative",
      severity,
      title: situation.title,
      what: situation.summary,
      why: situation.body,
      evidence,
      href,
      hrefLabel: primaryAction?.label ?? "Review situation",
    });
  }
  return items;
}

export function buildSituationsView(
  state: GameState,
): OwnerDashboardSituationView[] {
  return getActiveOwnedFranchise(state)
    .narrative.situations.filter(
      (situation) =>
        situation.status === "active" ||
        situation.status === "acknowledged" ||
        situation.status === "escalated",
    )
    .map((situation) => ({
      id: situation.id,
      detectorKey: situation.detectorKey,
      category: situation.category,
      severity: situation.severity,
      status: situation.status,
      title: situation.title,
      summary: situation.summary,
      body: situation.body,
      updatedOn: situation.updatedOn,
      evidence: { ...situation.evidence },
      actions: (situation.actions ?? []).map((action) => ({
        id: action.id,
        label: action.label,
        ...(action.href ? { href: action.href } : {}),
        ...(action.effectSummary
          ? { effectSummary: action.effectSummary }
          : {}),
      })),
    }));
}

function sortAndCapActionItems(
  items: OwnerDashboardActionItem[],
  calendar: CalendarContext,
): OwnerDashboardActionItem[] {
  const boost = calendarBoostCategories(calendar);
  const criticalFirst = items.filter(
    (i) =>
      i.severity === "critical" ||
      i.category === "draft" ||
      i.category === "calendar",
  );
  const rest = items
    .filter((i) => !criticalFirst.includes(i))
    .sort((a, b) => {
      const aBoost = boost.has(a.category) ? 0 : 1;
      const bBoost = boost.has(b.category) ? 0 : 1;
      if (aBoost !== bBoost) {
        return aBoost - bBoost;
      }
      const sev = SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity];
      if (sev !== 0) {
        return sev;
      }
      const cat = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
      if (cat !== 0) {
        return cat;
      }
      return a.id.localeCompare(b.id);
    });
  const criticalSorted = [...criticalFirst].sort((a, b) => {
    const sev = SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity];
    if (sev !== 0) {
      return sev;
    }
    return CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
  });
  // Deduplicate by id while preserving order.
  const seen = new Set<string>();
  const ordered: OwnerDashboardActionItem[] = [];
  for (const item of [...criticalSorted, ...rest]) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    ordered.push(item);
  }
  return ordered.slice(0, ACTION_QUEUE_CAP);
}

function calendarBoostCategories(
  calendar: CalendarContext,
): Set<OwnerDashboardActionCategory> {
  const boost = new Set<OwnerDashboardActionCategory>(["calendar"]);
  if (calendar.deadlineWindow) {
    boost.add("roster");
    boost.add("contracts");
    boost.add("team");
  }
  if (
    calendar.lifecyclePhase === "offseason" ||
    calendar.lifecyclePhase === "postseason"
  ) {
    boost.add("free_agency");
    boost.add("draft");
    boost.add("contracts");
    boost.add("staff");
    boost.add("facilities");
    boost.add("sponsorship");
    boost.add("marketing");
  }
  if (
    calendar.lifecyclePhase === "regular" &&
    calendar.seasonSegment === "early"
  ) {
    boost.add("attendance");
    boost.add("marketing");
    boost.add("team");
  }
  return boost;
}
