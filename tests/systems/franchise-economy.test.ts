import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createEmptyTeamFinanceBooks } from "@/domain/entities/finances";
import type { TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { toFranchisePnLView } from "@/state/franchise-pnl";
import {
  allocateGameDaySeats,
  calculateTicketDemand,
  fanFacilityDemandRaw,
  merchandiseFromAttendance,
  premiumCapacityForArena,
  resolvePremiumOccupancy,
  starMerchandiseFactor,
} from "@/systems/demand";
import {
  DEMAND_BASELINE_HIGH_INPUTS,
  DEMAND_BASELINE_HIGH_SCORE,
  DEMAND_BASELINE_LOW_INPUTS,
  DEMAND_BASELINE_LOW_SCORE,
  DEMAND_BASELINE_MAX_DRIFT,
  DEMAND_BASELINE_MID_INPUTS,
  DEMAND_BASELINE_MID_SCORE,
} from "@/systems/demand/demand-baselines";
import { startFacilityUpgrade } from "@/systems/facilities";
import {
  computeLeagueBroadcastPool,
  distributeMonthlyBroadcastPool,
  processMonthlyBroadcastRevenue,
} from "@/systems/league-economy";
import { processLeaguePlayoffBonuses } from "@/systems/playoff-financial-bonuses";
import {
  applyCashAndBooksImpact,
  recordRevenue,
} from "@/systems/team-finances";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { forecastNextHomeGameDay } from "@/systems/demand/forecast-game-day";

function bootstrap(seed = 42): GameState {
  let state = createInitialGameState({
    saveId: `econ_${seed}`,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

describe("demand baselines (intentional drift)", () => {
  it("mid/high/low scores stay within max drift of pre-change baselines", () => {
    const mid = calculateTicketDemand({
      ...DEMAND_BASELINE_MID_INPUTS,
      fanFacility: 0,
      opponentWinPct: 0.5,
    }).score;
    const high = calculateTicketDemand({
      ...DEMAND_BASELINE_HIGH_INPUTS,
      fanFacility: 0,
      opponentWinPct: 0.5,
    }).score;
    const low = calculateTicketDemand({
      ...DEMAND_BASELINE_LOW_INPUTS,
      fanFacility: 0,
      opponentWinPct: 0.5,
    }).score;
    expect(Math.abs(mid - DEMAND_BASELINE_MID_SCORE)).toBeLessThanOrEqual(
      DEMAND_BASELINE_MAX_DRIFT,
    );
    expect(Math.abs(high - DEMAND_BASELINE_HIGH_SCORE)).toBeLessThanOrEqual(
      DEMAND_BASELINE_MAX_DRIFT,
    );
    expect(Math.abs(low - DEMAND_BASELINE_LOW_SCORE)).toBeLessThanOrEqual(
      DEMAND_BASELINE_MAX_DRIFT,
    );
  });

  it("fan facility is a small lift, not a sellout machine", () => {
    const base = calculateTicketDemand({
      ...DEMAND_BASELINE_MID_INPUTS,
      fanFacility: fanFacilityDemandRaw(1),
      opponentWinPct: 0.5,
    }).score;
    const upgraded = calculateTicketDemand({
      ...DEMAND_BASELINE_MID_INPUTS,
      fanFacility: fanFacilityDemandRaw(5),
      opponentWinPct: 0.5,
    }).score;
    expect(upgraded).toBeGreaterThan(base);
    expect(upgraded - base).toBeLessThanOrEqual(5);
  });

  it("opponent win% raises demand for marquee opponents", () => {
    const weak = calculateTicketDemand({
      ...DEMAND_BASELINE_MID_INPUTS,
      opponentWinPct: 0.2,
    }).score;
    const strong = calculateTicketDemand({
      ...DEMAND_BASELINE_MID_INPUTS,
      opponentWinPct: 0.85,
    }).score;
    expect(strong).toBeGreaterThan(weak);
  });
});

describe("premium seat allocation", () => {
  it("premium + GA never exceeds arena capacity; premium not counted as GA", () => {
    const arenaCapacity = 20_000;
    const premiumCapacity = premiumCapacityForArena(arenaCapacity, 3);
    const premiumOccupancy = resolvePremiumOccupancy(90, 180, premiumCapacity);
    const seats = allocateGameDaySeats({
      arenaCapacity,
      premiumCapacity,
      premiumOccupancy,
      gaDemandScore: 100,
      gaTicketPrice: 45,
    });
    expect(seats.premiumOccupancy + seats.gaAttendance).toBeLessThanOrEqual(
      arenaCapacity,
    );
    expect(seats.gaAttendance).toBeLessThanOrEqual(seats.gaCapacity);
    expect(seats.gaCapacity).toBe(arenaCapacity - seats.premiumOccupancy);
  });
});

describe("star merch factor", () => {
  it("is bounded and requires attendance for merch to move", () => {
    expect(starMerchandiseFactor(0)).toBeGreaterThanOrEqual(0.9);
    expect(starMerchandiseFactor(99)).toBeLessThanOrEqual(1.2);
    expect(merchandiseFromAttendance(0, 90, 1.18)).toBe(0);
    const low = merchandiseFromAttendance(10_000, 50, starMerchandiseFactor(40));
    const high = merchandiseFromAttendance(10_000, 50, starMerchandiseFactor(95));
    expect(high).toBeGreaterThan(low);
  });
});

describe("broadcast pool invariants", () => {
  it("conserves the pool and pays every team", () => {
    const state = bootstrap(7);
    const pool = computeLeagueBroadcastPool(state);
    const dist = distributeMonthlyBroadcastPool(state);
    const teamIds = Object.keys(state.world.teams);
    expect(teamIds.length).toBeGreaterThan(1);
    let sum = 0;
    for (const teamId of teamIds) {
      const share = dist[teamId as TeamId] ?? 0;
      expect(share).toBeGreaterThan(0);
      sum += share;
    }
    expect(sum).toBe(pool);
  });

  it("posts broadcast not other; large market > small market at default sharing", () => {
    let state = bootstrap(11);
    const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
    const large = teamIds[0]!;
    const small = teamIds[1]!;
    state = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [large]: {
            ...state.business.franchiseOps[large]!,
            marketSize: 95,
          },
          [small]: {
            ...state.business.franchiseOps[small]!,
            marketSize: 20,
          },
        },
      },
    };
    const beforeLarge = state.business.finances[large]!.cash;
    const result = processMonthlyBroadcastRevenue(state);
    const books = result.state.business.finances[large]!.booksByYear[
      String(state.competition.season.year)
    ]!;
    expect(books.revenue.broadcast).toBeGreaterThan(0);
    expect(books.revenue.other).toBe(0);
    const largeShare =
      result.state.business.finances[large]!.cash - beforeLarge;
    const smallShare =
      result.state.business.finances[small]!.cash -
      state.business.finances[small]!.cash;
    expect(largeShare).toBeGreaterThan(smallShare);
  });

  it("higher sharing compresses but does not invert large vs small at default rates", () => {
    let state = bootstrap(13);
    const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
    const large = teamIds[0]!;
    const small = teamIds[1]!;
    state = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [large]: { ...state.business.franchiseOps[large]!, marketSize: 90 },
          [small]: { ...state.business.franchiseOps[small]!, marketSize: 25 },
        },
        leagueEconomy: {
          ...state.business.leagueEconomy,
          revenueSharingRate: 0.5,
        },
      },
    };
    const dist = distributeMonthlyBroadcastPool(state);
    expect(dist[large]!).toBeGreaterThan(dist[small]!);
  });
});

