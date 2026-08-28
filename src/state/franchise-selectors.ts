import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
  type FranchiseOps,
} from "@/domain/entities/franchise-ops";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";
import {
  computeFranchiseHistoryMilestones,
  getSeasonHistoricalHighlights,
  type FranchiseHistoryMilestones,
  type HistoricalHighlight,
} from "@/state/franchise-history-milestones";
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
import {
  explainFranchiseValue,
  type FranchiseStanding,
  type FranchiseValueExplanation,
} from "@/state/franchise-value";
import type { DemandContribution } from "@/systems/demand/calculate-demand";
import {
  explainTicketDemand,
  fanFacilityDemandRaw,
} from "@/systems/demand/calculate-demand";
import { forecastNextHomeGameDay } from "@/systems/demand/forecast-game-day";
import { revenuePerAttendee } from "@/systems/demand/resolve-attendance";
import { arenaCapacity } from "@/systems/facilities";
import { facilityUpgradeCost } from "@/systems/facilities-config";
import { MARKETING_WEEKS_PER_YEAR } from "@/systems/marketing-config";
import { projectCashHorizon } from "@/systems/cash-projection";
import {
  calculateFinancialHealth,
  type FinancialHealthState,
} from "@/systems/financial-health";
import { getActiveOwnedFranchise } from "@/state/owner-context";

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
  gaAttendance: number;
  premiumOccupancy: number;
  capacity: number;
  premiumCapacity: number;
  fillRatePct: number;
  ticketPrice: number;
  premiumTicketPrice: number;
  ticketRevenue: number;
  premiumRevenue: number;
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
  gaAttendance: number;
  premiumOccupancy: number;
  capacity: number;
  premiumCapacity: number;
  fillRatePct: number;
  demandScore: number;
  ticketPrice: number;
  premiumTicketPrice: number;
  ticketRevenue: number;
  premiumRevenue: number;
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
  /** First horizon week projected cash is <= 0; null if cash stays positive. */
  runwayWeeks: number | null;
  projectedCash: number;
  horizonEndDate: string;
  horizonKind: "season" | "near_term";
  inflowBreakdown: {
    gate: number;
    sponsorship: number;
    broadcast: number;
  };
  outflowBreakdown: {
    playerPayroll: number;
    staff: number;
    facilities: number;
    marketing: number;
  };
  primaryPressure: "player_payroll" | "staff" | "facilities" | "marketing";
  health: FinancialHealthState;
};

export type FranchiseBusinessView = {
  ticketPrice: number;
  premiumTicketPrice: number;
  fanSentiment: number;
  mediaAttention: number;
  marketSize: number;
  awareness: number;
  marketingBudget: number;
  /** Derived weekly marketing burn from annual budget. */
  weeklyMarketingSpend: number;
  reputation: number;
  franchiseValue: number;
  /** Explainable valuation breakdown (presentation / diagnostics). */
  franchiseValueBreakdown: FranchiseValueExplanation;
  /** Organizational stature — not owner career success. */
  franchiseStanding: FranchiseStanding;
  arenaCapacity: number;
  aiProfile: string;
  spendingTolerance: number;
  patience: number;
  riskTolerance: number;
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

export type FranchiseHistorySeasonRow = FranchiseSeasonRecord & {
  playoffLabel: string;
  highlights: HistoricalHighlight[];
};

export type FranchiseHistoryView = {
  seasons: FranchiseHistorySeasonRow[];
  milestones: FranchiseHistoryMilestones;
  ownerTenureYears: number;
};

export function formatPlayoffResultLabel(
  season: FranchiseSeasonRecord,
): string {
  if (season.championship) {
    return "Champion";
  }
  return season.playoffResult.replaceAll("_", " ");
}

export function toStaffView(state: GameState): {
  roster: StaffMemberView[];
  available: StaffMemberView[];
} {
  const teamId = state.user.activeOwnerTeamId;
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
  const teamId = state.user.activeOwnerTeamId;
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
  const forecast = forecastNextHomeGameDay(state, teamId, ops);
  const explanation = explainTicketDemand({
    marketSize: ops.marketSize,
    fanSentiment: ops.fanSentiment,
    reputation: state.world.teams[teamId]?.reputation ?? 50,
    awareness: ops.marketing.awareness,
    mediaAttention: ops.mediaAttention,
    leaguePopularity: state.business.leagueEconomy.popularity,
    winPct: teamWinPct(state, teamId),
    fanFacility: fanFacilityDemandRaw(ops.facilities.fan.level),
    opponentWinPct: 0.5,
  });
  return {
    ...forecast,
    demandContributors: toContributorViews(explanation.contributions),
  };
}

function readLastGameDay(
  state: GameState,
  teamId: string,
): LastGameDayView | null {
  for (let index = getActiveOwnedFranchise(state).eventLog.length - 1; index >= 0; index -= 1) {
    const event = getActiveOwnedFranchise(state).eventLog[index]!;
    if (event.type !== "HomeGameDaySettled") {
      continue;
    }
    const payload = event.payload;
    if (payload.teamId !== teamId) {
      continue;
    }
    const attendance = Number(payload.attendance) || 0;
    const gaAttendance = Number(payload.gaAttendance) || attendance;
    const premiumOccupancy = Number(payload.premiumOccupancy) || 0;
    const capacity = Number(payload.capacity) || 0;
    const premiumCapacity = Number(payload.premiumCapacity) || 0;
    const ticketRevenue = Number(payload.ticketRevenue) || 0;
    const premiumRevenue = Number(payload.premiumRevenue) || 0;
    const merchRevenue = Number(payload.merchRevenue) || 0;
    const concessionsRevenue = Number(payload.concessionsRevenue) || 0;
    const totalGameDayRevenue =
      ticketRevenue + premiumRevenue + merchRevenue + concessionsRevenue;
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
      gaAttendance,
      premiumOccupancy,
      capacity,
      premiumCapacity,
      fillRatePct:
        capacity > 0 ? Math.round((attendance / capacity) * 100) : 0,
      demandScore: Number(payload.demandScore) || 0,
      ticketPrice: Number(payload.ticketPrice) || 0,
      premiumTicketPrice: Number(payload.premiumTicketPrice) || 0,
      ticketRevenue,
      premiumRevenue,
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
              premiumRevenue,
            ),
      demandContributors: toContributorViews(contributions),
    };
  }
  return null;
}

