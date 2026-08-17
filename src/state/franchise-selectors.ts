import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
  type FranchiseOps,
} from "@/domain/entities/franchise-ops";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";
import type { LeagueEconomy } from "@/domain/entities/league-economy";
import type { RelocationProcess } from "@/domain/entities/relocation";
import type { ExpansionState } from "@/domain/entities/expansion";
import type { Sponsorship } from "@/domain/entities/sponsorship";
import type { Staff } from "@/domain/entities/staff";
import {
  getStaffContractSalaryForYear,
  isStaffContractActive,
} from "@/domain/entities/staff-contract";
import type { GameState } from "@/state/game-state";
import { calculateFranchiseValue } from "@/state/franchise-value";
import type { TeamId } from "@/domain/ids";
import {
  explainTicketDemand,
  type DemandContribution,
} from "@/systems/demand/calculate-demand";
import {
  concessionsFromAttendance,
  merchandiseFromAttendance,
  resolveAttendance,
  revenuePerAttendee,
} from "@/systems/demand/resolve-attendance";
import { arenaCapacity } from "@/systems/facilities";
import {
  facilityUpgradeCost,
  facilityWeeklyOpex,
} from "@/systems/facilities-config";
import { MARKETING_WEEKS_PER_YEAR } from "@/systems/marketing-config";
import { PLAYER_PAYROLL_WEEKS_PER_YEAR } from "@/systems/player-payroll";
import { getTeamPayroll } from "@/systems/salary-cap";

export type StaffMemberView = {
  staffId: string;
  firstName: string;
  lastName: string;
  role: string;
  quality: number;
  experience: number;
  strengths: string[];
  weaknesses: string[];
  employed: boolean;
  annualSalary: number | null;
  contractEndYear: number | null;
};

export type FacilityRowView = {
  category: FacilityCategory;
  level: number;
  upgradeWeeksRemaining: number;
  upgradeCost: number | null;
};

export type DemandContributorView = {
  key: string;
  raw: number;
  weighted: number;
};

/**
 * Live forecast: what would happen if a home game were played with current knobs.
 * Must never mutate authoritative state. Never conflate with lastGameDay.
 */
export type GameDayForecastView = {
  demandScore: number;
  attendance: number;
  capacity: number;
  fillRatePct: number;
  ticketPrice: number;
  ticketRevenue: number;
  merchRevenue: number;
  concessionsRevenue: number;
  totalGameDayRevenue: number;
  revenuePerAttendee: number | null;
  demandContributors: DemandContributorView[];
};

/**
 * Historical record from the latest HomeGameDaySettled event.
 * Never derived from the live forecast.
 */
export type LastGameDayView = {
  gameId: string;
  occurredOn: string;
  attendance: number;
  capacity: number;
  fillRatePct: number;
  demandScore: number;
  ticketPrice: number;
  ticketRevenue: number;
  merchRevenue: number;
  concessionsRevenue: number;
  totalGameDayRevenue: number;
  revenuePerAttendee: number | null;
  demandContributors: DemandContributorView[];
};

export type CashRunwayView = {
  cash: number;
  weeklyOutflow: number;
  expectedWeeklyInflow: number;
  netWeeklyBurn: number;
  /** null when net burn <= 0 (no immediate runway problem). */
  runwayWeeks: number | null;
};

export type FranchiseBusinessView = {
  ticketPrice: number;
  fanSentiment: number;
  mediaAttention: number;
  marketSize: number;
  awareness: number;
  marketingBudget: number;
  /** Derived weekly marketing burn from annual budget. */
  weeklyMarketingSpend: number;
  reputation: number;
  franchiseValue: number;
  arenaCapacity: number;
  aiProfile: string;
  /** Forecast only — current knobs. */
  forecast: GameDayForecastView;
  /** Historical only — last HomeGameDaySettled, or null. */
  lastGameDay: LastGameDayView | null;
  cashRunway: CashRunwayView;
};

export type SponsorshipView = {
  id: string;
  sponsorName: string;
  annualValue: number;
  startYear: number;
  endYear: number;
  status: string;
  reputationFloor: number;
  playoffBonus: number;
};

export type FranchiseHistoryView = {
  seasons: FranchiseSeasonRecord[];
};

export function toStaffView(state: GameState): {
  roster: StaffMemberView[];
  available: StaffMemberView[];
} {
  const teamId = state.user.controlledTeamId;
  const year = state.competition.season.year;
  const roster: StaffMemberView[] = [];
  const available: StaffMemberView[] = [];

  for (const staff of Object.values(state.world.staff)) {
    const view = toStaffMemberView(state, staff, year);
    if (staff.teamId === teamId) {
      roster.push(view);
    } else if (staff.teamId === null) {
      available.push(view);
    }
  }

  roster.sort((a, b) => a.role.localeCompare(b.role));
  available.sort((a, b) => a.role.localeCompare(b.role) || b.quality - a.quality);
  return { roster, available };
}

