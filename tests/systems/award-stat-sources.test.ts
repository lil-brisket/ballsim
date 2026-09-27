import { describe, expect, it } from "vitest";
import { asPlayerId } from "@/domain/ids";
import {
  aggregateAllPlayersInGames,
  aggregatePlayerPeriodStats,
} from "@/systems/awards/award-stat-sources";
import { boxRow, makeFinalGame } from "./awards/helpers";

describe("aggregateAllPlayersInGames", () => {
  it("returns an empty list for no games", () => {
    expect(aggregateAllPlayersInGames([])).toEqual([]);
  });

  it("matches per-player aggregation for a single player", () => {
    const games = [
      makeFinalGame({
        id: "g1",
        date: "2026-11-01",
        homeTeamId: "t_home",
        awayTeamId: "t_away",
        homeScore: 100,
        awayScore: 90,
        playerStats: [
          boxRow("p_alpha", "t_home", { points: 20, rebounds: 5, minutes: 30 }),
        ],
      }),
      makeFinalGame({
        id: "g2",
        date: "2026-11-02",
        homeTeamId: "t_away",
        awayTeamId: "t_home",
        homeScore: 88,
        awayScore: 99,
        playerStats: [
          boxRow("p_alpha", "t_home", { points: 10, rebounds: 7, minutes: 28 }),
        ],
      }),
    ];
    const all = aggregateAllPlayersInGames(games);
    const one = aggregatePlayerPeriodStats(asPlayerId("p_alpha"), games);
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(one);
    expect(all[0]!.totals.points).toBe(30);
    expect(all[0]!.games).toBe(2);
  });

  it("sorts results by playerId regardless of insertion order", () => {
    const games = [
      makeFinalGame({
        id: "g1",
        date: "2026-11-01",
        homeTeamId: "t_home",
        awayTeamId: "t_away",
        homeScore: 100,
        awayScore: 90,
        playerStats: [
          boxRow("p_zulu", "t_away", { points: 8 }),
          boxRow("p_alpha", "t_home", { points: 12 }),
        ],
      }),
    ];
    const ids = aggregateAllPlayersInGames(games).map((row) => row.playerId);
    expect(ids).toEqual(["p_alpha", "p_zulu"]);
  });
});
