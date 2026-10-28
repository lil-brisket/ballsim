import { describe, expect, it } from "vitest";
import type { Game } from "@/domain/entities/game";
import type { PlayoffSeries } from "@/domain/entities/playoffs";
import { asGameId, asTeamId } from "@/domain/ids";
import { toChampionMomentView } from "@/state/champion-moment-selectors";
import { toDashboardMomentsView } from "@/state/dashboard-moments";
import type { GameState } from "@/state/game-state";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";
import { createTestGame } from "../factories/game";
import {
  conferenceBracketState,
  leagueWideState,
} from "./playoff-bracket-fixtures";

function allSeries(state: GameState) {
  return toPlayoffHubView(state).rounds.flatMap((round) => round.series);
}

function finalGame(id: string, home: string, away: string): Game {
  return {
    ...createTestGame({
      id: asGameId(id),
      homeTeamId: asTeamId(home),
      awayTeamId: asTeamId(away),
    }),
    status: "final",
    date: "2027-04-20",
    score: { home: 101, away: 95 },
  };
}

function withSeries(
  state: GameState,
  patch: (series: PlayoffSeries) => PlayoffSeries,
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      playoffs: {
        ...state.competition.playoffs,
        series: state.competition.playoffs.series.map(patch),
      },
    },
  };
}

describe("PlayoffSeriesView bracket fields", () => {
  it("exposes feeders, abbreviations and branding", () => {
    const state = leagueWideState(1, 16, 8, "series-view-feeders");
    const series = allSeries(state);
    const opener = series.find((s) => s.id === "playoff_r0_s0")!;
    expect(opener.feederSeriesIds).toEqual([]);
    expect(opener.bye).toBeNull();
    expect(opener.higherSeedAbbreviation).toBe("T1");
    expect(opener.lowerSeedAbbreviation).toBe("T8");
    expect(opener.higherSeedBranding).not.toBeNull();
    const semi = series.find((s) => s.id === "playoff_r1_s0")!;
    expect(semi.feederSeriesIds).toEqual(["playoff_r0_s0", "playoff_r0_s1"]);
    expect(semi.higherSeedAbbreviation).toBeNull();
    expect(semi.higherSeedBranding).toBeNull();
    expect(semi.games).toEqual([]);
  });

  it("describes a bye series with one feeder", () => {
    const state = leagueWideState(1, 12, 6, "series-view-bye");
    const semi = allSeries(state).find((s) => s.id === "playoff_r1_s0")!;
    expect(semi.feederSeriesIds).toEqual(["playoff_r0_s1"]);
    expect(semi.bye).toMatchObject({
      seed: 1,
      teamId: "conf_east_1",
      abbreviation: "T1",
    });
    expect(semi.bye?.teamName).toBe("conf_east T1");
    expect(semi.bye?.branding).not.toBeNull();
  });

  it("looks games up in competition.games, then the archive, and keeps missing ones", () => {
    const base = leagueWideState(1, 16, 8, "series-view-games");
    const live = finalGame("game_live", "conf_east_1", "conf_east_8");
    const archived = finalGame("game_archived", "conf_east_8", "conf_east_1");
    const state: GameState = {
      ...withSeries(base, (s) =>
        s.id === "playoff_r0_s0"
          ? {
              ...s,
              gameIds: [
                asGameId("game_live"),
                asGameId("game_archived"),
                asGameId("game_gone"),
              ],
            }
          : s,
      ),
      business: {
        ...base.business,
        gameArchive: { game_archived: archived },
      },
    };
    const stateWithLive: GameState = {
      ...state,
      competition: {
        ...state.competition,
        games: { ...state.competition.games, game_live: live },
      },
    };
    const opener = allSeries(stateWithLive).find(
      (s) => s.id === "playoff_r0_s0",
    )!;
    expect(opener.games.map((g) => g.gameId)).toEqual([
      "game_live",
      "game_archived",
      "game_gone",
    ]);
    expect(opener.games.map((g) => g.number)).toEqual([1, 2, 3]);
    expect(opener.games[0]).toEqual({
      gameId: "game_live",
      number: 1,
      date: "2027-04-20",
      homeAbbreviation: "T1",
      awayAbbreviation: "T8",
      homeScore: 101,
      awayScore: 95,
      final: true,
    });
    expect(opener.games[1]).toMatchObject({
      homeAbbreviation: "T8",
      awayAbbreviation: "T1",
      homeScore: 101,
      final: true,
    });
    expect(opener.games[2]).toEqual({
      gameId: "game_gone",
      number: 3,
      date: "",
      homeAbbreviation: "",
      awayAbbreviation: "",
      homeScore: null,
      awayScore: null,
      final: false,
    });
  });

  it("hides scores of games that are not final", () => {
    const base = leagueWideState(1, 16, 8, "series-view-scheduled");
    const scheduled = createTestGame({
      id: asGameId("game_sched"),
      homeTeamId: asTeamId("conf_east_1"),
      awayTeamId: asTeamId("conf_east_8"),
    });
    const patched = withSeries(base, (s) =>
      s.id === "playoff_r0_s0"
        ? { ...s, gameIds: [asGameId("game_sched")] }
        : s,
    );
    const state: GameState = {
      ...patched,
      competition: {
        ...patched.competition,
        games: { game_sched: scheduled },
      },
    };
    const game = allSeries(state).find((s) => s.id === "playoff_r0_s0")!
      .games[0]!;
    expect(game).toMatchObject({
      homeScore: null,
      awayScore: null,
      final: false,
      homeAbbreviation: "T1",
    });
  });

  it("flags series that involve the active owner, including a bye", () => {
    const state = leagueWideState(1, 12, 6, "series-view-user");
    const mine = allSeries(state)
      .filter((s) => s.involvesUser)
      .map((s) => s.id)
      .sort();
    // Owner is conf_east_1, the #1 seed: bye in semi 0, then the final path.
    expect(mine).toEqual(["playoff_r1_s0"]);
    const league = leagueWideState(1, 16, 8, "series-view-user-8");
    expect(
      allSeries(league)
        .filter((s) => s.involvesUser)
        .map((s) => s.id),
    ).toEqual(["playoff_r0_s0"]);
  });
});

