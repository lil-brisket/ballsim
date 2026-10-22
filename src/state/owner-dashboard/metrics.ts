import { POOR_ATTENDANCE_FILL_RATE_PCT } from "@/systems/owner-objectives-config";
import {
  TICKET_PRICE_VS_LEAGUE_HIGH_PCT,
  MARKETING_INSIGHT_MIN_AWARENESS,
  TEAM_PERFORMANCE_MIN_GAMES,
  PAYROLL_VS_LEAGUE_HIGH_PCT,
  STRENGTH_VS_LEAGUE_HIGH_PCT,
} from "@/state/owner-dashboard-config";
import type { GameState } from "@/state/game-state";
import { TICKET_PRICE_MIN, TICKET_PRICE_MAX } from "@/systems/ticket-pricing";
import { getTeamPayroll } from "@/systems/salary-cap";
import { asTeamId } from "@/domain/ids";
import { meanRosterOverall } from "@/state/roster-strength";
import { type LastGameDayView, toStaffView } from "@/state/franchise-selectors";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import { toRosterView } from "@/state/selectors";
import { STARTER_ROLES } from "@/systems/staff-generation";
import { findNextSimulationTarget } from "@/systems/calendar";
import type {
  CanonicalDashboardData,
  OwnerDashboardHealth,
  OwnerDashboardTeam,
  OwnerDashboardInsight,
  OwnerDashboardRosterProblem,
  OwnerDashboardNextEvent,
} from "@/state/owner-dashboard/types";

export function buildInsights(
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
      health.financialHealth === "critical")
  ) {
    insights.push({
      id: "insight_financial",
      text: "Expenses are outpacing revenue signals while business funds are under pressure — financial posture is worth reviewing.",
    });
  }

  return insights;
}

export function hasAttendanceProblem(
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

export function isTicketPriceElevated(data: CanonicalDashboardData): boolean {
  return (
    data.ticketPriceVsLeaguePct !== null &&
    data.ticketPriceVsLeaguePct >= TICKET_PRICE_VS_LEAGUE_HIGH_PCT
  );
}

export function hasMarketingInsight(
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

export function hasTeamPayrollConcern(
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

export function attendanceWhat(
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

export function attendanceEvidence(
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

export function meanValidTicketPrices(state: GameState): number | null {
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

export function meanLeaguePayroll(
  state: GameState,
  year: number,
): number | null {
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

export function meanLeagueStrength(state: GameState): number | null {
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

export function readHomeGameDays(
  state: GameState,
  teamId: string,
): LastGameDayView[] {
  const days: LastGameDayView[] = [];
  for (const event of getActiveOwnedFranchise(state).eventLog) {
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
      fillRatePct: capacity > 0 ? Math.round((attendance / capacity) * 100) : 0,
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
export function computeAttendanceTrendPct(
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

export function computeConferenceStanding(
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

export function collectRosterProblems(
  state: GameState,
): OwnerDashboardRosterProblem[] {
  return toRosterView(state)
    .filter((player) => player.injuryKind !== "available")
    .map((player) => ({
      playerId: player.playerId,
      name: `${player.firstName} ${player.lastName}`,
      kind: player.injuryKind,
    }));
}

export function findVacantStarterRoles(
  staff: ReturnType<typeof toStaffView>,
): string[] {
  const filled = new Set(staff.roster.map((member) => member.role));
  return STARTER_ROLES.filter((role) => !filled.has(role));
}

export function buildNextImportantEvent(
  state: GameState,
): OwnerDashboardNextEvent | null {
  const target = findNextSimulationTarget(state, "next_important");
  if (!target) {
    return null;
  }
  if (target.event) {
    return {
      date: target.date,
      title: target.event.title,
      description: target.event.description,
      daysUntil: target.daysUntil,
      category: target.event.category,
      href: target.event.href,
      blocking: target.event.blocking,
    };
  }
  return {
    date: target.date,
    title: "Important date approaching",
    daysUntil: target.daysUntil,
    category: "league",
    blocking: false,
  };
}

export function pctAbove(value: number, baseline: number): number {
  return ((value - baseline) / baseline) * 100;
}

export function severityRank(severity: string): number {
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

export function formatCompactMoney(amount: number): string {
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
