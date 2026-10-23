import { describe, expect, it } from "vitest";
import { asDraftPickId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  drawLottery,
  lotteryOddsTable,
  lotterySlotProbabilities,
  lotteryTeamsWorstFirst,
  runDraftLottery,
} from "@/systems/draft/draft-lottery";
import {
  draftYearForSeason,
  generateDraftOrder,
} from "@/systems/draft/draft-order";
import { expectedFirstRoundSlot } from "@/systems/trades/asset-valuation/pick-projection";
import { createDraftFixture } from "./fixture";

function withLottery(state: GameState, enabled = true): GameState {
  return {
    ...state,
    settings: {
      ...state.settings,
      draftLottery: { enabled, oddsPreset: "flattened", picksDrawn: 4 },
    },
  };
}

describe("lottery odds", () => {
  it("sum to 1 for every lottery size and preset", () => {
    for (const preset of ["flattened", "weighted"] as const) {
      for (let count = 2; count <= 16; count += 1) {
        const total = lotteryOddsTable(count, preset).reduce(
          (sum, p) => sum + p,
          0,
        );
        expect(total).toBeCloseTo(1, 10);
      }
    }
  });

  it("give the three worst teams equal, best odds under the flattened preset", () => {
    const odds = lotteryOddsTable(14, "flattened");
    expect(odds[0]).toBe(odds[1]);
    expect(odds[1]).toBe(odds[2]);
    expect(odds[2]!).toBeGreaterThan(odds[3]!);
  });

  it("slot probabilities are a distribution for each team and slot", () => {
    const matrix = lotterySlotProbabilities(8, "flattened", 4);
    for (const row of matrix) {
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    }
    for (let slot = 0; slot < 8; slot += 1) {
      expect(matrix.reduce((a, row) => a + row[slot]!, 0)).toBeCloseTo(1, 10);
    }
    // The first draw follows the odds table.
    const odds = lotteryOddsTable(8, "flattened");
    matrix.forEach((row, team) => expect(row[0]).toBeCloseTo(odds[team]!, 10));
  });
});

describe("drawLottery", () => {
  it("is the same draw for the same seed", () => {
    const teams = ["a", "b", "c", "d", "e", "f"];
    const odds = lotteryOddsTable(teams.length, "flattened");
    const first = drawLottery(teams, odds, 4, createSeededRng(99));
    expect(drawLottery(teams, odds, 4, createSeededRng(99))).toEqual(first);
    expect([...first].sort()).toEqual([...teams].sort());
  });

  it("matches the odds table over 10,000 seeded draws", () => {
    const teams = Array.from({ length: 8 }, (_, i) => i);
    const odds = lotteryOddsTable(teams.length, "flattened");
    const firsts = new Array<number>(teams.length).fill(0);
    const rng = createSeededRng(2024);
    const draws = 10_000;
    for (let i = 0; i < draws; i += 1) {
      firsts[drawLottery(teams, odds, 4, rng)[0]!]! += 1;
    }
    firsts.forEach((count, team) => {
      // ~3.5 standard errors at p≈0.2, n=10,000.
      expect(Math.abs(count / draws - odds[team]!)).toBeLessThan(0.015);
    });
  });

  it("keeps teams past the drawn picks in record order", () => {
    const teams = ["a", "b", "c", "d", "e", "f"];
    const odds = lotteryOddsTable(teams.length, "flattened");
    const order = drawLottery(teams, odds, 2, createSeededRng(5));
    const rest = order.slice(2);
    expect(rest).toEqual(teams.filter((t) => rest.includes(t)));
  });
});

describe("runDraftLottery and the draft order", () => {
  it("is off unless the setting is on", () => {
    const state = withLottery(createDraftFixture(), false);
    const year = draftYearForSeason(state.competition.season.year);
    expect(runDraftLottery(state, year)).toBeNull();
  });

  it("orders the first round by the draw and sends traded picks to their owner", () => {
    let state = withLottery(createDraftFixture());
    const year = draftYearForSeason(state.competition.season.year);
    const lottery = runDraftLottery(state, year)!;
    expect(lottery.finalOrder).toHaveLength(
      lotteryTeamsWorstFirst(state).length,
    );
    expect(runDraftLottery(state, year)).toEqual(lottery);

    // Trade the lottery winner's first-rounder to another team.
    const winner = lottery.finalOrder[0]!;
    const pick = Object.values(state.world.draftPicks).find(
      (p) =>
        p.seasonYear === year && p.round === 1 && p.originalTeamId === winner,
    )!;
    const buyer = (Object.keys(state.world.teams) as TeamId[]).find(
      (id) => id !== winner,
    )!;
    state = {
      ...state,
      world: {
        ...state.world,
        draftPicks: {
          ...state.world.draftPicks,
          [pick.id]: { ...pick, ownerTeamId: buyer },
        },
      },
    };
    const order = generateDraftOrder(state, year, lottery.finalOrder);
    expect(order[0]!.draftPickId).toBe(asDraftPickId(pick.id));
    expect(order[0]!.ownerTeamId).toBe(buyer);
    const round1Teams = order
      .filter((s) => s.round === 1)
      .slice(0, lottery.finalOrder.length)
      .map((s) => state.world.draftPicks[s.draftPickId]!.originalTeamId);
    expect(round1Teams).toEqual(lottery.finalOrder);
  });
});

describe("pick projection", () => {
  it("projects lottery picks at their expected slot, not their record", () => {
    const state = withLottery(createDraftFixture());
    const lotteryTeams =
      Object.keys(state.world.teams).length -
      state.settings.playoffs.playoffTeams;
    // The worst record no longer projects to pick 1...
    expect(expectedFirstRoundSlot(state, 1)).toBeGreaterThan(1);
    // ...and playoff teams still pick by record.
    expect(expectedFirstRoundSlot(state, lotteryTeams + 1)).toBe(
      lotteryTeams + 1,
    );
    expect(expectedFirstRoundSlot(withLottery(state, false), 1)).toBe(1);
  });
});