describe("ChampionMomentView", () => {
  function decided(
    phase: GameState["competition"]["season"]["phase"],
    status: "complete" | "in_progress" = "complete",
    champion = "conf_east_1",
  ): GameState {
    const base = conferenceBracketState(2, 10, 2, `champion-${phase}`);
    const lastRound = Math.max(
      ...base.competition.playoffs.series.map((s) => s.round),
    );
    const final = base.competition.playoffs.series.find(
      (s) => s.round === lastRound,
    )!;
    const other = champion === "conf_east_1" ? "conf_west_1" : "conf_east_1";
    const east = asTeamId("conf_east_1");
    const west = asTeamId("conf_west_1");
    const withFinal = withSeries(base, (s) =>
      s.id === final.id
        ? {
            ...s,
            higherSeedTeamId: east,
            lowerSeedTeamId: west,
            wins: { [champion]: 4, [other]: 2 },
            status: "complete",
            winnerTeamId: asTeamId(champion),
          }
        : s,
    );
    return {
      ...withFinal,
      competition: {
        ...withFinal.competition,
        season: { ...withFinal.competition.season, phase },
        playoffs: {
          ...withFinal.competition.playoffs,
          status,
          championTeamId: asTeamId(champion),
        },
      },
    };
  }

  it("is null until there is a champion", () => {
    const state = conferenceBracketState(2, 10, 2, "champion-none");
    expect(toChampionMomentView(state)).toBeNull();
    expect(toDashboardMomentsView(state).champion).toBeNull();
  });

  it("puts the champion first in the Finals score", () => {
    const view = toChampionMomentView(
      decided("postseason", "complete", "conf_west_1"),
    )!;
    expect(view.championTeamId).toBe("conf_west_1");
    expect(view.finalsWins).toBe("4–2");
    expect(view.finalsOpponentName).toBe("conf_east T1");
    expect(view.championName).toBe("conf_west T1");
    expect(view.abbreviation).toBe("T1");
    expect(view.branding).not.toBeNull();
    expect(view.userTeamIsChampion).toBe(false);
    const own = toChampionMomentView(decided("postseason"))!;
    expect(own.userTeamIsChampion).toBe(true);
    expect(own.finalsWins).toBe("4–2");
  });

  it.each([
    ["preseason", false],
    ["regular", false],
    ["playoffs", false],
    ["postseason", true],
    ["offseason", true],
  ] as const)("isCurrent in %s is %s", (phase, expected) => {
    const state = decided(phase);
    expect(toChampionMomentView(state)!.isCurrent).toBe(expected);
    expect(toDashboardMomentsView(state).champion !== null).toBe(expected);
  });

  it("is not current while the tournament is still in progress", () => {
    const state = decided("postseason", "in_progress");
    expect(toChampionMomentView(state)!.isCurrent).toBe(false);
  });
});