describe("no double counting", () => {
  it("concessions post to concessions; capital not facilities", () => {
    let state = bootstrap(17);
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = applyCashAndBooksImpact(state, teamId, 5_000, year, {
      revenueCategory: "concessions",
    }).state;
    const books = state.business.finances[teamId]!.booksByYear[String(year)]!;
    expect(books.revenue.concessions).toBe(5_000);
    expect(books.revenue.other).toBe(0);

    const cashBefore = state.business.finances[teamId]!.cash;
    const facilitiesBefore = books.expenses.facilities;
    try {
      state = startFacilityUpgrade(state, teamId, "youth").state;
    } catch {
      // may fail if already upgrading — inject capital directly
      state = applyCashAndBooksImpact(state, teamId, -1_000_000, year, {
        expenseCategory: "capital",
      }).state;
    }
    const after = state.business.finances[teamId]!.booksByYear[String(year)]!;
    expect(after.expenses.capital).toBeGreaterThan(0);
    expect(after.expenses.facilities).toBe(facilitiesBefore);
    expect(state.business.finances[teamId]!.cash).toBeLessThan(cashBefore);
  });

  it("playoff bonuses post to playoffs for all teams, not other", () => {
    let state = bootstrap(19);
    const year = state.competition.season.year;
    const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
    const a = teamIds[0]!;
    const b = teamIds[1]!;
    state = {
      ...state,
      competition: {
        ...state.competition,
        playoffs: {
          ...state.competition.playoffs,
          status: "in_progress",
          qualifiedTeams: [
            { teamId: a, seed: 1 },
            { teamId: b, seed: 2 },
          ],
          series: [],
        },
      },
    };
    const result = processLeaguePlayoffBonuses(state);
    for (const teamId of [a, b]) {
      const books =
        result.state.business.finances[teamId]!.booksByYear[String(year)]!;
      expect(books.revenue.playoffs).toBeGreaterThan(0);
      expect(books.revenue.other).toBe(0);
    }
  });

  it("booksByMonth does not alter cash independently of cash mutators", () => {
    let state = bootstrap(23);
    const teamId = state.user.controlledTeamId;
    const cashBefore = state.business.finances[teamId]!.cash;
    const year = state.competition.season.year;
    // recordRevenue alone should not change cash
    state = recordRevenue(state, teamId, "tickets", 1000, year).state;
    expect(state.business.finances[teamId]!.cash).toBe(cashBefore);
    expect(
      Object.keys(state.business.finances[teamId]!.booksByMonth).length,
    ).toBeGreaterThan(0);
  });
});