function toStaffMemberView(
  state: GameState,
  staff: Staff,
  year: number,
): StaffMemberView {
  const contract = Object.values(state.business.staffContracts).find(
    (c) =>
      c.staffId === staff.id &&
      (staff.teamId === null || c.teamId === staff.teamId) &&
      isStaffContractActive(c, year),
  );
  return {
    staffId: staff.id,
    firstName: staff.firstName,
    lastName: staff.lastName,
    role: staff.role,
    quality: staff.quality,
    experience: staff.experience,
    strengths: [...staff.strengths],
    weaknesses: [...staff.weaknesses],
    employed: staff.teamId !== null,
    annualSalary: contract
      ? (getStaffContractSalaryForYear(contract, year) ?? null)
      : null,
    contractEndYear: contract?.endYear ?? null,
  };
}

export function toFacilitiesView(state: GameState): FacilityRowView[] {
  const teamId = state.user.controlledTeamId;
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return [];
  }
  return FACILITY_CATEGORIES.map((category) => {
    const facility = ops.facilities[category];
    const upgradeCost =
      facility.level < 5 && facility.upgradeWeeksRemaining === 0
        ? facilityUpgradeCost(category, facility.level)
        : null;
    return {
      category,
      level: facility.level,
      upgradeWeeksRemaining: facility.upgradeWeeksRemaining,
      upgradeCost,
    };
  });
}

function teamWinPct(state: GameState, teamId: string): number {
  const standing = state.competition.standings.byTeamId[teamId];
  if (!standing) {
    return 0.5;
  }
  const games = standing.wins + standing.losses;
  return games === 0 ? 0.5 : standing.wins / games;
}

function toContributorViews(
  contributions: Record<string, DemandContribution>,
): DemandContributorView[] {
  return Object.entries(contributions)
    .map(([key, value]) => ({
      key,
      raw: value.raw,
      weighted: Math.round(value.weighted * 10) / 10,
    }))
    .sort((a, b) => b.weighted - a.weighted);
}

function buildForecast(
  state: GameState,
  teamId: string,
  ops: FranchiseOps,
): GameDayForecastView {
  const team = state.world.teams[teamId]!;
  const capacity = arenaCapacity(state, teamId);
  const explanation = explainTicketDemand({
    marketSize: ops.marketSize,
    fanSentiment: ops.fanSentiment,
    reputation: team.reputation,
    awareness: ops.marketing.awareness,
    mediaAttention: ops.mediaAttention,
    leaguePopularity: state.business.leagueEconomy.popularity,
    winPct: teamWinPct(state, teamId),
  });
  const attendance = resolveAttendance(
    explanation.score,
    ops.ticketPrice,
    capacity,
  );
  const ticketRevenue = attendance * ops.ticketPrice;
  const merchRevenue = merchandiseFromAttendance(attendance, ops.fanSentiment);
  const concessionsRevenue = concessionsFromAttendance(
    attendance,
    ops.fanSentiment,
  );
  const totalGameDayRevenue = ticketRevenue + merchRevenue + concessionsRevenue;
  return {
    demandScore: explanation.score,
    attendance,
    capacity,
    fillRatePct:
      capacity > 0 ? Math.round((attendance / capacity) * 100) : 0,
    ticketPrice: ops.ticketPrice,
    ticketRevenue,
    merchRevenue,
    concessionsRevenue,
    totalGameDayRevenue,
    revenuePerAttendee: revenuePerAttendee(
      attendance,
      ticketRevenue,
      merchRevenue,
      concessionsRevenue,
    ),
    demandContributors: toContributorViews(explanation.contributions),
  };
}

function readLastGameDay(
  state: GameState,
  teamId: string,
): LastGameDayView | null {
  for (let index = state.user.eventLog.length - 1; index >= 0; index -= 1) {
    const event = state.user.eventLog[index]!;
    if (event.type !== "HomeGameDaySettled") {
      continue;
    }
    const payload = event.payload;
    if (payload.teamId !== teamId) {
      continue;
    }
    const attendance = Number(payload.attendance) || 0;
    const capacity = Number(payload.capacity) || 0;
    const ticketRevenue = Number(payload.ticketRevenue) || 0;
    const merchRevenue = Number(payload.merchRevenue) || 0;
    const concessionsRevenue = Number(payload.concessionsRevenue) || 0;
    const totalGameDayRevenue =
      ticketRevenue + merchRevenue + concessionsRevenue;
    const contributions =
      payload.contributions &&
      typeof payload.contributions === "object" &&
      !Array.isArray(payload.contributions)
        ? (payload.contributions as Record<string, DemandContribution>)
        : {};
    const storedRpa = payload.revenuePerAttendee;
    return {
      gameId: String(payload.gameId ?? ""),
      occurredOn: event.occurredOn,
      attendance,
      capacity,
      fillRatePct:
        capacity > 0 ? Math.round((attendance / capacity) * 100) : 0,
      demandScore: Number(payload.demandScore) || 0,
      ticketPrice: Number(payload.ticketPrice) || 0,
      ticketRevenue,
      merchRevenue,
      concessionsRevenue,
      totalGameDayRevenue,
      revenuePerAttendee:
        typeof storedRpa === "number"
          ? storedRpa
          : revenuePerAttendee(
              attendance,
              ticketRevenue,
              merchRevenue,
              concessionsRevenue,
            ),
      demandContributors: toContributorViews(contributions),
    };
  }
  return null;
}

