import { describe, expect, it } from "vitest";
import {
  createEmptyTeamFinanceBooks,
  type TeamFinanceBooks,
} from "@/domain/entities/finances";
import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type {
  FranchiseSeasonRecord,
  PlayoffResultSnapshot,
} from "@/domain/entities/franchise-history";
import { createDomainEvent } from "@/domain/events";
import { asSeasonId, asTeamId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { appendEventLog, type GameState } from "@/state/game-state";
import {
  calculateChampionshipValue,
  calculateFranchiseValue,
  championshipDecayWeight,
  explainFranchiseValue,
} from "@/state/franchise-value";
import {
  CASH_CONTRIBUTION_CAP,
  CHAMPIONSHIP_BASE_PREMIUM,
  LEAGUE_MULTIPLIER_MAX,
  LEAGUE_MULTIPLIER_MIN,
  MARKET_POTENTIAL_PER_POINT,
  MARKET_REALIZATION_FLOOR,
} from "@/state/franchise-value-config";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";

function boot(saveId: string): GameState {
  const state = createTestGameState({ saveId });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

function teamIdOf(state: GameState): TeamId {
  return state.user.controlledTeamId;
}

function withOps(
  state: GameState,
  patch: Partial<GameState["business"]["franchiseOps"][string]>,
): GameState {
  const teamId = teamIdOf(state);
  const ops = state.business.franchiseOps[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: { ...ops, ...patch },
      },
    },
  };
}

function withReputation(state: GameState, reputation: number): GameState {
  const teamId = teamIdOf(state);
  return {
    ...state,
    world: {
      ...state.world,
      teams: {
        ...state.world.teams,
        [teamId]: { ...state.world.teams[teamId]!, reputation },
      },
    },
  };
}

function withCash(state: GameState, cash: number): GameState {
  const teamId = teamIdOf(state);
  const finances = state.business.finances[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      finances: {
        ...state.business.finances,
        [teamId]: { ...finances, cash },
      },
    },
  };
}

function booksWithRevenue(revenueTotal: number): TeamFinanceBooks {
  const books = createEmptyTeamFinanceBooks();
  return {
    ...books,
    revenue: { ...books.revenue, tickets: revenueTotal },
  };
}

function booksWithPnL(
  revenueTotal: number,
  expenseTotal: number,
): TeamFinanceBooks {
  const books = createEmptyTeamFinanceBooks();
  return {
    revenue: { ...books.revenue, tickets: revenueTotal },
    expenses: { ...books.expenses, operations: expenseTotal },
  };
}

function withYearBooks(
  state: GameState,
  year: number,
  books: TeamFinanceBooks,
): GameState {
  const teamId = teamIdOf(state);
  const finances = state.business.finances[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      finances: {
        ...state.business.finances,
        [teamId]: {
          ...finances,
          booksByYear: {
            ...finances.booksByYear,
            [String(year)]: books,
          },
        },
      },
    },
  };
}

function withFacilityLevels(
  state: GameState,
  level: number,
): GameState {
  const teamId = teamIdOf(state);
  const ops = state.business.franchiseOps[teamId]!;
  const facilities = { ...ops.facilities };
  for (const category of FACILITY_CATEGORIES) {
    facilities[category] = {
      level,
      upgradeWeeksRemaining: 0,
    };
  }
  return withOps(state, { facilities });
}

function withLeague(
  state: GameState,
  patch: Partial<GameState["business"]["leagueEconomy"]>,
): GameState {
  return {
    ...state,
    business: {
      ...state.business,
      leagueEconomy: { ...state.business.leagueEconomy, ...patch },
    },
  };
}

function withStandings(
  state: GameState,
  wins: number,
  losses: number,
): GameState {
  const teamId = teamIdOf(state);
  const prior = state.competition.standings.byTeamId[teamId]!;
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: {
        ...state.competition.standings,
        byTeamId: {
          ...state.competition.standings.byTeamId,
          [teamId]: {
            ...prior,
            wins,
            losses,
            winPercentage: wins + losses > 0 ? wins / (wins + losses) : 0,
          },
        },
      },
    },
  };
}

function withChampion(state: GameState, champion: boolean): GameState {
  const teamId = teamIdOf(state);
  return {
    ...state,
    competition: {
      ...state.competition,
      playoffs: {
        ...state.competition.playoffs,
        championTeamId: champion ? teamId : undefined,
      },
    },
  };
}

