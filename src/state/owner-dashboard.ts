import type { FinancialHealthState } from "@/systems/financial-health";
import { POOR_ATTENDANCE_FILL_RATE_PCT } from "@/systems/owner-objectives-config";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";
import { STARTER_ROLES } from "@/systems/staff-generation";
import { getFinancialStatement } from "@/systems/team-finances";
import {
  TICKET_PRICE_MAX,
  TICKET_PRICE_MIN,
} from "@/systems/ticket-pricing";
import type { TeamId } from "@/domain/ids";
import { asTeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  calculateFranchiseHealth,
  type FranchiseHealthView,
} from "@/state/franchise-health";
import {
  toOwnerCareerEvaluation,
  type OwnerCareerEvaluation,
} from "@/state/owner-career-evaluation";
import {
  toOwnershipConfidenceView,
  type OwnershipConfidenceView,
} from "@/state/ownership-confidence-view";
import {
  toFacilitiesView,
  toFranchiseBusinessView,
  toSponsorshipsView,
  toStaffView,
  type FranchiseBusinessView,
  type LastGameDayView,
} from "@/state/franchise-selectors";
import type {
  FranchiseStanding,
  FranchiseValueDriverKey,
} from "@/state/franchise-value";
import { calculateFranchiseValue } from "@/state/franchise-value";
import { assessRelocation } from "@/state/relocation-assessment";
import { getCachedAnnualReport } from "@/systems/franchise-report";
import { activeGameplayMilestones } from "@/systems/historical-milestones";
import { currentFranchiseEra } from "@/systems/franchise-eras";
import {
  ACTION_QUEUE_CAP,
  DASHBOARD_ACTIVITY_CAP,
  DASHBOARD_NOTIFICATION_CAP,
  DASHBOARD_UPCOMING_GAMES_LIMIT,
  MARKETING_INSIGHT_MIN_AWARENESS,
  PAYROLL_VS_LEAGUE_HIGH_PCT,
  STRENGTH_VS_LEAGUE_HIGH_PCT,
  TEAM_PERFORMANCE_MIN_GAMES,
  TICKET_PRICE_VS_LEAGUE_HIGH_PCT,
} from "@/state/owner-dashboard-config";
import { meanRosterOverall } from "@/state/roster-strength";
import {
  toDashboardSnapshot,
  toEventLogView,
  toNotificationsView,
  toRosterView,
  type EventLogEntryView,
  type NotificationView,
  type ObjectiveView,
  type ScheduleGameView,
} from "@/state/selectors";
import {
  getCalendarContext,
  type CalendarContext,
} from "@/systems/simulation/calendar-context";
import {
  resolveSimulationPhase,
  type SimulationPhaseContext,
} from "@/systems/simulation/simulation-phase";
import {
  computePhaseResponsibility,
  type PhaseResponsibility,
} from "@/systems/simulation/phase-responsibility";
import { isContractActive } from "@/domain/entities/contract";
import { derivePlayoffResults } from "@/systems/franchise-history";

export type OwnerDashboardActionSeverity = "critical" | "warning" | "info";

export type OwnerDashboardActionCategory =
  | "draft"
  | "financial"
  | "attendance"
  | "team"
  | "roster"
  | "staff"
  | "facilities"
  | "marketing"
  | "sponsorship"
  | "notifications"
  | "calendar"
  | "contracts"
  | "free_agency"
  | "relocation"
  | "narrative";

export type OwnerDashboardActionItem = {
  id: string;
  category: OwnerDashboardActionCategory;
  severity: OwnerDashboardActionSeverity;
  title: string;
  what: string;
  why: string;
  evidence: string[];
  href: string;
  hrefLabel: string;
};

export type OwnerDashboardInsight = {
  id: string;
  text: string;
};

export type OwnerDashboardMetricContext = {
  /** Secondary interpretive line; never a fake "this month" label. */
  text: string;
  direction?: "up" | "down" | "flat";
};

export type OwnerDashboardHealth = {
  cash: number;
  revenue: number;
  expenses: number;
  netIncome: number;
  franchiseValue: number;
  franchiseStanding: FranchiseStanding;
  topPositiveDriver: FranchiseValueDriverKey | null;
  topNegativeDriver: FranchiseValueDriverKey | null;
  financialHealth: FinancialHealthState;
  cashContext: OwnerDashboardMetricContext | null;
  attendance: number | null;
  attendanceFillRatePct: number | null;
  attendanceTrend: OwnerDashboardMetricContext | null;
  ticketPrice: number;
  ticketPriceVsLeaguePct: number | null;
  fanSentiment: number;
  franchiseReputation: number;
  marketSize: number;
  awareness: number;
  /** Six-dimension Franchise Health analytical layer. */
  franchiseHealth: FranchiseHealthView;
};

