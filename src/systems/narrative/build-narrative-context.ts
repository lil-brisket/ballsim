import { getCalendarMonthId } from "@/domain/calendar-date";
import {
  type NarrativeMonthSnapshot,
  NARRATIVE_SNAPSHOTS_MAX,
} from "@/domain/entities/narrative-situation";
import { FACILITY_CATEGORIES } from "@/domain/entities/franchise-ops";
import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { calculateFranchiseValue } from "@/state/franchise-value";
import { projectCashHorizon } from "@/systems/cash-projection";
import {
  calculateFinancialHealth,
  type FinancialHealthState,
} from "@/systems/financial-health";
import { getTeamPayroll } from "@/systems/salary-cap";
import type {
  LeagueRelativeView,
  NarrativeCadence,
  NarrativeContext,
  ObjectiveGapView,
} from "@/systems/narrative/types";

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function facilityMeanForTeam(state: GameState, teamId: TeamId): number {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return 1;
  }
  let total = 0;
  for (const category of FACILITY_CATEGORIES) {
    total += ops.facilities[category].level;
  }
  return total / FACILITY_CATEGORIES.length;
}

function healthForTeam(state: GameState, teamId: TeamId): FinancialHealthState {
  const projection = projectCashHorizon(state, teamId, 12);
  return calculateFinancialHealth({
    cash: projection.cash,
    weeklyOutflow: projection.weeklyOutflow,
    netWeeklyBurn: projection.netWeeklyBurn,
    runwayWeeks: projection.runwayWeeks,
    projectedCash: projection.projectedCash,
  });
}

/**
 * Build a lean month snapshot for the controlled team from live state + event log.
 */
export function buildMonthSnapshot(
  state: GameState,
  monthId: string,
): NarrativeMonthSnapshot {
  const teamId = state.user.controlledTeamId;
  const ops = state.business.franchiseOps[teamId];
  const finances = state.business.finances[teamId];
  const standing = state.competition.standings.byTeamId[teamId];
  const books = finances?.booksByMonth?.[monthId];

  let attendanceSum = 0;
  let attendanceCount = 0;
  let capacitySum = 0;
  for (const event of state.user.eventLog) {
    if (event.type !== "HomeGameDaySettled") {
      continue;
    }
    if (!event.occurredOn.startsWith(monthId)) {
      continue;
    }
    if (event.payload.teamId !== teamId) {
      continue;
    }
    const attendance = Number(event.payload.attendance);
    const capacity = Number(event.payload.capacity);
    if (Number.isFinite(attendance) && Number.isFinite(capacity) && capacity > 0) {
      attendanceSum += attendance;
      capacitySum += capacity;
      attendanceCount += 1;
    }
  }

  const ticketMerchRevenue =
    (books?.revenue.tickets ?? 0) +
    (books?.revenue.premium ?? 0) +
    (books?.revenue.merchandise ?? 0) +
    (books?.revenue.concessions ?? 0);

  const attendanceAvg =
    attendanceCount > 0 ? attendanceSum / attendanceCount : 0;
  const fillRatePct =
    attendanceCount > 0 && capacitySum > 0
      ? Math.round((attendanceSum / capacitySum) * 1000) / 10
      : 0;

  return {
    monthId,
    attendanceAvg: Math.round(attendanceAvg),
    fillRatePct,
    ticketMerchRevenue,
    fanSentiment: ops?.fanSentiment ?? 50,
    reputation: state.world.teams[teamId]?.reputation ?? 50,
    mediaAttention: ops?.mediaAttention ?? 30,
    cash: finances?.cash ?? 0,
    healthBand: healthForTeam(state, teamId),
    wins: standing?.wins ?? 0,
    losses: standing?.losses ?? 0,
    franchiseValue: calculateFranchiseValue(state, teamId),
  };
}

export function appendMonthSnapshot(
  state: GameState,
  monthId: string,
): GameState {
  const existing = state.user.narrative.snapshots;
  if (existing.some((snapshot) => snapshot.monthId === monthId)) {
    return state;
  }
  const snapshot = buildMonthSnapshot(state, monthId);
  const snapshots = [...existing, snapshot].slice(-NARRATIVE_SNAPSHOTS_MAX);
  return {
    ...state,
    user: {
      ...state.user,
      narrative: {
        ...state.user.narrative,
        snapshots,
      },
    },
  };
}

