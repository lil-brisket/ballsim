/**
 * Action Center presentation layer.
 * Maps existing owner-dashboard action items + phase unresolved decisions
 * into a future-proof shape (priority / urgency / deadline / relevance).
 * Does not invent actions — only transforms game-backed items.
 */

import { ACTION_QUEUE_CAP } from "@/state/owner-dashboard-config";
import type {
  OwnerDashboardActionCategory,
  OwnerDashboardActionItem,
  OwnerDashboardActionSeverity,
} from "@/state/owner-dashboard";
import type {
  PhaseResponsibility,
  UnresolvedDecision,
} from "@/systems/simulation/phase-responsibility";
import {
  addCalendarDays,
  calendarDaysBetween,
} from "@/domain/calendar-date";

export type ActionCenterUrgency = "immediate" | "soon" | "routine";
export type ActionCenterRelevance = "team" | "franchise" | "league";

export type ActionCenterEntityRef = {
  kind: "player" | "team";
  id: string;
  label: string;
};

export type ActionCenterItem = {
  id: string;
  /** Lower = more important (explicit rank for future scoring). */
  priority: number;
  severity: OwnerDashboardActionSeverity;
  category: OwnerDashboardActionCategory | "phase";
  urgency: ActionCenterUrgency;
  deadline: string | null;
  relevance: ActionCenterRelevance;
  title: string;
  description: string;
  entity?: ActionCenterEntityRef;
  href: string;
  hrefLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export type ActionCenterView = {
  items: ActionCenterItem[];
  hasUrgentActions: boolean;
  focalMode: "actions" | "next-game";
  urgentCount: number;
};

const SEVERITY_PRIORITY: Record<OwnerDashboardActionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/** Categories that belong on Team Hub decisions, not just Front Office. */
const TEAM_DECISION_CATEGORIES = new Set<string>([
  "team",
  "roster",
  "contracts",
  "staff",
  "calendar",
  "phase",
]);

const CATEGORY_BASE_PRIORITY: Partial<
  Record<OwnerDashboardActionCategory | "phase", number>
> = {
  draft: 10,
  calendar: 20,
  contracts: 30,
  free_agency: 40,
  roster: 50,
  team: 60,
  staff: 70,
  financial: 80,
  narrative: 90,
  notifications: 100,
  phase: 15,
};

function deriveUrgency(
  severity: OwnerDashboardActionSeverity,
  deadline: string | null,
  currentDate: string,
): ActionCenterUrgency {
  if (deadline) {
    const days = calendarDaysBetween(currentDate, deadline);
    if (days <= 0) return "immediate";
    if (days <= 3) return "soon";
  }
  if (severity === "critical") return "immediate";
  if (severity === "warning") return "soon";
  return "routine";
}

function deriveRelevance(
  category: OwnerDashboardActionCategory | "phase",
): ActionCenterRelevance {
  switch (category) {
    case "team":
    case "roster":
    case "contracts":
    case "staff":
    case "calendar":
      return "team";
    case "draft":
    case "free_agency":
    case "financial":
    case "attendance":
    case "facilities":
    case "marketing":
    case "sponsorship":
    case "relocation":
    case "narrative":
    case "notifications":
    case "phase":
      return "franchise";
    default:
      return "franchise";
  }
}

function extractDeadlineHint(
  item: OwnerDashboardActionItem,
  currentDate: string,
  daysUntilTradeDeadline: number | null,
): string | null {
  if (item.category === "calendar" && daysUntilTradeDeadline !== null) {
    if (
      item.id.includes("trade") ||
      item.title.toLowerCase().includes("trade deadline")
    ) {
      return addCalendarDays(currentDate, daysUntilTradeDeadline);
    }
  }
  for (const line of item.evidence) {
    const match = /(\d{4}-\d{2}-\d{2})/.exec(line);
    if (match) return match[1]!;
  }
  return null;
}

function basePriority(
  category: OwnerDashboardActionCategory | "phase",
  severity: OwnerDashboardActionSeverity,
): number {
  const cat = CATEGORY_BASE_PRIORITY[category] ?? 150;
  return cat + SEVERITY_PRIORITY[severity];
}

function compareActionCenterItems(a: ActionCenterItem, b: ActionCenterItem): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.deadline && b.deadline) {
    const cmp = a.deadline.localeCompare(b.deadline);
    if (cmp !== 0) return cmp;
  } else if (a.deadline && !b.deadline) {
    return -1;
  } else if (!a.deadline && b.deadline) {
    return 1;
  }
  const sev = SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity];
  if (sev !== 0) return sev;
  const urgencyOrder: Record<ActionCenterUrgency, number> = {
    immediate: 0,
    soon: 1,
    routine: 2,
  };
  return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
}