/**
 * Cash runway from a constant-condition horizon walk of known cadences.
 * Does not simulate future games.
 */
export function calculateCashRunway(
  state: GameState,
  teamId: string,
): CashRunwayView {
  const cash = state.business.finances[teamId]?.cash ?? 0;
  const projection = projectCashHorizon(state, teamId);
  const health = calculateFinancialHealth({
    cash,
    weeklyOutflow: projection.weeklyOutflow,
    netWeeklyBurn: projection.netWeeklyBurn,
    runwayWeeks: projection.runwayWeeks,
    projectedCash: projection.projectedCash,
  });
  return {
    cash,
    weeklyOutflow: projection.weeklyOutflow,
    expectedWeeklyInflow: projection.expectedWeeklyInflow,
    netWeeklyBurn: projection.netWeeklyBurn,
    runwayWeeks: projection.runwayWeeks,
    projectedCash: projection.projectedCash,
    horizonEndDate: projection.horizonEndDate,
    horizonKind: projection.horizonKind,
    inflowBreakdown: projection.inflowBreakdown,
    outflowBreakdown: projection.outflowBreakdown,
    primaryPressure: projection.primaryPressure,
    health,
  };
}

export function toFranchiseBusinessView(state: GameState): FranchiseBusinessView {
  const teamId = state.user.activeOwnerTeamId;
  const ops = requireOps(state, teamId);
  const team = state.world.teams[teamId]!;
  const franchiseValueBreakdown = explainFranchiseValue(state, teamId);
  return {
    ticketPrice: ops.ticketPrice,
    premiumTicketPrice: ops.premiumTicketPrice,
    fanSentiment: ops.fanSentiment,
    mediaAttention: ops.mediaAttention,
    marketSize: ops.marketSize,
    awareness: ops.marketing.awareness,
    marketingBudget: ops.marketing.budget,
    weeklyMarketingSpend: Math.floor(
      ops.marketing.budget / MARKETING_WEEKS_PER_YEAR,
    ),
    reputation: team.reputation,
    franchiseValue: franchiseValueBreakdown.total,
    franchiseValueBreakdown,
    franchiseStanding: franchiseValueBreakdown.standing,
    arenaCapacity: arenaCapacity(state, teamId),
    aiProfile: ops.aiProfile,
    spendingTolerance: ops.spendingTolerance,
    patience: ops.patience,
    riskTolerance: ops.riskTolerance,
    forecast: buildForecast(state, teamId, ops),
    lastGameDay: readLastGameDay(state, teamId),
    cashRunway: calculateCashRunway(state, teamId),
  };
}

export function toSponsorshipsView(state: GameState): SponsorshipView[] {
  const teamId = state.user.activeOwnerTeamId;
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
  const teamId = state.user.activeOwnerTeamId;
  const year = state.competition.season.year;
  return (
    state.business.relocationByTeamId[teamId] ?? {
      teamId,
      stage: "none",
      target: null,
      cooldownSeasonsRemaining: 0,
      fee: 0,
      cityStartSeasonYear: year,
      lastCompletedRelocationSeasonYear: null,
      failedAttemptCooldownSeasonsRemaining: 0,
    }
  );
}

export function toExpansionView(state: GameState): ExpansionState {
  return { ...state.business.expansion, candidates: [...state.business.expansion.candidates] };
}

export function toFranchiseHistoryView(state: GameState): FranchiseHistoryView {
  const teamId = state.user.activeOwnerTeamId;
  const history = state.business.franchiseHistory[teamId];
  const seasons = history ? [...history.seasons] : [];
  const milestones = computeFranchiseHistoryMilestones(
    seasons,
    getActiveOwnedFranchise(state).ownerStartSeasonYear,
    state.competition.season.year,
  );
  const highlightsByYear = getSeasonHistoricalHighlights(seasons);
  return {
    seasons: seasons.map((season) => ({
      ...season,
      playoffLabel: formatPlayoffResultLabel(season),
      highlights: highlightsByYear.get(season.seasonYear) ?? [],
    })),
    milestones,
    ownerTenureYears: milestones.currentOwnershipTenureYears,
  };
}

function requireOps(state: GameState, teamId: string): FranchiseOps {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    throw new Error(`franchiseOps missing for "${teamId}".`);
  }
  return ops;
}