export type OwnerDashboardRosterProblem = {
  playerId: string;
  name: string;
  kind: string;
};

export type OwnerDashboardTeam = {
  wins: number;
  losses: number;
  leagueRank: number;
  conferenceRank: number | null;
  conferenceName: string | null;
  strength: number;
  payroll: number;
  payrollVsLeaguePct: number | null;
  rosterProblems: OwnerDashboardRosterProblem[];
  upcomingGames: ScheduleGameView[];
};

export type OwnerDashboardOwner = {
  philosophy: string;
  patience: number;
  objectives: ObjectiveView[];
  primaryObjectives: ObjectiveView[];
  secondaryObjectives: ObjectiveView[];
  longTermObjectives: ObjectiveView[];
  completedObjectives: ObjectiveView[];
  failedObjectives: ObjectiveView[];
  priorities: string[];
  franchiseReputation: number;
  career: OwnerCareerEvaluation;
  ownership: OwnershipConfidenceView;
};

export type OwnerDashboardFlags = {
  userOnDraftClock: boolean;
  hasLastGameDay: boolean;
  hasUpcomingGames: boolean;
  isNewFranchise: boolean;
  /** Season Review checkpoint — time advance blocked until beginOffseason. */
  seasonReviewPending: boolean;
};

export type OwnerDashboardSeasonRecap = {
  record: string;
  playoffResult: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  cash: number;
  franchiseValue: number;
  completedObjectives: number;
  failedObjectives: number;
  story: string;
};

export type OwnerDashboardSituationView = {
  id: string;
  detectorKey: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  body: string;
  updatedOn: string;
  evidence: Record<string, number | boolean | string>;
  actions: { id: string; label: string; href?: string; effectSummary?: string }[];
};

export type OwnerDashboardView = {
  saveId: string;
  currentDate: string;
  seasonPhase: string;
  offseasonStage: string;
  calendarDisplayLabel: string;
  seasonSegment: string;
  seasonStory: string;
  tradesOpen: boolean;
  daysUntilTradeDeadline: number | null;
  offseasonPriorities: readonly string[];
  seasonRecap: OwnerDashboardSeasonRecap | null;
  /** Latest cached annual report for the controlled team, if any. */
  annualReport: import("@/domain/entities/annual-franchise-report").AnnualFranchiseReport | null;
  /** Active historical milestones (approaching / projected / achieved this season). */
  historicalMilestones: import("@/domain/entities/historical-milestone").MilestoneResult[];
  /** Current franchise era, if detectable. */
  currentEra: import("@/domain/entities/franchise-era").FranchiseEra | null;
  leagueName: string;
  controlledTeam: {
    id: string;
    city: string;
    name: string;
    abbreviation: string;
  };
  simulationFrequency: "daily" | "weekly";
  health: OwnerDashboardHealth;
  team: OwnerDashboardTeam;
  owner: OwnerDashboardOwner;
  actionItems: OwnerDashboardActionItem[];
  insights: OwnerDashboardInsight[];
  notifications: NotificationView[];
  activity: EventLogEntryView[];
  flags: OwnerDashboardFlags;
  situations: OwnerDashboardSituationView[];
  simulationPhase: SimulationPhaseContext;
  phaseResponsibility: PhaseResponsibility;
};

type CanonicalDashboardData = {
  state: GameState;
  saveId: string;
  teamId: string;
  year: number;
  snapshot: ReturnType<typeof toDashboardSnapshot>;
  business: FranchiseBusinessView;
  statement: ReturnType<typeof getFinancialStatement>;
  payroll: number;
  strength: number;
  leagueMeanTicketPrice: number | null;
  ticketPriceVsLeaguePct: number | null;
  leagueMeanPayroll: number | null;
  payrollVsLeaguePct: number | null;
  leagueMeanStrength: number | null;
  strengthVsLeaguePct: number | null;
  homeGameDays: LastGameDayView[];
  attendanceTrendPct: number | null;
  conference: { name: string; rank: number } | null;
  rosterProblems: OwnerDashboardRosterProblem[];
  vacantStarterRoles: string[];
  hasFacilityUpgradeAvailable: boolean;
  hasActiveSponsorship: boolean;
  staff: ReturnType<typeof toStaffView>;
  facilities: ReturnType<typeof toFacilitiesView>;
  sponsorships: ReturnType<typeof toSponsorshipsView>;
};

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