export function mapOwnerActionToCenterItem(
  item: OwnerDashboardActionItem,
  currentDate: string,
  daysUntilTradeDeadline: number | null = null,
): ActionCenterItem {
  const deadline = extractDeadlineHint(
    item,
    currentDate,
    daysUntilTradeDeadline,
  );
  const severity = item.severity;
  return {
    id: item.id,
    priority: basePriority(item.category, severity),
    severity,
    category: item.category,
    urgency: deriveUrgency(severity, deadline, currentDate),
    deadline,
    relevance: deriveRelevance(item.category),
    title: item.title,
    description: item.what,
    href: item.href,
    hrefLabel: item.hrefLabel,
  };
}

export function mapUnresolvedToCenterItem(
  item: UnresolvedDecision,
  saveId: string,
  currentDate: string,
): ActionCenterItem {
  const severity = item.severity;
  const href =
    item.domain === "draft"
      ? `/dashboard/${saveId}/draft`
      : item.domain === "staffHiring"
        ? `/dashboard/${saveId}/staff-coaching`
        : `/dashboard/${saveId}/calendar`;
  return {
    id: `phase-${item.id}`,
    priority: basePriority("phase", severity),
    severity,
    category: "phase",
    urgency: deriveUrgency(severity, null, currentDate),
    deadline: null,
    relevance: "franchise",
    title: item.title,
    description: item.detail,
    href,
    hrefLabel: "Review",
  };
}

export function buildActionCenterView(input: {
  actionItems: OwnerDashboardActionItem[];
  phaseResponsibility?: PhaseResponsibility | null;
  currentDate: string;
  saveId: string;
  daysUntilTradeDeadline?: number | null;
  cap?: number;
}): ActionCenterView {
  const cap = input.cap ?? ACTION_QUEUE_CAP;
  const items: ActionCenterItem[] = [];

  for (const unresolved of input.phaseResponsibility?.unresolvedItems ?? []) {
    items.push(
      mapUnresolvedToCenterItem(
        unresolved,
        input.saveId,
        input.currentDate,
      ),
    );
  }

  for (const action of input.actionItems) {
    items.push(
      mapOwnerActionToCenterItem(
        action,
        input.currentDate,
        input.daysUntilTradeDeadline ?? null,
      ),
    );
  }

  // Deduplicate by id (phase items use phase- prefix).
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  unique.sort(compareActionCenterItems);
  const capped = unique.slice(0, cap);

  const urgentCount = capped.filter(
    (item) => item.severity === "critical" || item.severity === "warning",
  ).length;
  const hasUrgentActions = urgentCount > 0;

  return {
    items: capped,
    hasUrgentActions,
    focalMode: hasUrgentActions ? "actions" : "next-game",
    urgentCount,
  };
}

/** Compact team-relevant decisions for Team Hub (not a second Action Center). */
export function filterTeamDecisions(
  items: ActionCenterItem[],
  limit = 5,
): ActionCenterItem[] {
  return items
    .filter(
      (item) =>
        TEAM_DECISION_CATEGORIES.has(item.category) ||
        item.relevance === "team",
    )
    .slice(0, limit);
}
