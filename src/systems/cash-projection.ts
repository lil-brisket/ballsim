import {
  addCalendarDays,
  formatCalendarDate,
  parseCalendarDate,
} from "@/domain/calendar-date";
import { FACILITY_CATEGORIES } from "@/domain/entities/franchise-ops";
import { asTeamId, type TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { forecastNextHomeGameDay } from "@/systems/demand/forecast-game-day";
import { facilityWeeklyOpex } from "@/systems/facilities-config";
import { MARKETING_WEEKS_PER_YEAR } from "@/systems/marketing-config";
import {
  estimateMonthlyBroadcastShare,
  nationalMediaPerTeamPerSeason,
} from "@/systems/league-economy";
import { estimateMonthlySponsorshipPayout } from "@/systems/sponsorships";
import { getTeamPayroll, getTeamPrepaidDeadMoney } from "@/systems/salary-cap";
import { getTeamStaffPayroll } from "@/systems/staff-budget";
import {
  regularSeasonShareOfWeek,
  typicalRegularSeasonWeekShare,
} from "@/systems/regular-season-pay";
import { STAFF_PAYROLL_WEEKS_PER_YEAR } from "@/systems/staff-config";

/**
 * Business-ops weekly outflow (payroll + facilities + marketing).
 */
export type WeeklyOutflowBreakdown = {
  playerPayroll: number;
  staff: number;
  facilities: number;
  marketing: number;
  total: number;
};

export type BusinessFundsHorizonInflowBreakdown = {
  gate: number;
  sponsorship: number;
  broadcast: number;
};

export type BusinessFundsHorizonProjection = {
  projectedBusinessFunds: number;
  /** First week where projected funds <= 0; informational only. */
  runwayWeeks: number | null;
  weeklyOutflow: number;
  outflowBreakdown: WeeklyOutflowBreakdown;
  expectedWeeklyInflow: number;
  netWeeklyBurn: number;
  inflowBreakdown: BusinessFundsHorizonInflowBreakdown;
  primaryPressure: "player_payroll" | "staff" | "facilities" | "marketing";
  horizonEndDate: string;
  horizonKind: "season" | "near_term";
};

/** @deprecated Use BusinessFundsHorizonProjection. */
export type CashHorizonProjection = BusinessFundsHorizonProjection & {
  projectedCash: number;
};

/** @deprecated Use BusinessFundsHorizonInflowBreakdown. */
export type CashHorizonInflowBreakdown = BusinessFundsHorizonInflowBreakdown;

const NEAR_TERM_DAYS = 56;
const HORIZON_DAY_CAP = 280;

export function computeWeeklyOutflowBreakdown(
  state: GameState,
  teamId: string,
): WeeklyOutflowBreakdown {
  const ops = state.business.franchiseOps[teamId];

  let facilityWeekly = 0;
  if (ops) {
    for (const category of FACILITY_CATEGORIES) {
      facilityWeekly += facilityWeeklyOpex(
        category,
        ops.facilities[category].level,
      );
    }
  }

  const marketingWeekly = ops
    ? Math.floor(ops.marketing.budget / MARKETING_WEEKS_PER_YEAR)
    : 0;

  const year = state.competition.season.year;
  // A full regular-season week; salaries are not paid in the offseason.
  const playerPayroll = Math.round(
    cashPayroll(asTeamId(teamId), year, state) *
      typicalRegularSeasonWeekShare(state),
  );
  const staff = Math.round(
    getTeamStaffPayroll(asTeamId(teamId), year, state) /
      STAFF_PAYROLL_WEEKS_PER_YEAR,
  );

  return {
    playerPayroll,
    staff,
    facilities: facilityWeekly,
    marketing: marketingWeekly,
    total: playerPayroll + staff + facilityWeekly + marketingWeekly,
  };
}

function remainingHomeGameDates(state: GameState, teamId: string): string[] {
  const dates: string[] = [];
  for (const game of Object.values(state.competition.games)) {
    if (game.status === "final") {
      continue;
    }
    if (game.homeTeamId !== teamId) {
      continue;
    }
    dates.push(game.date);
  }
  dates.sort();
  return dates;
}

function primaryPressureFrom(
  breakdown: WeeklyOutflowBreakdown,
): BusinessFundsHorizonProjection["primaryPressure"] {
  const entries: Array<
    [BusinessFundsHorizonProjection["primaryPressure"], number]
  > = [
    ["facilities", breakdown.facilities],
    ["marketing", breakdown.marketing],
    ["player_payroll", breakdown.playerPayroll],
    ["staff", breakdown.staff],
  ];
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries[0]![0];
}

/**
 * Walks known business payment cadences (facility opex, marketing, dated home
 * games, monthly sponsorship + broadcast) without simulating future games.
 */
export function projectBusinessFundsHorizon(
  state: GameState,
  teamId: string,
): BusinessFundsHorizonProjection {
  const funds0 = state.business.finances[teamId]?.businessFunds ?? 0;
  const ops = state.business.franchiseOps[teamId];
  const outflow = computeWeeklyOutflowBreakdown(state, teamId);
  const weeklyOutflow = outflow.total;
  const forecast = ops
    ? forecastNextHomeGameDay(state, teamId, ops)
    : { totalGameDayRevenue: 0 };
  const gameDayRevenue = forecast.totalGameDayRevenue;
  const monthlySponsorship = estimateMonthlySponsorshipPayout(state, teamId);
  const monthlyBroadcast = estimateMonthlyBroadcastShare(
    state,
    teamId as TeamId,
  );
  const annualPayroll = cashPayroll(
    asTeamId(teamId),
    state.competition.season.year,
    state,
  );
  const nationalMedia = nationalMediaPerTeamPerSeason(state);
  const homeDates = remainingHomeGameDates(state, teamId);
  const currentDate = state.world.calendar.currentDate;
  const lastGameDate = homeDates[homeDates.length - 1];
  const seasonHorizon =
    lastGameDate ?? addCalendarDays(currentDate, NEAR_TERM_DAYS);
  const capDate = addCalendarDays(currentDate, HORIZON_DAY_CAP);
  const horizonEndDate = seasonHorizon > capDate ? capDate : seasonHorizon;
  const horizonKind: BusinessFundsHorizonProjection["horizonKind"] =
    lastGameDate !== undefined && lastGameDate <= capDate
      ? "season"
      : "near_term";

  const homeDateSet = new Set(homeDates);
  let funds = funds0;
  let date = currentDate;
  let runwayWeeks: number | null = null;
  let weeksCharged = 0;
  let gateInflow = 0;
  let sponsorshipInflow = 0;
  let broadcastInflow = 0;

  // Step one UTC date instead of parsing date strings every day: between
  // consecutive days the ISO week changes exactly when the next day is a
  // Monday, and the month when it is the 1st.
  const start = parseCalendarDate(currentDate);
  const cursor = new Date(
    Date.UTC(start.year, start.month - 1, start.day, 12, 0, 0),
  );
  while (date < horizonEndDate) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const next = formatCalendarDate(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + 1,
      cursor.getUTCDate(),
    );
    if (homeDateSet.has(date)) {
      funds += gameDayRevenue;
      gateInflow += gameDayRevenue;
    }
    if (cursor.getUTCDay() === 1) {
      // Payroll and national media follow the regular-season schedule.
      const share = regularSeasonShareOfWeek(state, date);
      const media = Math.round(nationalMedia * share);
      funds +=
        media -
        (weeklyOutflow - outflow.playerPayroll) -
        Math.round(annualPayroll * share);
      broadcastInflow += media;
      weeksCharged += 1;
      if (funds <= 0 && runwayWeeks === null) {
        runwayWeeks = weeksCharged;
      }
    }
    if (cursor.getUTCDate() === 1) {
      funds += monthlySponsorship + monthlyBroadcast;
      sponsorshipInflow += monthlySponsorship;
      broadcastInflow += monthlyBroadcast;
    }
    date = next;
  }

  const expectedWeeklyInflow =
    weeksCharged > 0
      ? Math.round(
          (gateInflow + sponsorshipInflow + broadcastInflow) / weeksCharged,
        )
      : 0;
  const netWeeklyBurn = weeklyOutflow - expectedWeeklyInflow;

  return {
    projectedBusinessFunds: Math.round(funds),
    runwayWeeks,
    weeklyOutflow,
    outflowBreakdown: outflow,
    expectedWeeklyInflow,
    netWeeklyBurn,
    inflowBreakdown: {
      gate: gateInflow,
      sponsorship: sponsorshipInflow,
      broadcast: broadcastInflow,
    },
    primaryPressure: primaryPressureFrom(outflow),
    horizonEndDate,
    horizonKind,
  };
}

/** @deprecated Use projectBusinessFundsHorizon. */
export function projectCashHorizon(
  state: GameState,
  teamId: string,
): CashHorizonProjection {
  const projection = projectBusinessFundsHorizon(state, teamId);
  return {
    ...projection,
    projectedCash: projection.projectedBusinessFunds,
  };
}

/** Payroll still paid weekly in cash: buyout money already left at release. */
function cashPayroll(teamId: TeamId, year: number, state: GameState): number {
  return (
    getTeamPayroll(teamId, year, state) -
    getTeamPrepaidDeadMoney(teamId, year, state)
  );
}