const ACTIVITY_TYPES = new Set([
  "StaffHired",
  "StaffFired",
  "FacilityUpgradeStarted",
  "FacilityUpgradeCompleted",
  "SponsorshipSigned",
  "SponsorshipExpired",
  "HomeGameDaySettled",
  "ContractSigned",
  "FreeAgentSigned",
  "PlayerTraded",
  "PlayerReleased",
  "CoachHired",
]);

/**
 * Owner Decision Center view-model. Presentation only — consumes existing
 * selectors and systems; does not recompute franchise value, statements,
 * demand, or financial health.
 */
export function toOwnerDashboardView(state: GameState): OwnerDashboardView {
  const canonical = readCanonical(state);
  const health = buildHealth(canonical);
  const team = buildTeam(canonical);
  const notifications = buildNotifications(state);
  const activity = buildActivity(state);
  const calendar = getCalendarContext(state);
  const simulationPhase = resolveSimulationPhase(state);
  const phaseResponsibility = computePhaseResponsibility(state);
  const actionItems = buildActionItems(canonical, health, team, calendar);
  const insights = buildInsights(canonical, health, team);
  const owner = buildOwner(canonical, actionItems, health);
  const flags = buildFlags(canonical);
  const situations = buildSituationsView(state);
  const seasonRecap =
    calendar.lifecyclePhase === "postseason"
      ? buildSeasonRecap(canonical, health, calendar)
      : null;

  const teamId = asTeamId(canonical.teamId);
  const history =
    state.business.franchiseHistory[teamId]?.seasons ?? [];
  const standing = state.competition.standings.byTeamId[teamId];
  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const games = wins + losses;
  const projectedWins =
    games > 0
      ? Math.round((wins / games) * state.settings.league.gamesPerTeam)
      : null;
  const historicalMilestones = activeGameplayMilestones(history, {
    seasonYear: canonical.year,
    wins,
    losses,
    projectedWins,
    attendanceToDate:
      state.business.finances[teamId]?.attendanceByYear[String(canonical.year)] ??
      null,
    projectedAttendance: null,
    franchiseValue: calculateFranchiseValue(state, teamId),
    netIncome: health.netIncome,
    playoffClinched: false,
    championshipWon: false,
    hasRelocatedBefore: history.some((s) => s.relocated),
    seasonsSinceRelocation: null,
  });
  const annualReport = getCachedAnnualReport(state, teamId);
  const currentEra = currentFranchiseEra(history, {
    foundedSeasonYear:
      state.business.franchiseOps[teamId]?.foundedSeasonYear,
  });

  // Surface top historical milestones as insights
  for (const milestone of historicalMilestones.slice(0, 2)) {
    insights.unshift({
      id: `insight_milestone_${milestone.kind}`,
      text: milestone.message,
    });
  }
  if (currentEra) {
    insights.unshift({
      id: "insight_era",
      text: `Current era: ${currentEra.label} (${currentEra.strength}, ${(currentEra.confidence * 100).toFixed(0)}% confidence).`,
    });
  }

  return {
    saveId: canonical.saveId,
    currentDate: canonical.snapshot.currentDate,
    seasonPhase: canonical.snapshot.seasonPhase,
    offseasonStage: canonical.snapshot.offseasonStage,
    calendarDisplayLabel: calendar.displayLabel,
    seasonSegment: calendar.seasonSegment,
    seasonStory: calendar.seasonStory,
    tradesOpen: calendar.tradesOpen,
    daysUntilTradeDeadline: calendar.daysUntilTradeDeadline,
    offseasonPriorities: calendar.offseasonPriorities,
    seasonRecap,
    annualReport,
    historicalMilestones,
    currentEra,
    leagueName: canonical.snapshot.leagueName,
    controlledTeam: canonical.snapshot.controlledTeam,
    simulationFrequency: canonical.snapshot.simulationFrequency,
    health,
    team,
    owner,
    actionItems,
    insights,
    notifications,
    activity,
    flags,
    situations,
    simulationPhase,
    phaseResponsibility,
  };
}

