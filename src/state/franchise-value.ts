import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type {
  FranchiseSeasonRecord,
  PlayoffResultSnapshot,
} from "@/domain/entities/franchise-history";
import type { EconomicCycle } from "@/domain/entities/league-economy";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  BRAND_CURRENT_MOMENTUM_WEIGHT,
  BRAND_REPUTATION_PER_POINT,
  CASH_CONTRIBUTION_CAP,
  CASH_LOG_DOLLARS,
  CASH_LOG_SCALE,
  CHAMPIONSHIP_BASE_PREMIUM,
  CHAMPIONSHIP_DECAY_HALF_LIFE_SEASONS,
  CHAMPIONSHIP_DIMINISHING_K,
  DEFAULT_ATTENDANCE_REALIZATION,
  FACILITY_MEAN_LEVEL_DOLLARS,
  FAN_BASE_SENTIMENT_PER_POINT,
  FRANCHISE_STANDING_THRESHOLDS,
  FRANCHISE_VALUE_FLOOR,
  FRANCHISE_VALUE_INERTIA_ALPHA,
  FRANCHISE_VALUE_MAX_YOY_CHANGE,
  HISTORY_TRAIL_SEASONS,
  LEAGUE_BROADCAST_WEIGHT,
  LEAGUE_CYCLE_SCORE,
  LEAGUE_CYCLE_WEIGHT,
  LEAGUE_MULTIPLIER_MAX,
  LEAGUE_MULTIPLIER_MIN,
  LEAGUE_POPULARITY_WEIGHT,
  LEAGUE_SPONSORSHIP_WEIGHT,
  MARKET_POTENTIAL_PER_POINT,
  MARKET_REALIZATION_FLOOR,
  MARKET_REALIZATION_MAX,
  MARKET_REALIZATION_MIN,
  PERFORMANCE_CURRENT_MOMENTUM_WEIGHT,
  PERFORMANCE_PLAYOFF_DEPTH_DOLLARS,
  PERFORMANCE_PLAYOFF_RATE_DOLLARS,
  PERFORMANCE_WIN_PCT_DOLLARS,
  PROFIT_CONTRIBUTION_MAX,
  PROFIT_CONTRIBUTION_MIN,
  PROFIT_PER_DOLLAR,
  REVENUE_CONTRIBUTION_CAP,
  REVENUE_LOG_DOLLARS,
  REVENUE_LOG_SCALE,
  REVENUE_YEAR_WEIGHTS,
} from "@/state/franchise-value-config";
import { getFinancialStatement } from "@/systems/team-finances";

/**
 * Pure derived franchise valuation — never stored as live mutable state.
 * Used for season snapshots and UI selectors only.
 *
 * Franchise value is a valuation, not a score: durable assets, realized
 * commerce, competitive history, and macro conditions with inertia.
 */

export type FranchiseValueDriverKey =
  | "market"
  | "facilities"
  | "brand"
  | "fanBase"
  | "revenue"
  | "profitability"
  | "cash"
  | "performance"
  | "championships";

export type FranchiseStanding =
  | "emerging"
  | "established"
  | "major"
  | "elite"
  | "legacy";

export type FranchiseValueComponents = {
  market: number;
  /** Market potential before realization (for explainability). */
  marketPotential: number;
  /** Clamped realization used on market (0.45–1.05). */
  attendanceRealization: number;
  facilities: number;
  brand: number;
  fanBase: number;
  revenue: number;
  profitability: number;
  cash: number;
  performance: number;
  championships: number;
};

export type FranchiseValueExplanation = {
  components: FranchiseValueComponents;
  leagueMultiplier: number;
  instantaneousMark: number;
  lastSeasonSnapshot: number | null;
  inertiaAlpha: number;
  total: number;
  standing: FranchiseStanding;
  topPositiveDriver: FranchiseValueDriverKey | null;
  topNegativeDriver: FranchiseValueDriverKey | null;
};

const PLAYOFF_DEPTH_SCORE: Record<PlayoffResultSnapshot, number> = {
  missed: 0,
  first_round: 0.25,
  second_round: 0.45,
  conference_finals: 0.65,
  finals: 0.85,
  champion: 1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function meanFacilityLevel(
  facilities: Record<FacilityCategory, { level: number }>,
): number {
  let sum = 0;
  for (const category of FACILITY_CATEGORIES) {
    sum += facilities[category].level;
  }
  return sum / FACILITY_CATEGORIES.length;
}

function trailingSeasons(
  history: FranchiseSeasonRecord[] | undefined,
  count: number,
): FranchiseSeasonRecord[] {
  if (!history || history.length === 0) {
    return [];
  }
  return history.slice(-count);
}

function weightedAverage(
  values: number[],
  weights: readonly number[],
): number {
  let weightSum = 0;
  let valueSum = 0;
  for (let index = 0; index < values.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight <= 0) {
      continue;
    }
    weightSum += weight;
    valueSum += values[index]! * weight;
  }
  if (weightSum <= 0) {
    return 0;
  }
  return valueSum / weightSum;
}