function countConsecutiveDecline(
  snapshots: readonly NarrativeMonthSnapshot[],
): number {
  if (snapshots.length < 2) {
    return 0;
  }
  let count = 0;
  for (let i = snapshots.length - 1; i > 0; i -= 1) {
    const current = snapshots[i]!;
    const prior = snapshots[i - 1]!;
    if (current.fillRatePct < prior.fillRatePct - 0.5) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

function countConsecutiveRise(
  snapshots: readonly NarrativeMonthSnapshot[],
): number {
  if (snapshots.length < 2) {
    return 0;
  }
  let count = 0;
  for (let i = snapshots.length - 1; i > 0; i -= 1) {
    const current = snapshots[i]!;
    const prior = snapshots[i - 1]!;
    if (current.fillRatePct > prior.fillRatePct + 0.5) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

function buildLeagueRelative(state: GameState, teamId: TeamId): LeagueRelativeView {
  const year = state.competition.season.year;
  const teamIds = Object.keys(state.world.teams) as TeamId[];
  const controlled = state.world.teams[teamId];
  const conferenceId = controlled?.conferenceId;

  const fills: number[] = [];
  const prices: number[] = [];
  const payrolls: number[] = [];
  const facilities: number[] = [];
  const values: number[] = [];
  const medias: number[] = [];
  const conferenceWinPcts: number[] = [];

  for (const id of teamIds) {
    const ops = state.business.franchiseOps[id];
    if (!ops) {
      continue;
    }
    prices.push(ops.ticketPrice);
    medias.push(ops.mediaAttention);
    facilities.push(facilityMeanForTeam(state, id));
    payrolls.push(getTeamPayroll(id, year, state));
    values.push(calculateFranchiseValue(state, id));

    const standing = state.competition.standings.byTeamId[id];
    const games = (standing?.wins ?? 0) + (standing?.losses ?? 0);
    const winPct = games > 0 ? (standing?.wins ?? 0) / games : 0;
    if (conferenceId && state.world.teams[id]?.conferenceId === conferenceId) {
      conferenceWinPcts.push(winPct);
    }
  }

  // League mean fill from recent HomeGameDaySettled in eventLog (current month).
  const monthId = getCalendarMonthId(state.world.calendar.currentDate);
  const fillByTeam = new Map<string, { att: number; cap: number }>();
  for (const event of state.user.eventLog) {
    if (event.type !== "HomeGameDaySettled") {
      continue;
    }
    if (!event.occurredOn.startsWith(monthId)) {
      continue;
    }
    const tid = String(event.payload.teamId ?? "");
    const attendance = Number(event.payload.attendance);
    const capacity = Number(event.payload.capacity);
    if (!tid || !Number.isFinite(attendance) || !Number.isFinite(capacity)) {
      continue;
    }
    const prior = fillByTeam.get(tid) ?? { att: 0, cap: 0 };
    fillByTeam.set(tid, {
      att: prior.att + attendance,
      cap: prior.cap + capacity,
    });
  }
  for (const entry of fillByTeam.values()) {
    if (entry.cap > 0) {
      fills.push((entry.att / entry.cap) * 100);
    }
  }

  const ops = state.business.franchiseOps[teamId];
  const standing = state.competition.standings.byTeamId[teamId];
  const games = (standing?.wins ?? 0) + (standing?.losses ?? 0);
  const winPct = games > 0 ? (standing?.wins ?? 0) / games : 0;
  const ownFill = fillByTeam.get(teamId);
  const attendanceFillPct =
    ownFill && ownFill.cap > 0 ? (ownFill.att / ownFill.cap) * 100 : null;
  const leagueMeanFillPct = fills.length > 0 ? mean(fills) : null;
  const franchiseValue = calculateFranchiseValue(state, teamId);
  const leagueMeanFranchiseValue = mean(values);
  const payroll = getTeamPayroll(teamId, year, state);
  const leagueMeanPayroll = mean(payrolls);
  const facilityMean = facilityMeanForTeam(state, teamId);
  const leagueMedianFacility = median(facilities);
  const leagueMeanTicketPrice = mean(prices);
  const leagueMeanMedia = mean(medias);
  const conferenceMeanWinPct = mean(conferenceWinPcts);

  const pctDelta = (own: number, league: number): number | null => {
    if (league === 0) {
      return null;
    }
    return Math.round(((own - league) / league) * 1000) / 10;
  };

  return {
    attendanceFillPct:
      attendanceFillPct === null
        ? null
        : Math.round(attendanceFillPct * 10) / 10,
    leagueMeanFillPct:
      leagueMeanFillPct === null
        ? null
        : Math.round(leagueMeanFillPct * 10) / 10,
    vsLeagueFillPct:
      attendanceFillPct !== null && leagueMeanFillPct !== null
        ? Math.round((attendanceFillPct - leagueMeanFillPct) * 10) / 10
        : null,
    ticketPrice: ops?.ticketPrice ?? 0,
    leagueMeanTicketPrice: Math.round(leagueMeanTicketPrice),
    vsLeagueTicketPricePct: pctDelta(ops?.ticketPrice ?? 0, leagueMeanTicketPrice),
    payroll,
    leagueMeanPayroll: Math.round(leagueMeanPayroll),
    vsLeaguePayrollPct: pctDelta(payroll, leagueMeanPayroll),
    facilityMean: Math.round(facilityMean * 100) / 100,
    leagueMedianFacility: Math.round(leagueMedianFacility * 100) / 100,
    vsLeagueFacility:
      Math.round((facilityMean - leagueMedianFacility) * 100) / 100,
    franchiseValue,
    leagueMeanFranchiseValue: Math.round(leagueMeanFranchiseValue),
    vsLeagueFranchiseValuePct: pctDelta(franchiseValue, leagueMeanFranchiseValue),
    winPct: Math.round(winPct * 1000) / 1000,
    conferenceMeanWinPct: Math.round(conferenceMeanWinPct * 1000) / 1000,
    vsConferenceWinPct:
      conferenceWinPcts.length > 0
        ? Math.round((winPct - conferenceMeanWinPct) * 1000) / 1000
        : null,
    mediaAttention: ops?.mediaAttention ?? 0,
    leagueMeanMedia: Math.round(leagueMeanMedia * 10) / 10,
    vsLeagueMedia:
      Math.round(((ops?.mediaAttention ?? 0) - leagueMeanMedia) * 10) / 10,
  };
}

export type BuildNarrativeContextOptions = {
  cadence: NarrativeCadence;
  dayEvents?: readonly DomainEvent[];
};

export function buildNarrativeContext(
  state: GameState,
  options: BuildNarrativeContextOptions,
): NarrativeContext {
  const teamId = state.user.controlledTeamId;
  const date = state.world.calendar.currentDate;
  const monthId = getCalendarMonthId(date);
  const snapshots = state.user.narrative.snapshots;
  const latest = snapshots[snapshots.length - 1];
  const prior = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  const ops = state.business.franchiseOps[teamId];
  const finances = state.business.finances[teamId];
  const standing = state.competition.standings.byTeamId[teamId];
  const projection = projectCashHorizon(state, teamId, 12);
  const healthBand = calculateFinancialHealth({
    cash: projection.cash,
    weeklyOutflow: projection.weeklyOutflow,
    netWeeklyBurn: projection.netWeeklyBurn,
    runwayWeeks: projection.runwayWeeks,
    projectedCash: projection.projectedCash,
  });

  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const games = wins + losses;
  const winPct = games > 0 ? wins / games : 0;
  const streak = standing?.streak;
  const streakKind =
    streak?.kind === "W" || streak?.kind === "L" ? streak.kind : "N";
  const streakLength = streak?.length ?? 0;

  const objectives: ObjectiveGapView[] = state.user.objectives.map(
    (objective) => {
      const target =
        typeof objective.target === "number" ? objective.target : null;
      const progress =
        typeof objective.progress === "number" ? objective.progress : null;
      const gap =
        target !== null && progress !== null ? target - progress : null;
      return {
        id: objective.id,
        type: objective.type,
        description: objective.description,
        target,
        progress,
        gap,
        status: objective.status,
        category: objective.category,
      };
    },
  );

  const history =
    state.business.franchiseHistory[teamId]?.seasons ?? [];
  const priorSeason = history.length > 0 ? history[history.length - 1]! : null;

  const openDetectorKeys = new Set<string>();
  const openSituationStages = new Map<string, number>();
  for (const situation of state.user.narrative.situations) {
    if (
      situation.status === "active" ||
      situation.status === "acknowledged" ||
      situation.status === "escalated"
    ) {
      openDetectorKeys.add(situation.detectorKey);
      openSituationStages.set(situation.detectorKey, situation.stage);
    }
  }

  const attendanceDownPctVsPriorMonth =
    latest && prior && prior.fillRatePct > 0
      ? Math.round(
          ((prior.fillRatePct - latest.fillRatePct) / prior.fillRatePct) *
            1000,
        ) / 10
      : null;

  const sentimentChangeVsPriorMonth =
    latest && prior
      ? Math.round((latest.fanSentiment - prior.fanSentiment) * 10) / 10
      : null;

  const ticketMerchChangeVsPriorMonth =
    latest && prior && prior.ticketMerchRevenue > 0
      ? Math.round(
          ((latest.ticketMerchRevenue - prior.ticketMerchRevenue) /
            prior.ticketMerchRevenue) *
            1000,
        ) / 10
      : null;

  const franchiseValueChangePctVsPriorMonth =
    latest && prior && prior.franchiseValue > 0
      ? Math.round(
          ((latest.franchiseValue - prior.franchiseValue) /
            prior.franchiseValue) *
            1000,
        ) / 10
      : null;

  const leagueRelative = buildLeagueRelative(state, teamId);

  return {
    date,
    monthId,
    teamId,
    cadence: options.cadence,
    dayEvents: options.dayEvents ?? [],
    snapshots,
    consecutiveAttendanceDeclineMonths: countConsecutiveDecline(snapshots),
    consecutiveAttendanceRiseMonths: countConsecutiveRise(snapshots),
    attendanceDownPctVsPriorMonth,
    sentimentChangeVsPriorMonth,
    ticketMerchChangeVsPriorMonth,
    franchiseValueChangePctVsPriorMonth,
    currentFillPctEstimate: leagueRelative.attendanceFillPct,
    currentFanSentiment: ops?.fanSentiment ?? 50,
    currentMediaAttention: ops?.mediaAttention ?? 30,
    currentReputation: state.world.teams[teamId]?.reputation ?? 50,
    currentTicketPrice: ops?.ticketPrice ?? 45,
    currentMarketingBudget: ops?.marketing.budget ?? 0,
    currentCash: finances?.cash ?? 0,
    healthBand,
    runwayWeeks: projection.runwayWeeks,
    streakKind,
    streakLength,
    wins,
    losses,
    winPct: Math.round(winPct * 1000) / 1000,
    playoffQualified: state.competition.playoffs.qualifiedTeams.some(
      (seed) => seed.teamId === teamId,
    ),
    facilityMean: facilityMeanForTeam(state, teamId),
    leagueRelative,
    objectives,
    priorSeasonWins: priorSeason?.wins ?? null,
    priorSeasonLosses: priorSeason?.losses ?? null,
    priorSeasonPlayoff: priorSeason?.playoffResult ?? null,
    leaguePopularity: state.business.leagueEconomy.popularity,
    leagueBroadcast: state.business.leagueEconomy.broadcastValue,
    sponsorshipClimate: state.business.leagueEconomy.sponsorshipClimate,
    priorLeaguePopularity: null,
    openDetectorKeys,
    openSituationStages,
    cooldowns: state.user.narrative.cooldowns,
    notificationDedupeKeys: new Set(
      state.user.notifications.map((notification) => notification.dedupeKey),
    ),
  };
}