function readCanonical(state: GameState): CanonicalDashboardData {
  const teamId = state.user.controlledTeamId;
  const year = state.competition.season.year;
  const snapshot = toDashboardSnapshot(state);
  const business = toFranchiseBusinessView(state);
  const statement = getFinancialStatement(state, teamId, year);
  const payroll = getTeamPayroll(teamId, year, state);
  const strength = meanRosterOverall(state, teamId);

  const leagueMeanTicketPrice = meanValidTicketPrices(state);
  const ticketPriceVsLeaguePct =
    leagueMeanTicketPrice !== null && leagueMeanTicketPrice > 0
      ? pctAbove(business.ticketPrice, leagueMeanTicketPrice)
      : null;

  const leagueMeanPayroll = meanLeaguePayroll(state, year);
  const payrollVsLeaguePct =
    leagueMeanPayroll !== null && leagueMeanPayroll > 0
      ? pctAbove(payroll, leagueMeanPayroll)
      : null;

  const leagueMeanStrength = meanLeagueStrength(state);
  const strengthVsLeaguePct =
    leagueMeanStrength !== null && leagueMeanStrength > 0
      ? pctAbove(strength, leagueMeanStrength)
      : null;

  const homeGameDays = readHomeGameDays(state, teamId);
  const attendanceTrendPct = computeAttendanceTrendPct(homeGameDays);
  const conference = computeConferenceStanding(state, teamId);
  const rosterProblems = collectRosterProblems(state);
  const staff = toStaffView(state);
  const vacantStarterRoles = findVacantStarterRoles(staff);
  const facilities = toFacilitiesView(state);
  const hasFacilityUpgradeAvailable = facilities.some(
    (row) => row.upgradeCost !== null,
  );
  const sponsorships = toSponsorshipsView(state);
  const hasActiveSponsorship = sponsorships.some((s) => s.status === "active");

  return {
    state,
    saveId: state.meta.saveId,
    teamId,
    year,
    snapshot,
    business,
    statement,
    payroll,
    strength,
    leagueMeanTicketPrice,
    ticketPriceVsLeaguePct,
    leagueMeanPayroll,
    payrollVsLeaguePct,
    leagueMeanStrength,
    strengthVsLeaguePct,
    homeGameDays,
    attendanceTrendPct,
    conference,
    rosterProblems,
    vacantStarterRoles,
    hasFacilityUpgradeAvailable,
    hasActiveSponsorship,
    staff,
    facilities,
    sponsorships,
  };
}

function buildHealth(data: CanonicalDashboardData): OwnerDashboardHealth {
  const { business, statement, snapshot, attendanceTrendPct } = data;
  const last = business.lastGameDay;
  const runway = business.cashRunway;

  let cashContext: OwnerDashboardMetricContext | null = null;
  if (runway.netWeeklyBurn > 0) {
    cashContext = {
      text:
        runway.runwayWeeks !== null
          ? `Net weekly burn ${formatCompactMoney(runway.netWeeklyBurn)} · ~${runway.runwayWeeks} weeks runway`
          : `Net weekly burn ${formatCompactMoney(runway.netWeeklyBurn)}`,
      direction: "down",
    };
  } else if (runway.netWeeklyBurn < 0) {
    cashContext = {
      text: `Net weekly surplus ${formatCompactMoney(-runway.netWeeklyBurn)}`,
      direction: "up",
    };
  } else {
    cashContext = {
      text: "Weekly cash flow roughly balanced",
      direction: "flat",
    };
  }

  let attendanceTrend: OwnerDashboardMetricContext | null = null;
  if (attendanceTrendPct !== null) {
    const abs = Math.abs(Math.round(attendanceTrendPct));
    if (attendanceTrendPct < -0.5) {
      attendanceTrend = {
        text: `Down ${abs}% vs prior home game`,
        direction: "down",
      };
    } else if (attendanceTrendPct > 0.5) {
      attendanceTrend = {
        text: `Up ${abs}% vs prior home game`,
        direction: "up",
      };
    } else {
      attendanceTrend = {
        text: "Flat vs prior home game",
        direction: "flat",
      };
    }
  }

  return {
    cash: snapshot.cash,
    revenue: statement.revenue.total,
    expenses: statement.expenses.total,
    netIncome: statement.netIncome,
    franchiseValue: business.franchiseValue,
    franchiseStanding: business.franchiseStanding,
    topPositiveDriver: business.franchiseValueBreakdown.topPositiveDriver,
    topNegativeDriver: business.franchiseValueBreakdown.topNegativeDriver,
    financialHealth: runway.health,
    cashContext,
    attendance: last?.attendance ?? null,
    attendanceFillRatePct: last?.fillRatePct ?? null,
    attendanceTrend,
    ticketPrice: business.ticketPrice,
    ticketPriceVsLeaguePct: data.ticketPriceVsLeaguePct,
    fanSentiment: business.fanSentiment,
    franchiseReputation: business.reputation,
    marketSize: business.marketSize,
    awareness: business.awareness,
    franchiseHealth: calculateFranchiseHealth(data.state),
  };
}