function blendTrailAndCurrent(
  trailing: number | null,
  current: number,
  momentumWeight: number,
): number {
  if (trailing === null) {
    return current;
  }
  return trailing * (1 - momentumWeight) + current * momentumWeight;
}

export function readAttendanceRealization(
  state: GameState,
  teamId: TeamId,
): number {
  let fillSum = 0;
  let games = 0;
  for (const event of state.user.eventLog) {
    if (event.type !== "HomeGameDaySettled") {
      continue;
    }
    if (event.payload.teamId !== teamId) {
      continue;
    }
    const attendance = Number(event.payload.attendance) || 0;
    const capacity = Number(event.payload.capacity) || 0;
    if (capacity <= 0) {
      continue;
    }
    fillSum += attendance / capacity;
    games += 1;
  }
  if (games === 0) {
    return DEFAULT_ATTENDANCE_REALIZATION;
  }
  return clamp(fillSum / games, MARKET_REALIZATION_MIN, MARKET_REALIZATION_MAX);
}

export function calculateMarketValue(
  marketSize: number,
  realization: number,
): { market: number; marketPotential: number; attendanceRealization: number } {
  const marketPotential = marketSize * MARKET_POTENTIAL_PER_POINT;
  const clampedRealization = clamp(
    realization,
    MARKET_REALIZATION_MIN,
    MARKET_REALIZATION_MAX,
  );
  const factor =
    MARKET_REALIZATION_FLOOR +
    (1 - MARKET_REALIZATION_FLOOR) * clampedRealization;
  return {
    market: marketPotential * factor,
    marketPotential,
    attendanceRealization: clampedRealization,
  };
}

function calculateOrganizationalValue(input: {
  meanFacilityLevel: number;
  brandReputation: number;
  fanSentiment: number;
}): { facilities: number; brand: number; fanBase: number } {
  return {
    facilities: input.meanFacilityLevel * FACILITY_MEAN_LEVEL_DOLLARS,
    brand: input.brandReputation * BRAND_REPUTATION_PER_POINT,
    fanBase: input.fanSentiment * FAN_BASE_SENTIMENT_PER_POINT,
  };
}

function calculateFinancialValue(input: {
  normalizedRevenue: number;
  trailingNetIncome: number;
  cash: number;
}): { revenue: number; profitability: number; cash: number } {
  const revenueRaw =
    Math.log1p(Math.max(0, input.normalizedRevenue) / REVENUE_LOG_SCALE) *
    REVENUE_LOG_DOLLARS;
  const revenue = Math.min(REVENUE_CONTRIBUTION_CAP, revenueRaw);

  const profitability = clamp(
    input.trailingNetIncome * PROFIT_PER_DOLLAR,
    PROFIT_CONTRIBUTION_MIN,
    PROFIT_CONTRIBUTION_MAX,
  );

  const cashSign = input.cash < 0 ? -1 : 1;
  const cashRaw =
    cashSign *
    Math.log1p(Math.abs(input.cash) / CASH_LOG_SCALE) *
    CASH_LOG_DOLLARS;
  const cash = clamp(cashRaw, -CASH_CONTRIBUTION_CAP, CASH_CONTRIBUTION_CAP);

  return { revenue, profitability, cash };
}

function calculatePerformanceValue(input: {
  trailingWinPct: number;
  playoffRate: number;
  playoffDepth: number;
}): number {
  return (
    input.trailingWinPct * PERFORMANCE_WIN_PCT_DOLLARS +
    input.playoffRate * PERFORMANCE_PLAYOFF_RATE_DOLLARS +
    input.playoffDepth * PERFORMANCE_PLAYOFF_DEPTH_DOLLARS
  );
}

/**
 * Championship recency weight. Age 0 (current season) ≈ 1.
 * Documented decay: ~0.90 at age 1, ~0.65 at 5, ~0.35 at 10, ~0.10 at 20
 * with half-life ≈ 7 seasons: weight = 0.5^(age / halfLife) with floor 0.08.
 */
