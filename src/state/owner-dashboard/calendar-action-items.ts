import type { CalendarContext } from "@/systems/simulation/calendar-context";
import { asTeamId } from "@/domain/ids";
import { isContractActive } from "@/domain/entities/contract";
import { getTeamCapSpace } from "@/systems/salary-cap";
import { assessRelocation } from "@/state/relocation-assessment";
import type {
  CanonicalDashboardData,
  OwnerDashboardHealth,
  OwnerDashboardTeam,
  OwnerDashboardActionItem,
} from "@/state/owner-dashboard/types";
import { formatCompactMoney } from "@/state/owner-dashboard/metrics";

export function buildCalendarActionItems(
  data: CanonicalDashboardData,
  health: OwnerDashboardHealth,
  team: OwnerDashboardTeam,
  calendar: CalendarContext,
): OwnerDashboardActionItem[] {
  const saveId = data.saveId;
  const items: OwnerDashboardActionItem[] = [];
  const teamId = asTeamId(data.teamId);
  const year = data.year;

  if (calendar.lifecyclePhase === "postseason") {
    items.push({
      id: "action_season_review",
      category: "calendar",
      severity: "critical",
      title: "Season review",
      what:
        calendar.seasonStory ||
        "Review the season before opening the offseason.",
      why: "Ownership evaluation and offseason decisions start after you acknowledge this review.",
      evidence: [
        `Record: ${team.wins}–${team.losses}`,
        `Net income: ${formatCompactMoney(health.netIncome)}`,
      ],
      href: `/dashboard/${saveId}`,
      hrefLabel: "Begin Offseason",
    });
  }

  if (calendar.deadlineWindow && calendar.tradesOpen) {
    const days = calendar.daysUntilTradeDeadline ?? 0;
    items.push({
      id: "action_trade_deadline",
      category: "calendar",
      severity: days <= 3 ? "critical" : "warning",
      title: "Trade deadline",
      what: `Trade deadline in ${days} day${days === 1 ? "" : "s"}.`,
      why: "This is the last meaningful window to reshape the roster before the deadline.",
      evidence: [
        calendar.playoffRace !== "not_applicable"
          ? `Playoff race: ${calendar.playoffRace}`
          : `Record: ${team.wins}–${team.losses}`,
        `Games remaining (league): ${calendar.gamesRemaining}`,
      ],
      href: `/dashboard/${saveId}/media?tab=transactions`,
      hrefLabel: "Open Transactions",
    });
  }

  if (calendar.lifecyclePhase === "offseason") {
    if (calendar.offseasonStage === "free_agency") {
      items.push({
        id: "action_free_agency",
        category: "free_agency",
        severity: "critical",
        title: "Free agency open",
        what: "Shape next season's roster while free agency is open.",
        why: "AI teams are signing; finishing free agency advances to the draft.",
        evidence: calendar.offseasonPriorities.map(String),
        href: `/dashboard/${saveId}/free-agency`,
        hrefLabel: "Open Free Agency",
      });
    }
    if (calendar.offseasonStage === "draft") {
      items.push({
        id: "action_draft_stage",
        category: "draft",
        severity: "warning",
        title: "Draft in progress",
        what: "The draft board is active.",
        why: "Prospect selection locks in long-term roster construction.",
        evidence: ["Offseason stage: draft"],
        href: `/dashboard/${saveId}/draft`,
        hrefLabel: "Open Draft",
      });
    }
  }

  const expiring = Object.values(data.state.business.contracts).filter(
    (contract) =>
      contract.teamId === teamId &&
      isContractActive(contract, year) &&
      contract.endYear <= year + 1,
  );
  if (
    (calendar.lifecyclePhase === "offseason" || calendar.deadlineWindow) &&
    expiring.length > 0
  ) {
    items.push({
      id: "action_contracts",
      category: "contracts",
      severity: "warning",
      title: "Contracts expiring",
      what: `${expiring.length} contract${expiring.length === 1 ? "" : "s"} end within the next season.`,
      why: "Salary commitments and roster continuity need an owner decision.",
      evidence: expiring.slice(0, 3).map((c) => `Ends ${c.endYear}`),
      href: `/dashboard/${saveId}/team/contracts`,
      hrefLabel: "Review Contracts",
    });
  }

  if (calendar.deadlineWindow) {
    const capEnabled = data.state.settings.financialRules.salaryCapEnabled;
    if (capEnabled) {
      const capSpace = getTeamCapSpace(teamId, year, data.state);
      if (Number.isFinite(capSpace)) {
        items.push({
          id: "action_cap_deadline",
          category: "calendar",
          severity: "info",
          title: "Cap flexibility",
          what: `About ${formatCompactMoney(capSpace)} in cap space available.`,
          why: "Deadline deals need legal salary matching and space.",
          evidence: [`Cap space: ${formatCompactMoney(capSpace)}`],
          href: `/dashboard/${saveId}/team/contracts`,
          hrefLabel: "Review Cap",
        });
      }
    }
  }

  if (
    calendar.lifecyclePhase === "offseason" &&
    calendar.offseasonPriorities.includes("facilities")
  ) {
    items.push({
      id: "action_offseason_facilities",
      category: "facilities",
      severity: "info",
      title: "Offseason facility planning",
      what: "Capital investment windows are strongest in the offseason.",
      why: "Facility levels affect development, capacity, and franchise value next season.",
      evidence: data.facilities
        .slice(0, 2)
        .map((f) => `${f.category}: L${f.level}`),
      href: `/dashboard/${saveId}/facilities`,
      hrefLabel: "Manage Facilities",
    });
  }

  if (
    calendar.offseasonPriorities.includes("relocation") ||
    calendar.lifecyclePhase === "offseason" ||
    calendar.lifecyclePhase === "postseason"
  ) {
    const relocAssessment = assessRelocation(data.state);
    if (
      relocAssessment.status === "consider" ||
      relocAssessment.status === "strong_case" ||
      relocAssessment.status === "in_progress"
    ) {
      items.push({
        id: "action_relocation",
        category: "relocation",
        severity: relocAssessment.status === "strong_case" ? "warning" : "info",
        title:
          relocAssessment.status === "in_progress"
            ? "Relocation in progress"
            : "Relocation opportunity",
        what:
          relocAssessment.primaryDrivers[0] ??
          "Market and franchise conditions make relocation a legitimate option.",
        why:
          relocAssessment.stayAdvantages[0] ??
          "Compare staying and investing versus paying the cost to move.",
        evidence: [
          `Status: ${relocAssessment.status}`,
          `Basketball: ${relocAssessment.basketballHealth}`,
          `Business: ${relocAssessment.businessHealth}`,
        ],
        href: `/dashboard/${saveId}/relocation`,
        hrefLabel: "Review Stay vs Move",
      });
    }
  }

  return items;
}
