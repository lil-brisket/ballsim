import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { toFranchiseBusinessView } from "@/state/franchise-selectors";
import { arenaCapacity } from "@/systems/facilities";
import { ARENA_CAPACITY_BY_LEVEL } from "@/systems/facilities-config";
import { processWeeklyMarketing, setMarketingBudget } from "@/systems/marketing";
import { setTicketPrice } from "@/systems/ticket-pricing";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { getTeamPayroll } from "@/systems/salary-cap";
import {
  assertCashFlowInvariants,
  bootstrapEconomyScenario,
  runEconomyScenario,
} from "@/systems/economy/scenario-harness";

function withOps(
  state: GameState,
  teamId: TeamId,
  patch: Partial<GameState["business"]["franchiseOps"][string]>,
): GameState {
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

describe("economic scenarios (Phase 1A)", () => {
  it("A — strong franchise forecasts higher attendance than B — weak franchise", () => {
    let strong = createInitialGameState({
      saveId: "econ_a",
      rngSeed: 21,
      settings: CBL_GAME_SETTINGS,
    });
    strong = bootstrapWorld(strong, createSeededRng(strong.meta.rngState)).state;
    const teamId = strong.user.controlledTeamId;

    strong = withOps(strong, teamId, {
      fanSentiment: 80,
      marketSize: 85,
      mediaAttention: 70,
      marketing: { budget: 2_000_000, awareness: 70 },
      ticketPrice: 45,
    });
    strong = {
      ...strong,
      world: {
        ...strong.world,
        teams: {
          ...strong.world.teams,
          [teamId]: { ...strong.world.teams[teamId]!, reputation: 75 },
        },
      },
      competition: {
        ...strong.competition,
        standings: {
          ...strong.competition.standings,
          byTeamId: {
            ...strong.competition.standings.byTeamId,
            [teamId]: {
              ...strong.competition.standings.byTeamId[teamId]!,
              wins: 40,
              losses: 10,
            },
          },
        },
      },
    };

    let weak = createInitialGameState({
      saveId: "econ_b",
      rngSeed: 22,
      settings: CBL_GAME_SETTINGS,
    });
    weak = bootstrapWorld(weak, createSeededRng(weak.meta.rngState)).state;
    weak = withOps(weak, teamId, {
      fanSentiment: 25,
      marketSize: 35,
      mediaAttention: 20,
      marketing: { budget: 500_000, awareness: 20 },
      ticketPrice: 120,
    });
    weak = {
      ...weak,
      world: {
        ...weak.world,
        teams: {
          ...weak.world.teams,
          [teamId]: { ...weak.world.teams[teamId]!, reputation: 30 },
        },
      },
      competition: {
        ...weak.competition,
        standings: {
          ...weak.competition.standings,
          byTeamId: {
            ...weak.competition.standings.byTeamId,
            [teamId]: {
              ...weak.competition.standings.byTeamId[teamId]!,
              wins: 8,
              losses: 42,
            },
          },
        },
      },
    };

    const strongView = toFranchiseBusinessView(strong);
    const weakView = toFranchiseBusinessView(weak);
    expect(strongView.forecast.attendance).toBeGreaterThan(
      weakView.forecast.attendance,
    );
    expect(strongView.forecast.totalGameDayRevenue).toBeGreaterThan(
      weakView.forecast.totalGameDayRevenue,
    );
    expect(strongView.forecast.attendance).toBeLessThanOrEqual(
      strongView.forecast.capacity,
    );
    expect(weakView.forecast.attendance).toBeGreaterThanOrEqual(0);
  });

  it("C — aggressive marketing raises awareness with diminishing returns", () => {
    const runBudget = (budget: number): number => {
      let state = createInitialGameState({
        saveId: `econ_c_${budget}`,
        rngSeed: 30,
        settings: CBL_GAME_SETTINGS,
      });
      state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
      const teamId = state.user.controlledTeamId;
      state = setMarketingBudget(state, teamId, budget).state;
      state = withOps(state, teamId, {
        marketing: { budget, awareness: 40 },
      });
      for (let i = 0; i < 10; i += 1) {
        state = processWeeklyMarketing(state).state;
      }
      return state.business.franchiseOps[teamId]!.marketing.awareness;
    };

    const zero = runBudget(0);
    const moderate = runBudget(2_000_000);
    const high = runBudget(20_000_000);
    expect(moderate).toBeGreaterThan(zero);
    expect(high).toBeGreaterThanOrEqual(moderate);
    // Diminishing: 10x spend should not yield 10x awareness gain.
    const gainModerate = moderate - zero;
    const gainHigh = high - zero;
    expect(gainHigh).toBeLessThan(gainModerate * 8);
  });

  it("D — higher arena level raises capacity ceiling", () => {
    let state = createInitialGameState({
      saveId: "econ_d",
      rngSeed: 40,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.controlledTeamId;

    const level1 = arenaCapacity(state, teamId);
    expect(level1).toBe(ARENA_CAPACITY_BY_LEVEL[0]);

    const ops = state.business.franchiseOps[teamId]!;
    state = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...ops,
            facilities: {
              ...ops.facilities,
              arena: { level: 3, upgradeWeeksRemaining: 0 },
            },
          },
        },
      },
    };
    const level3 = arenaCapacity(state, teamId);
    expect(level3).toBe(ARENA_CAPACITY_BY_LEVEL[2]);
    expect(level3).toBeGreaterThan(level1);

    state = setTicketPrice(state, teamId, 45).state;
    const view = toFranchiseBusinessView(state);
    expect(view.forecast.capacity).toBe(level3);
    expect(view.forecast.attendance).toBeLessThanOrEqual(level3);
  });
});