export function championshipDecayWeight(seasonsAgo: number): number {
  if (seasonsAgo < 0) {
    return 1;
  }
  const weight = Math.pow(
    0.5,
    seasonsAgo / CHAMPIONSHIP_DECAY_HALF_LIFE_SEASONS,
  );
  return Math.max(0.08, weight);
}

export function calculateChampionshipValue(
  championshipAges: number[],
): number {
  let effective = 0;
  for (const age of championshipAges) {
    effective += championshipDecayWeight(age);
  }
  if (effective <= 0) {
    return 0;
  }
  return (
    CHAMPIONSHIP_BASE_PREMIUM *
    (1 - Math.exp(-CHAMPIONSHIP_DIMINISHING_K * effective))
  );
}

function calculateLeagueMultiplier(input: {
  popularity: number;
  broadcastValue: number;
  sponsorshipClimate: number;
  cycle: EconomicCycle;
}): number {
  const cycleScore = LEAGUE_CYCLE_SCORE[input.cycle];
  const composite =
    input.popularity * LEAGUE_POPULARITY_WEIGHT +
    input.broadcastValue * LEAGUE_BROADCAST_WEIGHT +
    input.sponsorshipClimate * LEAGUE_SPONSORSHIP_WEIGHT +
    cycleScore * LEAGUE_CYCLE_WEIGHT;
  // Map 1–99 composite onto [MIN, MAX] with 50 → midpoint.
  const t = (composite - 1) / 98;
  const multiplier =
    LEAGUE_MULTIPLIER_MIN +
    t * (LEAGUE_MULTIPLIER_MAX - LEAGUE_MULTIPLIER_MIN);
  return clamp(multiplier, LEAGUE_MULTIPLIER_MIN, LEAGUE_MULTIPLIER_MAX);
}

function calculateInstantaneousMark(
  components: FranchiseValueComponents,
  leagueMultiplier: number,
): number {
  const sum =
    components.market +
    components.facilities +
    components.brand +
    components.fanBase +
    components.revenue +
    components.profitability +
    components.cash +
    components.performance +
    components.championships;
  return sum * leagueMultiplier;
}

function applyInertia(
  mark: number,
  lastSeasonSnapshot: number | null,
): number {
  if (lastSeasonSnapshot === null) {
    return mark;
  }
  const alpha = FRANCHISE_VALUE_INERTIA_ALPHA;
  let total = (1 - alpha) * lastSeasonSnapshot + alpha * mark;
  const maxYoY = FRANCHISE_VALUE_MAX_YOY_CHANGE;
  if (maxYoY !== null && lastSeasonSnapshot > 0) {
    const minTotal = lastSeasonSnapshot * (1 - maxYoY);
    const maxTotal = lastSeasonSnapshot * (1 + maxYoY);
    total = clamp(total, minTotal, maxTotal);
  }
  return total;
}

export function deriveFranchiseStanding(total: number): FranchiseStanding {
  const t = FRANCHISE_STANDING_THRESHOLDS;
  if (total >= t.legacy) {
    return "legacy";
  }
  if (total >= t.elite) {
    return "elite";
  }
  if (total >= t.major) {
    return "major";
  }
  if (total >= t.established) {
    return "established";
  }
  return "emerging";
}

const DRIVER_KEYS: FranchiseValueDriverKey[] = [
  "market",
  "facilities",
  "brand",
  "fanBase",
  "revenue",
  "profitability",
  "cash",
  "performance",
  "championships",
];

function rankValueDrivers(components: FranchiseValueComponents): {
  topPositiveDriver: FranchiseValueDriverKey | null;
  topNegativeDriver: FranchiseValueDriverKey | null;
} {
  let topPositiveDriver: FranchiseValueDriverKey | null = null;
  let topPositive = -Infinity;
  let topNegativeDriver: FranchiseValueDriverKey | null = null;
  let topNegative = Infinity;

  for (const key of DRIVER_KEYS) {
    const value = components[key];
    if (value > topPositive) {
      topPositive = value;
      topPositiveDriver = key;
    }
    if (value < topNegative) {
      topNegative = value;
      topNegativeDriver = key;
    }
  }

  if (topPositive <= 0) {
    topPositiveDriver = null;
  }
  if (topNegative >= 0) {
    topNegativeDriver = null;
  }

  return { topPositiveDriver, topNegativeDriver };
}

