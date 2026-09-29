import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import {
  filterPlayerHistoryIndex,
  toPlayerHistoryIndex,
  toPlayerHistoryView,
} from "@/state/player-history-selectors";
import { createTestGameState } from "../factories/game-state";
import { addPlayerToState } from "../systems/awards/helpers";
import {
  awardResult,
  playerSeason,
  seasonRecord,
  teamIds,
  withAwards,
  withFranchiseHistory,
  withPlayerHistory,
} from "./history-fixtures";

function retire(state: GameState, playerId: string): GameState {
  const player = state.world.players[playerId]!;
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: {
          ...player,
          retired: true,
          teamId: null,
          contractId: null,
        },
      },
    },
  };
}

describe("player history selectors", () => {
  const base = createTestGameState({ saveId: "player_history" });
  const [champ, other, third] = teamIds(base);

  function withLeague(state: GameState): GameState {
    return withFranchiseHistory(state, {
      [champ!]: [
        seasonRecord({
          year: 2026,
          playoffResult: "champion",
          city: "Champ",
          name: "City",
        }),
        seasonRecord({ year: 2027, playoffResult: "first_round" }),
      ],
      [other!]: [
        seasonRecord({ year: 2026, playoffResult: "finals" }),
        seasonRecord({ year: 2027, playoffResult: "champion" }),
      ],
      [third!]: [
        seasonRecord({ year: 2026, playoffResult: "missed" }),
        seasonRecord({ year: 2027, playoffResult: "missed" }),
      ],
    });
  }

  it("separates seasons played from distinct teams and orders the team sequence", () => {
    let state = addPlayerToState(base, "journey", third!);
    state = withLeague(state);
    state = withPlayerHistory(state, {
      journey: [
        playerSeason({ year: 2027, teamId: third! }),
        playerSeason({ year: 2026, teamId: third! }),
        playerSeason({ year: 2028, teamId: other! }),
      ],
    });
    const view = toPlayerHistoryView(state, "journey");
    expect(view.hasHistory).toBe(true);
    expect(view.seasonsPlayed).toBe(3);
    expect(view.teamsPlayed).toBe(2);
    expect(view.teamSequence.map((s) => [s.seasonYear, s.teamId])).toEqual([
      [2026, third],
      [2027, third],
      [2028, other],
    ]);
  });

  it("credits championships by team-of-record at season end", () => {
    let state = withLeague(base);
    state = addPlayerToState(state, "tradedAway", champ!);
    state = addPlayerToState(state, "tradedIn", other!);
    state = addPlayerToState(state, "stayed", champ!);
    state = withPlayerHistory(state, {
      // Played for the 2026 champion, finished 2026 on a non-champion.
      tradedAway: [playerSeason({ year: 2026, teamId: third! })],
      // Traded onto the 2026 champion before season end.
      tradedIn: [playerSeason({ year: 2026, teamId: champ! })],
      stayed: [playerSeason({ year: 2026, teamId: champ! })],
    });
    expect(toPlayerHistoryView(state, "tradedAway").championships).toBe(0);
    expect(toPlayerHistoryView(state, "tradedIn").championships).toBe(1);
    const stayed = toPlayerHistoryView(state, "stayed");
    expect(stayed.championships).toBe(1);
    expect(stayed.championshipSeasons).toEqual([2026]);
    expect(stayed.teamSequence[0]!.teamName).toBe("Champ City");
  });

  it("associates award totals with the correct player", () => {
    let state = addPlayerToState(base, "star", champ!);
    state = addPlayerToState(state, "bench", champ!);
    state = withPlayerHistory(state, {
      star: [playerSeason({ year: 2026, teamId: champ! })],
      bench: [playerSeason({ year: 2026, teamId: champ! })],
    });
    state = withAwards(state, [
      awardResult({
        awardId: "mvp",
        seasonYear: 2026,
        winnerId: "star",
        teamId: champ,
      }),
      awardResult({
        awardId: "mvp",
        seasonYear: 2027,
        winnerId: "star",
        teamId: champ,
      }),
      awardResult({
        awardId: "sixth_man",
        seasonYear: 2026,
        winnerId: "bench",
        teamId: champ,
      }),
    ]);
    expect(toPlayerHistoryView(state, "star").awardTotals).toEqual([
      expect.objectContaining({ awardId: "mvp", count: 2 }),
    ]);
    expect(toPlayerHistoryView(state, "bench").awardTotals).toEqual([
      expect.objectContaining({ awardId: "sixth_man", count: 1 }),
    ]);
  });

  it("keeps active and retired players searchable by name", () => {
    let state = addPlayerToState(base, "active_one", champ!);
    state = addPlayerToState(state, "retired_one", other!);
    state = retire(state, "retired_one");
    state = withPlayerHistory(state, {
      active_one: [playerSeason({ year: 2026, teamId: champ! })],
      retired_one: [playerSeason({ year: 2026, teamId: other! })],
    });
    const index = toPlayerHistoryIndex(state);
    const retired = index.find((e) => e.playerId === "retired_one");
    expect(retired).toMatchObject({
      displayName: "retired_one Player",
      retired: true,
    });

    expect(
      filterPlayerHistoryIndex(index, "retired_one").map((e) => e.playerId),
    ).toEqual(["retired_one"]);
    expect(filterPlayerHistoryIndex(index, "PLAYER").length).toBe(index.length);
    expect(toPlayerHistoryView(state, "retired_one").retired).toBe(true);
    expect(toPlayerHistoryView(state, "active_one").retired).toBe(false);
  });

  it("falls back to the id when a history key has no world entity", () => {
    const state = withPlayerHistory(base, {
      ghost: [playerSeason({ year: 2026, teamId: null })],
    });
    const entry = toPlayerHistoryIndex(state).find(
      (e) => e.playerId === "ghost",
    );
    expect(entry?.displayName).toBe("ghost");
    expect(filterPlayerHistoryIndex([entry!], "gho")).toHaveLength(1);
    expect(toPlayerHistoryView(state, "ghost").teamsPlayed).toBe(0);
  });

  it("returns a valid empty view for a player with no history", () => {
    const view = toPlayerHistoryView(base, "nobody");
    expect(view).toMatchObject({
      hasHistory: false,
      seasonsPlayed: 0,
      teamsPlayed: 0,
      championships: 0,
      teamSequence: [],
      awardTotals: [],
    });
  });
});