function buildTeam(data: CanonicalDashboardData): OwnerDashboardTeam {
  const { snapshot, conference, strength, payroll, rosterProblems } = data;
  return {
    wins: snapshot.controlledStanding.wins,
    losses: snapshot.controlledStanding.losses,
    leagueRank: snapshot.standingsRank,
    conferenceRank: conference?.rank ?? null,
    conferenceName: conference?.name ?? null,
    strength: Math.round(strength * 10) / 10,
    payroll,
    payrollVsLeaguePct: data.payrollVsLeaguePct,
    rosterProblems,
    upcomingGames: snapshot.upcomingGames.slice(
      0,
      DASHBOARD_UPCOMING_GAMES_LIMIT,
    ),
  };
}

function buildOwner(
  data: CanonicalDashboardData,
  _actionItems: OwnerDashboardActionItem[],
  _health: OwnerDashboardHealth,
): OwnerDashboardOwner {
  const objectives = data.snapshot.objectives;
  const active = objectives.filter((objective) => objective.status === "active");
  const ownership = toOwnershipConfidenceView(data.state);
  return {
    philosophy: data.state.user.ownerPhilosophy,
    patience: data.state.user.ownerPatience,
    objectives,
    primaryObjectives: active.filter((objective) => objective.role === "primary"),
    secondaryObjectives: active.filter(
      (objective) => objective.role === "secondary",
    ),
    longTermObjectives: active.filter(
      (objective) =>
        objective.role === "long_term" ||
        objective.lifecycle === "career" ||
        objective.lifecycle === "multi_season" ||
        objective.lifecycle === "milestone",
    ),
    completedObjectives: objectives.filter(
      (objective) => objective.status === "completed",
    ),
    failedObjectives: objectives.filter(
      (objective) => objective.status === "failed",
    ),
    priorities: ownership.priorityBullets,
    franchiseReputation: data.business.reputation,
    career: toOwnerCareerEvaluation(data.state),
    ownership,
  };
}

function buildNotifications(state: GameState): NotificationView[] {
  const all = toNotificationsView(state);
  const unreadFirst = [...all].sort((a, b) => {
    if (a.read !== b.read) {
      return a.read ? 1 : -1;
    }
    return severityRank(a.severity) - severityRank(b.severity);
  });
  return unreadFirst.slice(0, DASHBOARD_NOTIFICATION_CAP);
}

function buildActivity(state: GameState): EventLogEntryView[] {
  return toEventLogView(state, DASHBOARD_ACTIVITY_CAP * 3)
    .filter((entry) => ACTIVITY_TYPES.has(entry.type))
    .slice(0, DASHBOARD_ACTIVITY_CAP);
}

function buildFlags(data: CanonicalDashboardData): OwnerDashboardFlags {
  return {
    userOnDraftClock: data.snapshot.userOnDraftClock,
    hasLastGameDay: data.business.lastGameDay !== null,
    hasUpcomingGames: data.snapshot.upcomingGames.length > 0,
    isNewFranchise:
      data.business.lastGameDay === null &&
      data.homeGameDays.length === 0 &&
      data.snapshot.controlledStanding.wins +
        data.snapshot.controlledStanding.losses ===
        0,
    seasonReviewPending: data.state.competition.season.phase === "postseason",
  };
}

function buildSeasonRecap(
  data: CanonicalDashboardData,
  health: OwnerDashboardHealth,
  calendar: CalendarContext,
): OwnerDashboardSeasonRecap {
  const teamId = asTeamId(data.teamId);
  const standing = data.snapshot.controlledStanding;
  const playoffMap = derivePlayoffResults(data.state);
  const playoffResult = playoffMap[teamId] ?? "missed";
  const completed = data.state.user.objectives.filter(
    (o) => o.status === "completed" && o.seasonYear === data.year,
  ).length;
  const failed = data.state.user.objectives.filter(
    (o) => o.status === "failed" && o.seasonYear === data.year,
  ).length;
  return {
    record: `${standing.wins}–${standing.losses}`,
    playoffResult,
    revenue: health.revenue,
    expenses: health.expenses,
    netIncome: health.netIncome,
    cash: health.cash,
    franchiseValue: calculateFranchiseValue(data.state, teamId),
    completedObjectives: completed,
    failedObjectives: failed,
    story: calendar.seasonStory,
  };
}