function collectChampionshipAges(
  history: FranchiseSeasonRecord[] | undefined,
  currentYear: number,
  isCurrentChampion: boolean,
): number[] {
  const ages: number[] = [];
  if (history) {
    for (const season of history) {
      if (!season.championship) {
        continue;
      }
      ages.push(Math.max(0, currentYear - season.seasonYear));
    }
  }
  if (isCurrentChampion) {
    const alreadyThisYear = history?.some(
      (s) => s.championship && s.seasonYear === currentYear,
    );
    if (!alreadyThisYear) {
      ages.push(0);
    }
  }
  return ages;
}

function resolveBrandInputs(
  state: GameState,
  teamId: TeamId,
  trail: FranchiseSeasonRecord[],
): { brandReputation: number; fanSentiment: number } {
  const team = state.world.teams[teamId]!;
  const ops = state.business.franchiseOps[teamId]!;
  const currentRep = team.reputation;
  const currentSent = ops.fanSentiment;

  if (trail.length === 0) {
    return { brandReputation: currentRep, fanSentiment: currentSent };
  }

  const trailingRep =
    trail.reduce((sum, s) => sum + s.reputation, 0) / trail.length;
  const trailingSent =
    trail.reduce((sum, s) => sum + s.fanSentiment, 0) / trail.length;

  return {
    brandReputation: blendTrailAndCurrent(
      trailingRep,
      currentRep,
      BRAND_CURRENT_MOMENTUM_WEIGHT,
    ),
    fanSentiment: blendTrailAndCurrent(
      trailingSent,
      currentSent,
      BRAND_CURRENT_MOMENTUM_WEIGHT,
    ),
  };
}

function resolveRevenueSeries(
  state: GameState,
  teamId: TeamId,
  currentYear: number,
  trail: FranchiseSeasonRecord[],
): number[] {
  const current = getFinancialStatement(state, teamId, currentYear).revenue
    .total;
  const values: number[] = [current];
  // Prefer statement books for prior years; fall back to history revenue.
  for (let age = 1; age < REVENUE_YEAR_WEIGHTS.length; age += 1) {
    const year = currentYear - age;
    const statement = getFinancialStatement(state, teamId, year);
    if (statement.revenue.total > 0) {
      values.push(statement.revenue.total);
      continue;
    }
    const fromHistory = trail.find((s) => s.seasonYear === year);
    if (fromHistory) {
      values.push(fromHistory.revenue);
    }
  }
  return values;
}

function resolveTrailingNetIncome(
  state: GameState,
  teamId: TeamId,
  currentYear: number,
): number {
  const incomes: number[] = [];
  const weights: number[] = [];
  for (let age = 0; age < HISTORY_TRAIL_SEASONS; age += 1) {
    const year = currentYear - age;
    const statement = getFinancialStatement(state, teamId, year);
    // Skip empty years with no books activity to avoid diluting with zeros
    // for brand-new franchises (except current year).
    const hasBooks =
      statement.revenue.total !== 0 || statement.expenses.total !== 0;
    if (!hasBooks && age > 0) {
      continue;
    }
    incomes.push(statement.netIncome);
    weights.push(REVENUE_YEAR_WEIGHTS[age] ?? 0.2);
  }
  if (incomes.length === 0) {
    return 0;
  }
  return weightedAverage(incomes, weights);
}

function resolvePerformanceInputs(
  state: GameState,
  teamId: TeamId,
  trail: FranchiseSeasonRecord[],
): { trailingWinPct: number; playoffRate: number; playoffDepth: number } {
  const standing = state.competition.standings.byTeamId[teamId];
  const currentGames = (standing?.wins ?? 0) + (standing?.losses ?? 0);
  const currentWinPct =
    currentGames > 0 ? (standing?.wins ?? 0) / currentGames : 0.5;

  if (trail.length === 0) {
    return {
      trailingWinPct: currentWinPct,
      playoffRate: 0,
      playoffDepth: 0,
    };
  }

  let winSum = 0;
  let gameSum = 0;
  let playoffCount = 0;
  let depthSum = 0;
  for (const season of trail) {
    const games = season.wins + season.losses;
    winSum += season.wins;
    gameSum += games;
    if (season.playoffResult !== "missed" || season.championship) {
      playoffCount += 1;
    }
    depthSum +=
      PLAYOFF_DEPTH_SCORE[
        season.championship ? "champion" : season.playoffResult
      ] ?? 0;
  }

  const trailWinPct = gameSum > 0 ? winSum / gameSum : currentWinPct;
  const trailingWinPct = blendTrailAndCurrent(
    trailWinPct,
    currentWinPct,
    PERFORMANCE_CURRENT_MOMENTUM_WEIGHT,
  );

  return {
    trailingWinPct,
    playoffRate: playoffCount / trail.length,
    playoffDepth: depthSum / trail.length,
  };
}

