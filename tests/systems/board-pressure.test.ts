import { describe, expect, it } from "vitest";
import type {
  BoardPressureStage,
  OwnershipMood,
} from "@/domain/entities/ownership-confidence";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  getActiveOwnedFranchise,
  withOwnedFranchise,
} from "@/state/owner-context";
import {
  BOARD_SETTLEMENT_COST,
  hasPendingBoardDirective,
  resolveBoardDirective,
  reviewBoardPressure,
} from "@/systems/board-pressure";
import { startFacilityUpgrade } from "@/systems/facilities";
import { setMarketingBudget } from "@/systems/marketing";
import { bootstrapWorld } from "@/systems/world-pipeline";

function league(): GameState {
  const state = createInitialGameState({
    saveId: "board_pressure",
    rngSeed: 21,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

function withBoard(
  state: GameState,
  mood: OwnershipMood,
  stage: BoardPressureStage,
): GameState {
  return withOwnedFranchise(state, state.user.activeOwnerTeamId, (owned) => ({
    ...owned,
    ownershipConfidence: {
      ...owned.ownershipConfidence,
      mood,
      boardPressure: { stage },
    },
  }));
}

function stageOf(state: GameState): BoardPressureStage {
  return getActiveOwnedFranchise(state).ownershipConfidence.boardPressure.stage;
}

function fundsOf(state: GameState): number {
  return state.business.finances[state.user.activeOwnerTeamId]!.businessFunds;
}

describe("board pressure", () => {
  it("escalates one stage per season that ends with ownership unhappy", () => {
    let state = withBoard(league(), "concerned", "none");
    const stages: BoardPressureStage[] = [];
    for (let season = 0; season < 4; season += 1) {
      state = reviewBoardPressure(state);
      stages.push(stageOf(state));
    }
    expect(stages).toEqual(["warning", "restricted", "ultimatum", "ultimatum"]);
    const titles = getActiveOwnedFranchise(state)
      .notifications.filter((item) => item.type === "ownership_pressure")
      .map((item) => item.title);
    expect(titles).toEqual([
      "Board Warning",
      "Spending Frozen",
      "The Board Wants Changes",
    ]);
  });

  it("holds on a watchful season and steps down on a good one", () => {
    const restricted = withBoard(league(), "watchful", "restricted");
    expect(stageOf(reviewBoardPressure(restricted))).toBe("restricted");
    const recovered = withBoard(league(), "supportive", "restricted");
    expect(stageOf(reviewBoardPressure(recovered))).toBe("warning");
    const calm = withBoard(league(), "confident", "none");
    expect(reviewBoardPressure(calm)).toBe(calm);
  });

  it("freezes discretionary spending while restricted, but allows cuts", () => {
    const state = withBoard(league(), "concerned", "restricted");
    const teamId = state.user.activeOwnerTeamId;
    expect(() => startFacilityUpgrade(state, teamId, "youth")).toThrow(
      /board has restricted/,
    );
    const budget = state.business.franchiseOps[teamId]!.marketing.budget;
    expect(() => setMarketingBudget(state, teamId, budget + 100_000)).toThrow(
      /board has restricted/,
    );
    expect(() => setMarketingBudget(state, teamId, 0)).not.toThrow();
    const warned = withBoard(league(), "concerned", "warning");
    expect(() =>
      startFacilityUpgrade(warned, warned.user.activeOwnerTeamId, "youth"),
    ).not.toThrow();
  });

  it("blocks on the ultimatum until the owner answers", () => {
    const state = withBoard(league(), "displeased", "ultimatum");
    expect(hasPendingBoardDirective(state)).toBe(true);
    expect(
      hasPendingBoardDirective(withBoard(state, "displeased", "restricted")),
    ).toBe(false);
    expect(() =>
      resolveBoardDirective(
        withBoard(state, "displeased", "warning"),
        "settle",
      ),
    ).toThrow(/no pending demands/);
  });

  it("keeps the freeze when the owner accepts the board's plan", () => {
    const state = withBoard(league(), "displeased", "ultimatum");
    const resolved = resolveBoardDirective(state, "accept_plan").state;
    const confidence = getActiveOwnedFranchise(resolved).ownershipConfidence;
    expect(confidence.boardPressure.stage).toBe("restricted");
    expect(confidence.mood).toBe("concerned");
    expect(confidence.concernLevel).toBe(60);
    expect(fundsOf(resolved)).toBe(fundsOf(state));
  });

  it("lifts the freeze when the owner settles with the board", () => {
    const state = withBoard(league(), "displeased", "ultimatum");
    const resolved = resolveBoardDirective(state, "settle").state;
    const confidence = getActiveOwnedFranchise(resolved).ownershipConfidence;
    expect(confidence.boardPressure.stage).toBe("warning");
    expect(confidence.mood).toBe("watchful");
    expect(fundsOf(resolved)).toBe(fundsOf(state) - BOARD_SETTLEMENT_COST);
  });

  it("refuses a settlement the franchise cannot afford", () => {
    const base = withBoard(league(), "displeased", "ultimatum");
    const teamId = base.user.activeOwnerTeamId;
    const broke: GameState = {
      ...base,
      business: {
        ...base.business,
        finances: {
          ...base.business.finances,
          [teamId]: { ...base.business.finances[teamId]!, businessFunds: 0 },
        },
      },
    };
    expect(() => resolveBoardDirective(broke, "settle")).toThrow(
      /business funds/i,
    );
  });
});
