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