function seasonRecord(input: {
  year: number;
  wins?: number;
  losses?: number;
  playoffResult?: PlayoffResultSnapshot;
  championship?: boolean;
  revenue?: number;
  cash?: number;
  fanSentiment?: number;
  reputation?: number;
  franchiseValue?: number;
  facilityLevel?: number;
}): FranchiseSeasonRecord {
  const level = input.facilityLevel ?? 1;
  const facilityLevels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    facilityLevels[category] = level;
  }
  return {
    seasonId: asSeasonId(`season_${input.year}`),
    seasonYear: input.year,
    wins: input.wins ?? 30,
    losses: input.losses ?? 52,
    playoffResult: input.playoffResult ?? "missed",
    championship: input.championship ?? false,
    revenue: input.revenue ?? 80_000_000,
    attendance: null,
    cash: input.cash ?? 40_000_000,
    fanSentiment: input.fanSentiment ?? 50,
    reputation: input.reputation ?? 50,
    facilityLevels,
    relocated: false,
    city: "Test City",
    name: "Test Team",
    notableEventIds: [],
    franchiseValue: input.franchiseValue ?? 450_000_000,
  };
}

function withHistory(
  state: GameState,
  seasons: FranchiseSeasonRecord[],
): GameState {
  const teamId = teamIdOf(state);
  return {
    ...state,
    business: {
      ...state.business,
      franchiseHistory: {
        ...state.business.franchiseHistory,
        [teamId]: { teamId, seasons },
      },
    },
  };
}

function withFillRate(
  state: GameState,
  fillRate: number,
  capacity = 18_000,
): GameState {
  const teamId = teamIdOf(state);
  const attendance = Math.round(capacity * fillRate);
  const event = createDomainEvent({
    type: "HomeGameDaySettled",
    occurredOn: state.world.calendar.currentDate,
    payload: {
      teamId,
      gameId: "game_fv_test",
      attendance,
      capacity,
      gaAttendance: attendance,
      premiumOccupancy: 0,
    },
  });
  return appendEventLog(state, [event]);
}

describe("franchise value — championship decay", () => {
  it("decays with age and stays above a floor", () => {
    expect(championshipDecayWeight(0)).toBeCloseTo(1, 5);
    expect(championshipDecayWeight(1)).toBeGreaterThan(0.85);
    expect(championshipDecayWeight(5)).toBeGreaterThan(0.55);
    expect(championshipDecayWeight(5)).toBeLessThan(0.7);
    expect(championshipDecayWeight(10)).toBeGreaterThan(0.3);
    expect(championshipDecayWeight(10)).toBeLessThan(0.45);
    expect(championshipDecayWeight(20)).toBeLessThan(0.2);
    expect(championshipDecayWeight(20)).toBeGreaterThanOrEqual(0.08);
  });

  it("applies diminishing returns — 10 titles ≪ 10× one title", () => {
    const one = calculateChampionshipValue([0]);
    const ten = calculateChampionshipValue(Array(10).fill(0));
    expect(ten).toBeLessThan(one * 4);
    expect(ten).toBeLessThan(CHAMPIONSHIP_BASE_PREMIUM);
    expect(ten).toBeGreaterThan(one);
  });

  it("values recent titles above old ones", () => {
    const recent = calculateChampionshipValue([0]);
    const old = calculateChampionshipValue([15]);
    expect(recent).toBeGreaterThan(old);
  });
});