describe("economic scenarios (Phase 2 harness)", () => {
  it(
    "is deterministic for the same seed",
    { timeout: 180_000 },
    () => {
      const a = runEconomyScenario("baseline", 1, { seed: 77 });
      const b = runEconomyScenario("baseline", 1, { seed: 77 });
      expect(a.seasons[0]!.cash).toBe(b.seasons[0]!.cash);
      expect(a.seasons[0]!.wins).toBe(b.seasons[0]!.wins);
      expect(a.seasons[0]!.revenue.shares.broadcast).toBeDefined();
      expect(a.actions[0]!.payroll).toBeGreaterThan(0);
      expect(a.seed).toBe(77);
    },
  );

  it(
    "baseline cash-flow invariants hold and unclassified is zero",
    { timeout: 180_000 },
    () => {
      const result = runEconomyScenario("baseline", 1, { seed: 77 });
      const season = result.seasons[0]!;
      assertCashFlowInvariants(season);
      expect(season.cashFlow.revenue.unclassified).toBe(0);
      expect(season.cashFlow.costs.unclassified).toBe(0);
      expect(season.cashFlow.minCash).toBeGreaterThanOrEqual(0);
      expect(season.cashFlow.revenue.gate).toBe(season.revenue.gate);
      expect(season.cashFlow.revenue.merchandise).toBe(season.revenue.merchandise);
      expect(season.revenue.gate).toBe(season.statementTickets);
      expect(season.revenue.merchandise).toBe(season.statementMerchandise);
      expect(season.fillRateMean).not.toBeNull();
      expect(season.capacityMean).not.toBeNull();
    },
  );

  it(
    "distress ends with less cash and higher payroll than conservative",
    { timeout: 180_000 },
    () => {
      const conservative = runEconomyScenario("conservative", 1, { seed: 77 });
      const distress = runEconomyScenario("distress", 1, { seed: 77 });
      expect(distress.seasons[0]!.payroll).toBeGreaterThan(
        conservative.seasons[0]!.payroll,
      );
      expect(distress.seasons[0]!.cash).toBeLessThan(
        conservative.seasons[0]!.cash,
      );
    },
  );

  it(
    "win-now payroll exceeds baseline",
    { timeout: 180_000 },
    () => {
      const baseline = runEconomyScenario("baseline", 1, { seed: 77 });
      const winNow = runEconomyScenario("win_now", 1, { seed: 77 });
      expect(winNow.seasons[0]!.payroll).toBeGreaterThan(
        baseline.seasons[0]!.payroll,
      );
    },
  );

  it(
    "recovery spends less on marketing than frozen distress and is not fully healed",
    { timeout: 180_000 },
    () => {
      const distress = runEconomyScenario("distress", 1, { seed: 77 });
      const recovery = runEconomyScenario("recovery", 1, { seed: 77 });
      expect(recovery.seasons[0]!.marketingBudget).toBeLessThan(
        distress.seasons[0]!.marketingBudget,
      );
      expect(recovery.seasons[0]!.cash).toBeGreaterThan(
        distress.seasons[0]!.cash,
      );
      expect(recovery.seasons[0]!.health).not.toBe("healthy");
    },
  );

  it(
    "aggressive spends more and ends with less cash than baseline without requiring insolvency",
    { timeout: 180_000 },
    () => {
      const baseline = runEconomyScenario("baseline", 1, { seed: 77 });
      const aggressive = runEconomyScenario("aggressive", 1, { seed: 77 });
      const season = aggressive.seasons[0]!;
      const action = aggressive.actions[0]!;
      expect(season.payroll).toBeGreaterThan(baseline.seasons[0]!.payroll);
      expect(season.marketingBudget).toBeGreaterThan(
        baseline.seasons[0]!.marketingBudget,
      );
      expect(season.cash).toBeLessThan(baseline.seasons[0]!.cash);
      expect(action.capitalAttempts.length).toBeGreaterThan(0);
      expect(
        action.capitalAttempts.some(
          (attempt) =>
            attempt.kind === "facility_upgrade" ||
            attempt.kind === "marketing_increase",
        ),
      ).toBe(true);
      if (season.cashFlow.minCash < 0) {
        expect(action.capitalRestricted).toBe(true);
      }
      assertCashFlowInvariants(season);
    },
  );

  it("high_market and low_market only change marketSize", () => {
    const baseline = bootstrapEconomyScenario("baseline", { seed: 77 });
    const high = bootstrapEconomyScenario("high_market", { seed: 77 });
    const low = bootstrapEconomyScenario("low_market", { seed: 77 });
    const baseTeamId = baseline.state.user.controlledTeamId;
    const highTeamId = high.state.user.controlledTeamId;
    const lowTeamId = low.state.user.controlledTeamId;
    const year = baseline.state.competition.season.year;

    const baseOps = baseline.state.business.franchiseOps[baseTeamId]!;
    const highOps = high.state.business.franchiseOps[highTeamId]!;
    const lowOps = low.state.business.franchiseOps[lowTeamId]!;

    expect(highOps.marketSize).toBe(80);
    expect(lowOps.marketSize).toBe(25);
    expect(baseOps.marketSize).not.toBe(80);
    expect(baseOps.marketSize).not.toBe(25);

    expect(highOps.ticketPrice).toBe(baseOps.ticketPrice);
    expect(lowOps.ticketPrice).toBe(baseOps.ticketPrice);
    expect(highOps.marketing.budget).toBe(baseOps.marketing.budget);
    expect(lowOps.marketing.budget).toBe(baseOps.marketing.budget);
    expect(facilityLevelsOf(highOps)).toEqual(facilityLevelsOf(baseOps));
    expect(facilityLevelsOf(lowOps)).toEqual(facilityLevelsOf(baseOps));
    expect(getTeamPayroll(highTeamId as TeamId, year, high.state)).toBe(
      getTeamPayroll(baseTeamId as TeamId, year, baseline.state),
    );
    expect(getTeamPayroll(lowTeamId as TeamId, year, low.state)).toBe(
      getTeamPayroll(baseTeamId as TeamId, year, baseline.state),
    );
    expect(high.state.world.teams[highTeamId]!.roster.length).toBe(
      baseline.state.world.teams[baseTeamId]!.roster.length,
    );
    expect(low.state.world.teams[lowTeamId]!.roster.length).toBe(
      baseline.state.world.teams[baseTeamId]!.roster.length,
    );
  });
});

function facilityLevelsOf(
  ops: GameState["business"]["franchiseOps"][string],
): Record<string, number> {
  return {
    arena: ops.facilities.arena.level,
    practice: ops.facilities.practice.level,
    training: ops.facilities.training.level,
    medical: ops.facilities.medical.level,
    youth: ops.facilities.youth.level,
    fan: ops.facilities.fan.level,
  };
}
