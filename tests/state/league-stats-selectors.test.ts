import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import {
  buildLeagueStatsSortHref,
  parseLeagueStatsSort,
  PLAYER_STAT_KEYS,
  PLAYER_STATS_PAGE_SIZE,
  TEAM_STAT_KEYS,
  toPlayerStatsView,
  toTeamStatsView,
} from "@/state/league-stats-selectors";
import {
  finalGame,
  otherTeams,
  seasonDay,
  statRow,
  timelineState,
  viewerTeam,
  withGames,
} from "./media-timeline/fixtures";

function playedState(): GameState {
  const base = timelineState();
  const me = viewerTeam(base);
  const [rival, third] = otherTeams(base);
  return withGames(base, [
    finalGame(base, {
      id: "g1",
      date: seasonDay(1),
      home: me,
      away: rival!,
      homeScore: 110,
      awayScore: 100,
      stats: [
        statRow("p_me", me, {
          points: 30,
          rebounds: 10,
          fieldGoalsMade: 12,
          fieldGoalsAttempted: 20,
          turnovers: 4,
        }),
        statRow("p_rival", rival!, {
          points: 20,
          fieldGoalsMade: 1,
          fieldGoalsAttempted: 1,
          turnovers: 1,
        }),
      ],
    }),
    finalGame(base, {
      id: "g2",
      date: seasonDay(2),
      home: rival!,
      away: me,
      homeScore: 90,
      awayScore: 96,
      stats: [
        statRow("p_me", me, {
          points: 20,
          rebounds: 6,
          fieldGoalsMade: 8,
          fieldGoalsAttempted: 20,
          turnovers: 2,
        }),
        statRow("p_rival", rival!, { points: 40, turnovers: 1 }),
      ],
    }),
    // Playoff and other-team preseason games never count.
    finalGame(base, {
      id: "g3",
      date: seasonDay(3),
      home: me,
      away: third!,
      homeScore: 150,
      awayScore: 50,
      competitionType: "playoffs",
      stats: [statRow("p_me", me, { points: 99 })],
    }),
  ]);
}

describe("league stats sort params", () => {
  it("falls back to the default key and the stat's natural direction", () => {
    expect(parseLeagueStatsSort({}, TEAM_STAT_KEYS, "ppg")).toEqual({
      key: "ppg",
      dir: "desc",
    });
    expect(
      parseLeagueStatsSort({ sort: "bogus" }, TEAM_STAT_KEYS, "ppg"),
    ).toEqual({ key: "ppg", dir: "desc" });
    expect(
      parseLeagueStatsSort({ sort: "oppPpg" }, TEAM_STAT_KEYS, "ppg"),
    ).toEqual({ key: "oppPpg", dir: "asc" });
    expect(
      parseLeagueStatsSort(
        { sort: ["rpg", "apg"], dir: "asc" },
        PLAYER_STAT_KEYS,
        "ppg",
      ),
    ).toEqual({ key: "rpg", dir: "asc" });
  });

  it("flips direction on the active column and keeps extra params", () => {
    const current = { key: "ppg", dir: "desc" } as const;
    expect(
      buildLeagueStatsSortHref({ pathname: "/p", current, key: "rpg" }),
    ).toBe("/p?sort=rpg");
    expect(
      buildLeagueStatsSortHref({ pathname: "/p", current, key: "ppg" }),
    ).toBe("/p?sort=ppg&dir=asc");
    expect(
      buildLeagueStatsSortHref({
        pathname: "/p",
        current,
        key: "tov",
        extra: { show: "all" },
      }),
    ).toBe("/p?show=all&sort=tov");
  });
});

describe("toTeamStatsView", () => {
  it("averages regular-season games per team from scores and box rows", () => {
    const state = playedState();
    const me = viewerTeam(state);
    const view = toTeamStatsView(state, { key: "ppg", dir: "desc" });

    expect(view.gamesPlayed).toBe(2);
    expect(view.rows).toHaveLength(Object.keys(state.world.teams).length);
    const mine = view.rows.find((row) => row.teamId === me)!;
    expect(mine.isUserTeam).toBe(true);
    expect(mine.values).toMatchObject({
      gp: 2,
      winPct: 1,
      ppg: 103,
      oppPpg: 95,
      net: 8,
      fgPct: 50,
      rpg: 8,
      tov: 3,
    });
    expect(mine.values.threePct).toBeNull();
    expect(view.rows[0]!.teamId).toBe(me);
  });

  it("sinks teams without games whatever the direction", () => {
    const state = playedState();
    const asc = toTeamStatsView(state, { key: "ppg", dir: "asc" });
    expect(asc.rows[0]!.values.ppg).toBe(95);
    expect(asc.rows.at(-1)!.values.ppg).toBeNull();
  });

  it("is empty before any regular-season game", () => {
    const view = toTeamStatsView(timelineState(), { key: "ppg", dir: "desc" });
    expect(view.gamesPlayed).toBe(0);
  });
});

describe("toPlayerStatsView", () => {
  it("ranks qualified players by the chosen per-game stat", () => {
    const state = playedState();
    const byPoints = toPlayerStatsView(state, {
      sort: { key: "ppg", dir: "desc" },
      showAll: false,
    });
    expect(byPoints.rows.map((row) => [row.playerId, row.values.ppg])).toEqual([
      ["p_rival", 30],
      ["p_me", 25],
    ]);
    expect(byPoints.rows[1]!.isUserTeam).toBe(true);
    expect(byPoints.rows[1]!.values.fgPct).toBe(50);

    const byTurnovers = toPlayerStatsView(state, {
      sort: { key: "tov", dir: "asc" },
      showAll: false,
    });
    expect(byTurnovers.rows[0]!.playerId).toBe("p_rival");
  });

  it("drops low-volume shooters from shooting-percentage sorts", () => {
    const view = toPlayerStatsView(playedState(), {
      sort: { key: "fgPct", dir: "desc" },
      showAll: false,
    });
    // p_rival is 1-for-1 over two games: under one attempt per game.
    expect(view.rows.map((row) => row.playerId)).toEqual(["p_me"]);
  });

  it("caps the list until show all is requested", () => {
    const base = timelineState();
    const me = viewerTeam(base);
    const rival = otherTeams(base)[0]!;
    const stats = Array.from({ length: PLAYER_STATS_PAGE_SIZE + 5 }, (_, i) =>
      statRow(`p${String(i).padStart(3, "0")}`, me, { points: i }),
    );
    const state = withGames(base, [
      finalGame(base, {
        id: "g_many",
        date: seasonDay(1),
        home: me,
        away: rival,
        homeScore: 100,
        awayScore: 90,
        stats,
      }),
    ]);
    const capped = toPlayerStatsView(state, {
      sort: { key: "ppg", dir: "desc" },
      showAll: false,
    });
    expect(capped.rows).toHaveLength(PLAYER_STATS_PAGE_SIZE);
    expect(capped.totalQualified).toBe(PLAYER_STATS_PAGE_SIZE + 5);
    const all = toPlayerStatsView(state, {
      sort: { key: "ppg", dir: "desc" },
      showAll: true,
    });
    expect(all.rows).toHaveLength(PLAYER_STATS_PAGE_SIZE + 5);
  });
});