/**
 * Full explainable valuation. Single calculation path for UI and totals.
 */
export function explainFranchiseValue(
  state: GameState,
  teamId: TeamId,
): FranchiseValueExplanation {
  const team = state.world.teams[teamId];
  const ops = state.business.franchiseOps[teamId];
  const finances = state.business.finances[teamId];
  if (!team || !ops || !finances) {
    return {
      components: {
        market: 0,
        marketPotential: 0,
        attendanceRealization: DEFAULT_ATTENDANCE_REALIZATION,
        facilities: 0,
        brand: 0,
        fanBase: 0,
        revenue: 0,
        profitability: 0,
        cash: 0,
        performance: 0,
        championships: 0,
      },
      leagueMultiplier: 1,
      instantaneousMark: 0,
      lastSeasonSnapshot: null,
      inertiaAlpha: FRANCHISE_VALUE_INERTIA_ALPHA,
      total: 0,
      standing: "emerging",
      topPositiveDriver: null,
      topNegativeDriver: null,
    };
  }

  const history = state.business.franchiseHistory[teamId]?.seasons;
  const trail = trailingSeasons(history, HISTORY_TRAIL_SEASONS);
  const currentYear = state.competition.season.year;

  const realization = readAttendanceRealization(state, teamId);
  const market = calculateMarketValue(ops.marketSize, realization);

  const brandInputs = resolveBrandInputs(state, teamId, trail);
  const org = calculateOrganizationalValue({
    meanFacilityLevel: meanFacilityLevel(ops.facilities),
    brandReputation: brandInputs.brandReputation,
    fanSentiment: brandInputs.fanSentiment,
  });

  const revenueSeries = resolveRevenueSeries(
    state,
    teamId,
    currentYear,
    trail,
  );
  const normalizedRevenue = weightedAverage(
    revenueSeries,
    REVENUE_YEAR_WEIGHTS.slice(0, revenueSeries.length),
  );
  const trailingNetIncome = resolveTrailingNetIncome(
    state,
    teamId,
    currentYear,
  );
  const financial = calculateFinancialValue({
    normalizedRevenue,
    trailingNetIncome,
    cash: finances.cash,
  });

  const performanceInputs = resolvePerformanceInputs(state, teamId, trail);
  const performance = calculatePerformanceValue(performanceInputs);

  const isCurrentChampion =
    state.competition.playoffs.championTeamId === teamId;
  const championshipAges = collectChampionshipAges(
    history,
    currentYear,
    isCurrentChampion,
  );
  const championships = calculateChampionshipValue(championshipAges);

  const league = state.business.leagueEconomy;
  const leagueMultiplier = calculateLeagueMultiplier({
    popularity: league.popularity,
    broadcastValue: league.broadcastValue,
    sponsorshipClimate: league.sponsorshipClimate,
    cycle: league.cycle,
  });

  const components: FranchiseValueComponents = {
    market: market.market,
    marketPotential: market.marketPotential,
    attendanceRealization: market.attendanceRealization,
    facilities: org.facilities,
    brand: org.brand,
    fanBase: org.fanBase,
    revenue: financial.revenue,
    profitability: financial.profitability,
    cash: financial.cash,
    performance,
    championships,
  };

  const instantaneousMark = calculateInstantaneousMark(
    components,
    leagueMultiplier,
  );

  const lastSeasonSnapshot =
    history && history.length > 0
      ? history[history.length - 1]!.franchiseValue
      : null;

  const smoothed = applyInertia(instantaneousMark, lastSeasonSnapshot);
  const total = Math.max(FRANCHISE_VALUE_FLOOR, Math.round(smoothed));
  const drivers = rankValueDrivers(components);

  return {
    components,
    leagueMultiplier,
    instantaneousMark,
    lastSeasonSnapshot,
    inertiaAlpha: FRANCHISE_VALUE_INERTIA_ALPHA,
    total,
    standing: deriveFranchiseStanding(total),
    topPositiveDriver: drivers.topPositiveDriver,
    topNegativeDriver: drivers.topNegativeDriver,
  };
}

export function calculateFranchiseValue(
  state: GameState,
  teamId: TeamId,
): number {
  return explainFranchiseValue(state, teamId).total;
}