describe("franchise value — invariants", () => {
  it("never returns negative value", () => {
    let state = boot("fv_floor");
    const teamId = teamIdOf(state);
    state = withOps(state, { marketSize: 1, fanSentiment: 1 });
    state = withReputation(state, 1);
    state = withCash(state, -200_000_000);
    state = withFacilityLevels(state, 1);
    state = withYearBooks(
      state,
      state.competition.season.year,
      booksWithPnL(1_000_000, 200_000_000),
    );
    expect(calculateFranchiseValue(state, teamId)).toBeGreaterThanOrEqual(0);
  });

  it("is monotonic in market size", () => {
    let low = boot("fv_mkt_lo");
    let high = boot("fv_mkt_hi");
    low = withOps(low, { marketSize: 30 });
    high = withOps(high, { marketSize: 90 });
    expect(calculateFranchiseValue(high, teamIdOf(high))).toBeGreaterThan(
      calculateFranchiseValue(low, teamIdOf(low)),
    );
  });

  it("is monotonic in attendance realization without dominating market", () => {
    let weak = boot("fv_real_weak");
    let strong = boot("fv_real_strong");
    weak = withOps(weak, { marketSize: 90 });
    strong = withOps(strong, { marketSize: 90 });
    weak = withFillRate(weak, 0.45);
    strong = withFillRate(strong, 1.05);
    const weakExplain = explainFranchiseValue(weak, teamIdOf(weak));
    const strongExplain = explainFranchiseValue(strong, teamIdOf(strong));
    expect(strongExplain.total).toBeGreaterThan(weakExplain.total);
    // Large market + poor realization still keeps most of potential
    const potential = 90 * MARKET_POTENTIAL_PER_POINT;
    expect(weakExplain.components.market).toBeGreaterThan(
      potential * MARKET_REALIZATION_FLOOR * 0.95,
    );
  });

  it("tiny market + max realization is not a giant-market franchise", () => {
    let tiny = boot("fv_tiny_dynasty");
    let giant = boot("fv_giant_weak");
    tiny = withOps(tiny, { marketSize: 25, fanSentiment: 90 });
    tiny = withReputation(tiny, 90);
    tiny = withFillRate(tiny, 1.05);
    tiny = withFacilityLevels(tiny, 5);
    giant = withOps(giant, { marketSize: 95, fanSentiment: 30 });
    giant = withReputation(giant, 30);
    giant = withFillRate(giant, 0.45);
    const tinyMarket = explainFranchiseValue(tiny, teamIdOf(tiny)).components
      .market;
    const giantMarket = explainFranchiseValue(giant, teamIdOf(giant))
      .components.market;
    expect(giantMarket).toBeGreaterThan(tinyMarket);
  });

  it("is monotonic in revenue", () => {
    let low = boot("fv_rev_lo");
    let high = boot("fv_rev_hi");
    const year = low.competition.season.year;
    low = withYearBooks(low, year, booksWithRevenue(60_000_000));
    high = withYearBooks(high, year, booksWithRevenue(180_000_000));
    expect(calculateFranchiseValue(high, teamIdOf(high))).toBeGreaterThan(
      calculateFranchiseValue(low, teamIdOf(low)),
    );
  });

  it("does not treat a one-year revenue spike as sustainable peak", () => {
    let spike = boot("fv_rev_spike");
    const year = spike.competition.season.year;
    spike = withYearBooks(spike, year - 2, booksWithRevenue(100_000_000));
    spike = withYearBooks(spike, year - 1, booksWithRevenue(105_000_000));
    spike = withYearBooks(spike, year, booksWithRevenue(250_000_000));
    let steady = boot("fv_rev_steady");
    steady = withYearBooks(steady, year - 2, booksWithRevenue(250_000_000));
    steady = withYearBooks(steady, year - 1, booksWithRevenue(250_000_000));
    steady = withYearBooks(steady, year, booksWithRevenue(250_000_000));
    const spikeRev = explainFranchiseValue(spike, teamIdOf(spike)).components
      .revenue;
    const steadyRev = explainFranchiseValue(steady, teamIdOf(steady))
      .components.revenue;
    expect(spikeRev).toBeLessThan(steadyRev);
  });

  it("is monotonic in profitability", () => {
    let loss = boot("fv_profit_lo");
    let profit = boot("fv_profit_hi");
    const year = loss.competition.season.year;
    loss = withYearBooks(loss, year, booksWithPnL(80_000_000, 120_000_000));
    profit = withYearBooks(
      profit,
      year,
      booksWithPnL(120_000_000, 80_000_000),
    );
    expect(calculateFranchiseValue(profit, teamIdOf(profit))).toBeGreaterThan(
      calculateFranchiseValue(loss, teamIdOf(loss)),
    );
  });

  it("cash hoarding does not meaningfully inflate value", () => {
    let poor = boot("fv_cash_same");
    let rich = boot("fv_cash_same");
    poor = withOps(poor, { marketSize: 50, fanSentiment: 50 });
    rich = withOps(rich, { marketSize: 50, fanSentiment: 50 });
    poor = withReputation(poor, 50);
    rich = withReputation(rich, 50);
    poor = withFacilityLevels(poor, 2);
    rich = withFacilityLevels(rich, 2);
    poor = withCash(poor, 20_000_000);
    rich = withCash(rich, 100_000_000);
    const delta =
      calculateFranchiseValue(rich, teamIdOf(rich)) -
      calculateFranchiseValue(poor, teamIdOf(poor));
    expect(Math.abs(delta)).toBeLessThan(CASH_CONTRIBUTION_CAP);
    expect(Math.abs(delta)).toBeLessThan(15_000_000);
  });

  it("more championships increase value with a finite premium", () => {
    let none = boot("fv_chip_0");
    let one = boot("fv_chip_1");
    const year = none.competition.season.year;
    none = withHistory(none, [
      seasonRecord({ year: year - 1, championship: false }),
    ]);
    one = withHistory(one, [
      seasonRecord({ year: year - 1, championship: true }),
    ]);
    one = withChampion(one, true);
    const noneV = calculateFranchiseValue(none, teamIdOf(none));
    const oneV = calculateFranchiseValue(one, teamIdOf(one));
    expect(oneV).toBeGreaterThan(noneV);
    const chip = explainFranchiseValue(one, teamIdOf(one)).components
      .championships;
    expect(chip).toBeLessThan(CHAMPIONSHIP_BASE_PREMIUM);
  });

  it("better trailing performance increases value", () => {
    let weak = boot("fv_perf_lo");
    let strong = boot("fv_perf_hi");
    const year = weak.competition.season.year;
    weak = withHistory(weak, [
      seasonRecord({
        year: year - 1,
        wins: 25,
        losses: 57,
        playoffResult: "missed",
      }),
      seasonRecord({
        year: year - 2,
        wins: 28,
        losses: 54,
        playoffResult: "missed",
      }),
    ]);
    strong = withHistory(strong, [
      seasonRecord({
        year: year - 1,
        wins: 55,
        losses: 27,
        playoffResult: "conference_finals",
      }),
      seasonRecord({
        year: year - 2,
        wins: 52,
        losses: 30,
        playoffResult: "second_round",
      }),
    ]);
    expect(calculateFranchiseValue(strong, teamIdOf(strong))).toBeGreaterThan(
      calculateFranchiseValue(weak, teamIdOf(weak)),
    );
  });

  it("league multiplier stays within configured bounds", () => {
    let boom = boot("fv_league_hi");
    let bust = boot("fv_league_lo");
    boom = withLeague(boom, {
      popularity: 99,
      broadcastValue: 99,
      sponsorshipClimate: 99,
      cycle: "growth",
    });
    bust = withLeague(bust, {
      popularity: 1,
      broadcastValue: 1,
      sponsorshipClimate: 1,
      cycle: "recession",
    });
    const hi = explainFranchiseValue(boom, teamIdOf(boom)).leagueMultiplier;
    const lo = explainFranchiseValue(bust, teamIdOf(bust)).leagueMultiplier;
    expect(hi).toBeLessThanOrEqual(LEAGUE_MULTIPLIER_MAX);
    expect(lo).toBeGreaterThanOrEqual(LEAGUE_MULTIPLIER_MIN);
    expect(hi).toBeGreaterThan(lo);
  });

  it("does not double-count arena via capacity", () => {
    let lowArena = boot("fv_arena_lo");
    let highArena = boot("fv_arena_hi");
    lowArena = withFacilityLevels(lowArena, 1);
    // Only raise arena; other facilities stay level 1
    const teamId = teamIdOf(highArena);
    const ops = highArena.business.franchiseOps[teamId]!;
    highArena = withOps(highArena, {
      facilities: {
        ...ops.facilities,
        arena: { level: 5, upgradeWeeksRemaining: 0 },
      },
    });
    const lowExplain = explainFranchiseValue(lowArena, teamIdOf(lowArena));
    const highExplain = explainFranchiseValue(highArena, teamIdOf(highArena));
    // Facilities rise with mean level only — no separate capacity pile
    expect(highExplain.components.facilities).toBeGreaterThan(
      lowExplain.components.facilities,
    );
    expect(highExplain.components.facilities).toBeLessThan(
      5 * 8_000_000 + 1,
    );
  });

  it("explainFranchiseValue.total matches calculateFranchiseValue", () => {
    const state = boot("fv_explain_eq");
    const teamId = teamIdOf(state);
    expect(explainFranchiseValue(state, teamId).total).toBe(
      calculateFranchiseValue(state, teamId),
    );
  });

  it("applies inertia against last season snapshot", () => {
    let state = boot("fv_inertia");
    const teamId = teamIdOf(state);
    const year = state.competition.season.year;
    state = withHistory(state, [
      seasonRecord({ year: year - 1, franchiseValue: 400_000_000 }),
    ]);
    // Dramatically better mark inputs
    state = withOps(state, { marketSize: 95, fanSentiment: 95 });
    state = withReputation(state, 95);
    state = withFacilityLevels(state, 5);
    state = withYearBooks(state, year, booksWithRevenue(200_000_000));
    const explained = explainFranchiseValue(state, teamId);
    expect(explained.lastSeasonSnapshot).toBe(400_000_000);
    expect(explained.instantaneousMark).toBeGreaterThan(400_000_000);
    // Blended total should sit between snapshot and mark
    expect(explained.total).toBeGreaterThan(400_000_000);
    expect(explained.total).toBeLessThan(explained.instantaneousMark);
  });
});
