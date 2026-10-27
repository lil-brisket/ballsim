import type { GameState } from "@/state/game-state";
import { toTimelineHighlights } from "@/state/media-timeline/highlights";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { resolveSimulationPhase } from "@/systems/simulation/simulation-phase";
import { computePhaseResponsibility } from "@/systems/simulation/phase-responsibility";
import { asTeamId } from "@/domain/ids";
import { activeGameplayMilestones } from "@/systems/historical-milestones";
import { calculateFranchiseValue } from "@/state/franchise-value";
import { getCachedAnnualReport } from "@/systems/franchise-report";
import { currentFranchiseEra } from "@/systems/franchise-eras";
import {
  toDashboardSnapshot,
  type NotificationView,
  toNotificationsView,
  type EventLogEntryView,
  toEventLogView,
} from "@/state/selectors";
import {
  toFranchiseBusinessView,
  toStaffView,
  toFacilitiesView,
  toSponsorshipsView,
} from "@/state/franchise-selectors";
import { getFinancialStatement } from "@/systems/team-finances";
import { getTeamPayroll } from "@/systems/salary-cap";
import { meanRosterOverall } from "@/state/roster-strength";
import { calculateFranchiseHealth } from "@/state/franchise-health";
import {
  DASHBOARD_UPCOMING_GAMES_LIMIT,
  DASHBOARD_NOTIFICATION_CAP,
  DASHBOARD_ACTIVITY_CAP,
} from "@/state/owner-dashboard-config";
import { toHomeBoardView } from "@/state/owner-dashboard/home-board";
import { toOwnershipConfidenceView } from "@/state/ownership-confidence-view";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import { toOwnerCareerEvaluation } from "@/state/owner-career-evaluation";
import { hasBlockingOwnerDecision } from "@/domain/entities/owner-decision";
import type {
  OwnerDashboardView,
  CanonicalDashboardData,
  OwnerDashboardHealth,
  OwnerDashboardMetricContext,
  OwnerDashboardTeam,
  OwnerDashboardActionItem,
  OwnerDashboardOwner,
  OwnerDashboardFlags,
} from "@/state/owner-dashboard/types";
import {
  buildActionItems,
  buildSituationsView,
} from "@/state/owner-dashboard/action-items";
import {
  buildInsights,
  buildNextImportantEvent,
  meanValidTicketPrices,
  pctAbove,
  meanLeaguePayroll,
  meanLeagueStrength,
  readHomeGameDays,
  computeAttendanceTrendPct,
  computeConferenceStanding,
  collectRosterProblems,
  findVacantStarterRoles,
  formatCompactMoney,
  severityRank,
} from "@/state/owner-dashboard/metrics";
import {
  buildPendingTradeOfferView,
  buildTradeInbox,
  buildSeasonRecap,
} from "@/state/owner-dashboard/trade-inbox";

export type {
  OwnerDashboardActionSeverity,
  OwnerDashboardNextEvent,
  OwnerDashboardActionCategory,
  OwnerDashboardActionItem,
  OwnerDashboardInsight,
  OwnerDashboardMetricContext,
  OwnerDashboardHealth,
  OwnerDashboardRosterProblem,
  OwnerDashboardTeam,
  OwnerDashboardOwner,
  OwnerDashboardFlags,
  OwnerDashboardPendingTradeOffer,
  OwnerDashboardTradeInbox,
  OwnerDashboardSeasonRecap,
  OwnerDashboardSituationView,
  OwnerDashboardView,
} from "@/state/owner-dashboard/types";

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
  "PlayerWaived",
  "PlayerBoughtOut",
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
  const pendingTradeOffer = buildPendingTradeOfferView(state);
  const tradeInbox = buildTradeInbox(state);
  const situations = buildSituationsView(state);
  const seasonRecap =
    calendar.lifecyclePhase === "postseason"
      ? buildSeasonRecap(canonical, health, calendar)
      : null;

  const teamId = asTeamId(canonical.teamId);
  const history = state.business.franchiseHistory[teamId]?.seasons ?? [];
  const standing = state.competition.standings.byTeamId[teamId];
  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const games = wins + losses;
  const projectedWins =
    games > 0
      ? Math.round((wins / games) * state.settings.regularSeason.gamesPerTeam)
      : null;
  const historicalMilestones = activeGameplayMilestones(history, {
    seasonYear: canonical.year,
    wins,
    losses,
    projectedWins,
    attendanceToDate:
      state.business.finances[teamId]?.attendanceByYear[
        String(canonical.year)
      ] ?? null,
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
    foundedSeasonYear: state.business.franchiseOps[teamId]?.foundedSeasonYear,
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

  const mediaTimeline = toTimelineHighlights(state, canonical.saveId);
  const nextImportantEvent = buildNextImportantEvent(state);

  return {
    saveId: canonical.saveId,
    currentDate: canonical.snapshot.currentDate,
    seasonYear: canonical.year,
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
    health,
    team,
    owner,
    actionItems,
    insights,
    notifications,
    activity,
    flags,
    pendingTradeOffer,
    tradeInbox,
    situations,
    simulationPhase,
    phaseResponsibility,
    mediaTimeline,
    nextImportantEvent,
    home: toHomeBoardView(state),
  };
}

function readCanonical(state: GameState): CanonicalDashboardData {
  const teamId = state.user.activeOwnerTeamId;
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
  const active = objectives.filter(
    (objective) => objective.status === "active",
  );
  const ownership = toOwnershipConfidenceView(data.state);
  return {
    patience: getActiveOwnedFranchise(data.state).ownerPatience,
    objectives,
    primaryObjectives: active.filter(
      (objective) => objective.role === "primary",
    ),
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
    pendingOwnerDecision: hasBlockingOwnerDecision(data.state.user),
  };
}