/**
 * Cash runway from net weekly burn (outflow − expected recurring inflow).
 * When net burn <= 0 there is no immediate runway problem.
 */
export function calculateCashRunway(
  state: GameState,
  teamId: string,
): CashRunwayView {
  const ops = state.business.franchiseOps[teamId];
  const cash = state.business.finances[teamId]?.cash ?? 0;
  if (!ops) {
    return {
      cash,
      weeklyOutflow: 0,
      expectedWeeklyInflow: 0,
      netWeeklyBurn: 0,
      runwayWeeks: null,
    };
  }

  const year = state.competition.season.year;
  let staffWeekly = 0;
  for (const contract of Object.values(state.business.staffContracts)) {
    if (contract.teamId !== teamId || !isStaffContractActive(contract, year)) {
      continue;
    }
    const annual = getStaffContractSalaryForYear(contract, year) ?? 0;
    staffWeekly += Math.floor(annual / 52);
  }

  let facilityWeekly = 0;
  for (const category of FACILITY_CATEGORIES) {
    facilityWeekly += facilityWeeklyOpex(
      category,
      ops.facilities[category].level,
    );
  }

  const marketingWeekly = Math.floor(
    ops.marketing.budget / MARKETING_WEEKS_PER_YEAR,
  );
  const playerPayrollWeekly = Math.floor(
    getTeamPayroll(teamId as TeamId, year, state) / PLAYER_PAYROLL_WEEKS_PER_YEAR,
  );
  const weeklyOutflow =
    staffWeekly + facilityWeekly + marketingWeekly + playerPayrollWeekly;

  const forecast = buildForecast(state, teamId, ops);
  // Rough recurring inflow: ~1 home game every ~2 weeks in a typical schedule.
  const expectedWeeklyInflow = Math.round(forecast.totalGameDayRevenue / 2);

  const netWeeklyBurn = weeklyOutflow - expectedWeeklyInflow;
  const runwayWeeks =
    netWeeklyBurn > 0 ? Math.floor(cash / netWeeklyBurn) : null;

  return {
    cash,
    weeklyOutflow,
    expectedWeeklyInflow,
    netWeeklyBurn,
    runwayWeeks,
  };
}

export function toFranchiseBusinessView(state: GameState): FranchiseBusinessView {
  const teamId = state.user.controlledTeamId;
  const ops = requireOps(state, teamId);
  const team = state.world.teams[teamId]!;
  return {
    ticketPrice: ops.ticketPrice,
    fanSentiment: ops.fanSentiment,
    mediaAttention: ops.mediaAttention,
    marketSize: ops.marketSize,
    awareness: ops.marketing.awareness,
    marketingBudget: ops.marketing.budget,
    weeklyMarketingSpend: Math.floor(
      ops.marketing.budget / MARKETING_WEEKS_PER_YEAR,
    ),
    reputation: team.reputation,
    franchiseValue: calculateFranchiseValue(state, teamId),
    arenaCapacity: arenaCapacity(state, teamId),
    aiProfile: ops.aiProfile,
    forecast: buildForecast(state, teamId, ops),
    lastGameDay: readLastGameDay(state, teamId),
    cashRunway: calculateCashRunway(state, teamId),
  };
}

export function toSponsorshipsView(state: GameState): SponsorshipView[] {
  const teamId = state.user.controlledTeamId;
  return Object.values(state.business.sponsorships)
    .filter((s) => s.teamId === teamId)
    .map((s: Sponsorship) => ({
      id: s.id,
      sponsorName: s.sponsorName,
      annualValue: s.annualValue,
      startYear: s.startYear,
      endYear: s.endYear,
      status: s.status,
      reputationFloor: s.reputationFloor,
      playoffBonus: s.playoffBonus,
    }))
    .sort((a, b) => b.endYear - a.endYear);
}

export function toLeagueEconomyView(state: GameState): LeagueEconomy {
  return { ...state.business.leagueEconomy };
}

export function toRelocationView(state: GameState): RelocationProcess {
  const teamId = state.user.controlledTeamId;
  return (
    state.business.relocationByTeamId[teamId] ?? {
      teamId,
      stage: "none",
      target: null,
      cooldownSeasonsRemaining: 0,
      fee: 0,
    }
  );
}

export function toExpansionView(state: GameState): ExpansionState {
  return { ...state.business.expansion, candidates: [...state.business.expansion.candidates] };
}

export function toFranchiseHistoryView(state: GameState): FranchiseHistoryView {
  const teamId = state.user.controlledTeamId;
  const history = state.business.franchiseHistory[teamId];
  return { seasons: history ? [...history.seasons] : [] };
}

function requireOps(state: GameState, teamId: string): FranchiseOps {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    throw new Error(`franchiseOps missing for "${teamId}".`);
  }
  return ops;
}
