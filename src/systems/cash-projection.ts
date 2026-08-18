import { addCalendarDays, getCalendarMonthId, getIsoWeekId } from "@/domain/calendar-date";
import { FACILITY_CATEGORIES } from "@/domain/entities/franchise-ops";
import {
  getStaffContractSalaryForYear,
  isStaffContractActive,
} from "@/domain/entities/staff-contract";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { forecastNextHomeGameDay } from "@/systems/demand/forecast-game-day";
import { facilityWeeklyOpex } from "@/systems/facilities-config";
import { MARKETING_WEEKS_PER_YEAR } from "@/systems/marketing-config";
import { PLAYER_PAYROLL_WEEKS_PER_YEAR } from "@/systems/player-payroll";
import { getTeamPayroll } from "@/systems/salary-cap";
import { STAFF_PAYROLL_WEEKS_PER_YEAR } from "@/systems/staff-config";
import { estimateMonthlyBroadcastShare } from "@/systems/league-economy";
import { estimateMonthlySponsorshipPayout } from "@/systems/sponsorships";

export type WeeklyOutflowBreakdown = {
  playerPayroll: number;
  staff: number;
  facilities: number;
  marketing: number;
  total: number;
};

export type CashHorizonInflowBreakdown = {
  gate: number;
  sponsorship: number;
  broadcast: number;
};

export type CashHorizonProjection = {
  /** Constant-condition projected cash after walking known cadences to horizonEnd. */
  projectedCash: number;
  /** First week (1-based) where projected cash <= 0; null if cash stays positive. */
  runwayWeeks: number | null;
  weeklyOutflow: number;
  outflowBreakdown: WeeklyOutflowBreakdown;
  expectedWeeklyInflow: number;
  netWeeklyBurn: number;
  inflowBreakdown: CashHorizonInflowBreakdown;
  primaryPressure: "player_payroll" | "staff" | "facilities" | "marketing";
  horizonEndDate: string;
  horizonKind: "season" | "near_term";
};

const NEAR_TERM_DAYS = 56;
const HORIZON_DAY_CAP = 280;

export function computeWeeklyOutflowBreakdown(
  state: GameState,
  teamId: string,
): WeeklyOutflowBreakdown {
  const ops = state.business.franchiseOps[teamId];
  const year = state.competition.season.year;
  let staffWeekly = 0;
  for (const contract of Object.values(state.business.staffContracts)) {
    if (contract.teamId !== teamId || !isStaffContractActive(contract, year)) {
      continue;
    }
    const annual = getStaffContractSalaryForYear(contract, year) ?? 0;
    staffWeekly += Math.floor(annual / STAFF_PAYROLL_WEEKS_PER_YEAR);
  }

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
  const playerPayrollWeekly = Math.floor(
    getTeamPayroll(teamId as TeamId, year, state) /
      PLAYER_PAYROLL_WEEKS_PER_YEAR,
  );
  return {
    playerPayroll: playerPayrollWeekly,
    staff: staffWeekly,
    facilities: facilityWeekly,
    marketing: marketingWeekly,
    total: staffWeekly + facilityWeekly + marketingWeekly + playerPayrollWeekly,
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
): CashHorizonProjection["primaryPressure"] {
  const entries: Array<
    [CashHorizonProjection["primaryPressure"], number]
  > = [
    ["player_payroll", breakdown.playerPayroll],
    ["staff", breakdown.staff],
    ["facilities", breakdown.facilities],
    ["marketing", breakdown.marketing],
  ];
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries[0]![0];
}

/**
 * Walks known payment cadences (weekly opex/payroll, dated home games,
 * monthly sponsorship + broadcast) without simulating future games.
 */
export function projectCashHorizon(
  state: GameState,
  teamId: string,
): CashHorizonProjection {
  const cash0 = state.business.finances[teamId]?.cash ?? 0;
  const ops = state.business.franchiseOps[teamId];
  const outflow = computeWeeklyOutflowBreakdown(state, teamId);
  const weeklyOutflow = outflow.total;
  const forecast = ops
    ? forecastNextHomeGameDay(state, teamId, ops)
    : { totalGameDayRevenue: 0 };
  const gameDayRevenue = forecast.totalGameDayRevenue;
  const monthlySponsorship = estimateMonthlySponsorshipPayout(state, teamId);
  const monthlyBroadcast = estimateMonthlyBroadcastShare(state, teamId as TeamId);
  const homeDates = remainingHomeGameDates(state, teamId);
  const currentDate = state.world.calendar.currentDate;
  const lastGameDate = homeDates[homeDates.length - 1];
  const seasonHorizon = lastGameDate ?? addCalendarDays(currentDate, NEAR_TERM_DAYS);
  const capDate = addCalendarDays(currentDate, HORIZON_DAY_CAP);
  const horizonEndDate = seasonHorizon > capDate ? capDate : seasonHorizon;
  const horizonKind: CashHorizonProjection["horizonKind"] =
    lastGameDate !== undefined && lastGameDate <= capDate ? "season" : "near_term";

  const homeDateSet = new Set(homeDates);
  let cash = cash0;
  let date = currentDate;
  let runwayWeeks: number | null = null;
  let weeksCharged = 0;
  let gateInflow = 0;
  let sponsorshipInflow = 0;
  let broadcastInflow = 0;

  while (date < horizonEndDate) {
    const next = addCalendarDays(date, 1);
    if (homeDateSet.has(date)) {
      cash += gameDayRevenue;
      gateInflow += gameDayRevenue;
    }
    if (getIsoWeekId(next) !== getIsoWeekId(date)) {
      cash -= weeklyOutflow;
      weeksCharged += 1;
      if (cash <= 0 && runwayWeeks === null) {
        runwayWeeks = weeksCharged;
      }
    }
    if (getCalendarMonthId(next) !== getCalendarMonthId(date)) {
      cash += monthlySponsorship + monthlyBroadcast;
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
    projectedCash: Math.round(cash),
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
