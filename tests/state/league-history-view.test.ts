import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import { toLeagueHistoryView } from "@/state/league-history-selectors";
import { createTestGameState } from "../factories/game-state";
import { seasonRecord, teamIds, withFranchiseHistory } from "./history-fixtures";

function setup(): { state: GameState; ids: string[] } {
  const state = createTestGameState({ saveId: "league_history" });
  return { state, ids: teamIds(state) };
}

describe("toLeagueHistoryView", () => {
  it("reports champion and unique championship-series loser", () => {
    const { state, ids } = setup();
    const [a, b, c] = ids;
    const view = toLeagueHistoryView(
      withFranchiseHistory(state, {
        [a!]: [seasonRecord({ year: 2026, playoffResult: "champion", wins: 60, losses: 22, city: "Alpha", name: "Aces" })],
        [b!]: [seasonRecord({ year: 2026, playoffResult: "finals", city: "Beta", name: "Bees" })],
        [c!]: [seasonRecord({ year: 2026, playoffResult: "conference_finals" })],
      }),
    );
    expect(view.seasons).toEqual([
      {
        seasonYear: 2026,
        championTeamId: a,
        championName: "Alpha Aces",
        championRecord: "60-22",
        runnerUpTeamId: b,
        runnerUpName: "Beta Bees",
      },
    ]);
    expect(view.hasRunnerUpData).toBe(true);
  });

  it("omits runner-up when no team carries the finals label (6/12-team collapse)", () => {
    const { state, ids } = setup();
    const view = toLeagueHistoryView(
      withFranchiseHistory(state, {
        [ids[0]!]: [seasonRecord({ year: 2026, playoffResult: "champion" })],
        [ids[1]!]: [seasonRecord({ year: 2026, playoffResult: "second_round" })],
        [ids[2]!]: [seasonRecord({ year: 2026, playoffResult: "second_round" })],
      }),
    );
    expect(view.seasons[0]!.runnerUpTeamId).toBeUndefined();
    expect(view.hasRunnerUpData).toBe(false);
  });

  it("omits runner-up when the finals label is ambiguous", () => {
    const { state, ids } = setup();
    const view = toLeagueHistoryView(
      withFranchiseHistory(state, {
        [ids[0]!]: [seasonRecord({ year: 2026, playoffResult: "champion" })],
        [ids[1]!]: [seasonRecord({ year: 2026, playoffResult: "finals" })],
        [ids[2]!]: [seasonRecord({ year: 2026, playoffResult: "finals" })],
      }),
    );
    expect(view.seasons[0]!.runnerUpTeamId).toBeUndefined();
  });

  it("does not produce a champion for an in-progress season", () => {
    const { state, ids } = setup();
    const live: GameState = {
      ...withFranchiseHistory(state, {
        [ids[0]!]: [seasonRecord({ year: 2025, playoffResult: "champion" })],
      }),
      competition: {
        ...state.competition,
        playoffs: {
          ...state.competition.playoffs,
          championTeamId: ids[1]! as never,
        },
      },
    };
    const view = toLeagueHistoryView(live);
    expect(view.seasons.map((s) => s.seasonYear)).toEqual([2025]);
    expect(view.seasons[0]!.championTeamId).toBe(ids[0]);
  });

  it("skips seasons without exactly one champion and orders seasons descending", () => {
    const { state, ids } = setup();
    const view = toLeagueHistoryView(
      withFranchiseHistory(state, {
        [ids[0]!]: [
          seasonRecord({ year: 2026, playoffResult: "champion" }),
          seasonRecord({ year: 2027, playoffResult: "first_round" }),
          seasonRecord({ year: 2028, playoffResult: "finals" }),
        ],
        [ids[1]!]: [
          seasonRecord({ year: 2026, playoffResult: "finals" }),
          seasonRecord({ year: 2027, playoffResult: "missed" }),
          seasonRecord({ year: 2028, playoffResult: "champion" }),
        ],
      }),
    );
    expect(view.seasons.map((s) => s.seasonYear)).toEqual([2028, 2026]);
    expect(view.seasons[0]!.championTeamId).toBe(ids[1]);
    expect(view.seasons[1]!.championTeamId).toBe(ids[0]);
  });

  it("returns an empty view with no completed seasons", () => {
    const { state, ids } = setup();
    const view = toLeagueHistoryView(withFranchiseHistory(state, { [ids[0]!]: [] }));
    expect(view.seasons).toEqual([]);
    expect(view.hasRunnerUpData).toBe(false);
  });
});