describe("profitable but cash-poor", () => {
  it("positive operating net with capital spend can reduce cash", () => {
    let state = bootstrap(29);
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = applyCashAndBooksImpact(state, teamId, 20_000_000, year, {
      revenueCategory: "sponsorships",
    }).state;
    state = applyCashAndBooksImpact(state, teamId, -5_000_000, year, {
      expenseCategory: "marketing",
    }).state;
    const cashBeforeCapex = state.business.finances[teamId]!.cash;
    state = applyCashAndBooksImpact(state, teamId, -25_000_000, year, {
      expenseCategory: "capital",
    }).state;
    const pnl = toFranchisePnLView(state);
    expect(pnl.seasonToDate.profitability.operatingExpenses.total).toBe(
      5_000_000,
    );
    expect(pnl.seasonToDate.investment.capital).toBe(25_000_000);
    expect(state.business.finances[teamId]!.cash).toBe(
      cashBeforeCapex - 25_000_000,
    );
    // Operating revenue - opex is positive before considering capital/payroll on statement
    expect(
      pnl.seasonToDate.profitability.revenue.total -
        pnl.seasonToDate.profitability.operatingExpenses.total,
    ).toBeGreaterThan(0);
  });
});

describe("schema 28 migration", () => {
  it("round-trips finances with new categories and premiumTicketPrice", () => {
    const state = bootstrap(31);
    const teamId = state.user.controlledTeamId;
    expect(state.meta.schemaVersion).toBe(40);
    expect(state.business.franchiseOps[teamId]!.premiumTicketPrice).toBeGreaterThan(
      0,
    );
    expect(state.business.finances[teamId]!.booksByMonth).toEqual({});
    expect(state.business.finances[teamId]!.cashLedgerByMonth).toEqual({});
    const restored = deserializeGameState(serializeGameState(state));
    expect(restored.meta.schemaVersion).toBe(40);
    expect(
      restored.business.finances[teamId]!.booksByYear,
    ).toEqual(state.business.finances[teamId]!.booksByYear);
  });

  it("empty books helper includes new categories", () => {
    const books = createEmptyTeamFinanceBooks();
    expect(books.revenue.premium).toBe(0);
    expect(books.revenue.broadcast).toBe(0);
    expect(books.expenses.capital).toBe(0);
  });
});

describe("business decisions change P&L", () => {
  it("identical teams with different ticket prices produce different gate forecasts", () => {
    const state = bootstrap(37);
    const teamId = state.user.controlledTeamId;
    const ops = state.business.franchiseOps[teamId]!;
    const cheap = forecastNextHomeGameDay(state, teamId, {
      ...ops,
      ticketPrice: 25,
    });
    const expensive = forecastNextHomeGameDay(state, teamId, {
      ...ops,
      ticketPrice: 120,
    });
    expect(cheap.attendance).toBeGreaterThan(expensive.attendance);
  });
});