function buildActionItems(
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
  if (
    healthState === "warning" ||
    healthState === "critical" ||
    healthState === "insolvent"
  ) {
    const severity: OwnerDashboardActionSeverity =
      healthState === "warning" ? "warning" : "critical";
    const runway = data.business.cashRunway;
    items.push({
      id: "action_financial",
      category: "financial",
      severity,
      title:
        healthState === "insolvent"
          ? "Franchise insolvent"
          : "Financial pressure",
      what:
        healthState === "insolvent"
          ? "Cash reserves are at or below zero."
          : runway.netWeeklyBurn > 0
            ? "Cash reserves are under pressure while weekly operating burn remains positive."
            : "Financial health is in a warning or critical state.",
      why:
        healthState === "insolvent"
          ? "Capital spending is blocked and the franchise cannot operate normally until cash recovers."
          : "Continued pressure may constrain facility, marketing, and roster spending decisions.",
      evidence: [
        `Cash: ${formatCompactMoney(health.cash)}`,
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
      href: `/dashboard/${saveId}/staff`,
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
      href: `/dashboard/${saveId}/facilities`,
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
    (n) =>
      !n.read && (n.severity === "warning" || n.severity === "critical"),
  );
  if (importantUnread.length > 0) {
    const alreadyCovered =
      items.some((item) => item.category === "financial") ||
      items.some((item) => item.category === "attendance");
    if (!alreadyCovered) {
      items.push({
        id: "action_notifications",
        category: "notifications",
        severity:
          importantUnread.some((n) => n.severity === "critical")
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
  for (const situation of state.user.narrative.situations) {
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

function buildSituationsView(state: GameState): OwnerDashboardSituationView[] {
  return state.user.narrative.situations
    .filter(
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

function buildCalendarActionItems(
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
      what: calendar.seasonStory || "Review the season before opening the offseason.",
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
      href: `/dashboard/${saveId}/transactions`,
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
    (calendar.lifecyclePhase === "offseason" ||
      calendar.deadlineWindow) &&
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
      href: `/dashboard/${saveId}/contracts`,
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
          href: `/dashboard/${saveId}/contracts`,
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
      evidence: data.facilities.slice(0, 2).map((f) => `${f.category}: L${f.level}`),
      href: `/dashboard/${saveId}/facilities`,
      hrefLabel: "Manage Facilities",
    });
  }

  if (
    calendar.offseasonPriorities.includes("relocation") ||
    (calendar.lifecyclePhase === "offseason" ||
      calendar.lifecyclePhase === "postseason")
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
        severity:
          relocAssessment.status === "strong_case" ? "warning" : "info",
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

function buildInsights(
  data: CanonicalDashboardData,
  health: OwnerDashboardHealth,
  team: OwnerDashboardTeam,
): OwnerDashboardInsight[] {
  const insights: OwnerDashboardInsight[] = [];

  if (
    hasAttendanceProblem(data, health) &&
    isTicketPriceElevated(data) &&
    data.ticketPriceVsLeaguePct !== null
  ) {
    insights.push({
      id: "insight_pricing",
      text: `Attendance is soft while ticket prices sit ${Math.round(data.ticketPriceVsLeaguePct)}% above the league average — pricing may be contributing to weaker demand.`,
    });
  }

  if (hasMarketingInsight(data, health)) {
    insights.push({
      id: "insight_marketing",
      text: "Awareness is relatively high, but last-game attendance did not follow — marketing impact is worth reviewing.",
    });
  }

  if (hasTeamPayrollConcern(data, team)) {
    insights.push({
      id: "insight_team_payroll",
      text: "Team results have lagged while payroll remains among the higher group in the league — the payroll may not be matching on-court strength.",
    });
  }

  if (
    health.netIncome < 0 &&
    data.business.cashRunway.netWeeklyBurn > 0 &&
    (health.financialHealth === "warning" ||
      health.financialHealth === "critical" ||
      health.financialHealth === "insolvent")
  ) {
    insights.push({
      id: "insight_financial",
      text: "Expenses are outpacing revenue signals while cash reserves are under pressure — financial posture is worth reviewing.",
    });
  }

  return insights;
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
      const cat =
        CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
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
  if (calendar.lifecyclePhase === "regular" && calendar.seasonSegment === "early") {
    boost.add("attendance");
    boost.add("marketing");
    boost.add("team");
  }
  return boost;
}

function hasAttendanceProblem(
  data: CanonicalDashboardData,
  health: OwnerDashboardHealth,
): boolean {
  if (
    health.attendanceFillRatePct !== null &&
    health.attendanceFillRatePct < POOR_ATTENDANCE_FILL_RATE_PCT
  ) {
    return true;
  }
  if (data.attendanceTrendPct !== null && data.attendanceTrendPct < -0.5) {
    return true;
  }
  return false;
}

function isTicketPriceElevated(data: CanonicalDashboardData): boolean {
  return (
    data.ticketPriceVsLeaguePct !== null &&
    data.ticketPriceVsLeaguePct >= TICKET_PRICE_VS_LEAGUE_HIGH_PCT
  );
}

function hasMarketingInsight(
  data: CanonicalDashboardData,
  health: OwnerDashboardHealth,
): boolean {
  if (!data.business.lastGameDay) {
    return false;
  }
  if (health.awareness < MARKETING_INSIGHT_MIN_AWARENESS) {
    return false;
  }
  return (
    health.attendanceFillRatePct !== null &&
    health.attendanceFillRatePct < POOR_ATTENDANCE_FILL_RATE_PCT
  );
}

function hasTeamPayrollConcern(
  data: CanonicalDashboardData,
  team: OwnerDashboardTeam,
): boolean {
  const games = team.wins + team.losses;
  if (games < TEAM_PERFORMANCE_MIN_GAMES) {
    return false;
  }
  if (team.wins / games >= 0.5) {
    return false;
  }
  if (
    data.payrollVsLeaguePct === null ||
    data.payrollVsLeaguePct < PAYROLL_VS_LEAGUE_HIGH_PCT
  ) {
    return false;
  }
  if (
    data.strengthVsLeaguePct !== null &&
    data.strengthVsLeaguePct >= STRENGTH_VS_LEAGUE_HIGH_PCT
  ) {
    return false;
  }
  return true;
}

function attendanceWhat(
  data: CanonicalDashboardData,
  health: OwnerDashboardHealth,
): string {
  const parts: string[] = [];
  if (
    health.attendanceFillRatePct !== null &&
    health.attendanceFillRatePct < POOR_ATTENDANCE_FILL_RATE_PCT
  ) {
    parts.push(
      `Last home fill rate was ${health.attendanceFillRatePct}% (below ${POOR_ATTENDANCE_FILL_RATE_PCT}%).`,
    );
  }
  if (data.attendanceTrendPct !== null && data.attendanceTrendPct < -0.5) {
    parts.push(
      `Attendance is down ${Math.abs(Math.round(data.attendanceTrendPct))}% versus the prior home game.`,
    );
  }
  return parts.join(" ") || "Home attendance looks soft relative to capacity.";
}

function attendanceEvidence(
  data: CanonicalDashboardData,
  health: OwnerDashboardHealth,
): string[] {
  const evidence: string[] = [];
  if (health.attendance !== null) {
    evidence.push(`Last attendance: ${health.attendance.toLocaleString()}`);
  }
  if (health.attendanceFillRatePct !== null) {
    evidence.push(`Fill rate: ${health.attendanceFillRatePct}%`);
  }
  evidence.push(`Ticket price: $${health.ticketPrice}`);
  if (data.ticketPriceVsLeaguePct !== null) {
    evidence.push(
      `Ticket price vs league: ${data.ticketPriceVsLeaguePct >= 0 ? "+" : ""}${Math.round(data.ticketPriceVsLeaguePct)}%`,
    );
  }
  evidence.push(`Fan sentiment: ${health.fanSentiment}`);
  return evidence;
}

function meanValidTicketPrices(state: GameState): number | null {
  const prices: number[] = [];
  for (const ops of Object.values(state.business.franchiseOps)) {
    const price = ops?.ticketPrice;
    if (
      typeof price === "number" &&
      Number.isInteger(price) &&
      price >= TICKET_PRICE_MIN &&
      price <= TICKET_PRICE_MAX
    ) {
      prices.push(price);
    }
  }
  if (prices.length < 2) {
    return null;
  }
  return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}

function meanLeaguePayroll(state: GameState, year: number): number | null {
  const teamIds = Object.keys(state.world.teams);
  if (teamIds.length < 2) {
    return null;
  }
  let total = 0;
  for (const teamId of teamIds) {
    total += getTeamPayroll(asTeamId(teamId), year, state);
  }
  return total / teamIds.length;
}

function meanLeagueStrength(state: GameState): number | null {
  const teamIds = Object.keys(state.world.teams);
  if (teamIds.length < 2) {
    return null;
  }
  let total = 0;
  for (const teamId of teamIds) {
    total += meanRosterOverall(state, asTeamId(teamId));
  }
  return total / teamIds.length;
}

function readHomeGameDays(
  state: GameState,
  teamId: string,
): LastGameDayView[] {
  const days: LastGameDayView[] = [];
  for (const event of state.user.eventLog) {
    if (event.type !== "HomeGameDaySettled") {
      continue;
    }
    const payload = event.payload;
    if (payload.teamId !== teamId) {
      continue;
    }
    const attendance = Number(payload.attendance) || 0;
    const capacity = Number(payload.capacity) || 0;
    days.push({
      gameId: String(payload.gameId ?? ""),
      occurredOn: event.occurredOn,
      attendance,
      gaAttendance: Number(payload.gaAttendance) || attendance,
      premiumOccupancy: Number(payload.premiumOccupancy) || 0,
      capacity,
      premiumCapacity: Number(payload.premiumCapacity) || 0,
      fillRatePct:
        capacity > 0 ? Math.round((attendance / capacity) * 100) : 0,
      demandScore: Number(payload.demandScore) || 0,
      ticketPrice: Number(payload.ticketPrice) || 0,
      premiumTicketPrice: Number(payload.premiumTicketPrice) || 0,
      ticketRevenue: Number(payload.ticketRevenue) || 0,
      premiumRevenue: Number(payload.premiumRevenue) || 0,
      merchRevenue: Number(payload.merchRevenue) || 0,
      concessionsRevenue: Number(payload.concessionsRevenue) || 0,
      totalGameDayRevenue: 0,
      revenuePerAttendee: null,
      demandContributors: [],
    });
  }
  return days;
}

/**
 * Percent change from the prior home game to the most recent.
 * Requires ≥2 settled home games. Not a monthly/30-day measure.
 */
function computeAttendanceTrendPct(
  homeGameDays: LastGameDayView[],
): number | null {
  if (homeGameDays.length < 2) {
    return null;
  }
  const prior = homeGameDays[homeGameDays.length - 2]!;
  const latest = homeGameDays[homeGameDays.length - 1]!;
  if (prior.attendance <= 0) {
    return null;
  }
  return ((latest.attendance - prior.attendance) / prior.attendance) * 100;
}

function computeConferenceStanding(
  state: GameState,
  teamId: string,
): { name: string; rank: number } | null {
  const team = state.world.teams[teamId];
  if (!team) {
    return null;
  }
  const conference = state.world.conferences[team.conferenceId];
  const peers = Object.values(state.world.teams).filter(
    (t) => t.conferenceId === team.conferenceId,
  );
  const rows = peers.map((t) => {
    const standing = state.competition.standings.byTeamId[t.id];
    return {
      teamId: t.id,
      wins: standing?.wins ?? 0,
      losses: standing?.losses ?? 0,
      abbreviation: t.abbreviation,
    };
  });
  rows.sort((a, b) => {
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    if (a.losses !== b.losses) {
      return a.losses - b.losses;
    }
    return a.abbreviation.localeCompare(b.abbreviation);
  });
  const rank = rows.findIndex((row) => row.teamId === teamId) + 1;
  if (rank <= 0) {
    return null;
  }
  return { name: conference?.name ?? "Conference", rank };
}

function collectRosterProblems(
  state: GameState,
): OwnerDashboardRosterProblem[] {
  return toRosterView(state)
    .filter((player) => player.injuryKind !== "healthy")
    .map((player) => ({
      playerId: player.playerId,
      name: `${player.firstName} ${player.lastName}`,
      kind: player.injuryKind,
    }));
}

function findVacantStarterRoles(
  staff: ReturnType<typeof toStaffView>,
): string[] {
  const filled = new Set(staff.roster.map((member) => member.role));
  return STARTER_ROLES.filter((role) => !filled.has(role));
}

function pctAbove(value: number, baseline: number): number {
  return ((value - baseline) / baseline) * 100;
}

function severityRank(severity: string): number {
  if (severity === "critical") {
    return 0;
  }
  if (severity === "warning") {
    return 1;
  }
  if (severity === "success") {
    return 3;
  }
  return 2;
}

function formatCompactMoney(amount: number): string {
  const millions = amount / 1_000_000;
  if (Math.abs(millions) >= 1) {
    return `$${millions.toFixed(1)}M`;
  }
  const thousands = amount / 1_000;
  if (Math.abs(thousands) >= 1) {
    return `$${thousands.toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}
