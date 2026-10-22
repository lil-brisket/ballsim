import { describe, expect, it } from "vitest";
import { buildLeagueTimeline } from "@/state/media-timeline/build-league-timeline";
import { largestWinnerDeficit } from "@/state/media-timeline/detect-games";
import { performanceReasons } from "@/state/media-timeline/detect-performances";
import { streakEvent } from "@/state/media-timeline/detect-streaks";
import type { GameState } from "@/state/game-state";
import type {
  GameAttachment,
  PerformanceAttachment,
  TimelinePost,
} from "@/state/media-timeline/types";
import {
  finalGame,
  otherTeams,
  seasonDay,
  statRow,
  timelineState,
  viewerTeam,
  withGames,
} from "./fixtures";

function allPosts(state: GameState): TimelinePost[] {
  return buildLeagueTimeline(state, { limit: 10_000 }).posts;
}

function gamePost(state: GameState, gameId: string) {
  return allPosts(state).find((post) => post.id === `game:${gameId}`);
}

describe("detectGames", () => {
  const base = timelineState();
  const [a, b] = otherTeams(base);

  it("skips a routine game between other teams", () => {
    const state = withGames(base, [
      finalGame(base, {
        id: "g1",
        date: seasonDay(1),
        home: a!,
        away: b!,
        homeScore: 104,
        awayScore: 98,
      }),
    ]);
    expect(allPosts(state)).toEqual([]);
  });

  it("posts every game the viewer's team plays", () => {
    const state = withGames(base, [
      finalGame(base, {
        id: "g1",
        date: seasonDay(1),
        home: viewerTeam(base),
        away: b!,
        homeScore: 101,
        awayScore: 99,
      }),
    ]);
    const post = gamePost(state, "g1");
    expect(post?.attachment).toMatchObject({ reasons: ["user_team"] });
  });

  it("flags a blowout at 25 points but not 24", () => {
    const state = withGames(base, [
      finalGame(base, {
        id: "at",
        date: seasonDay(1),
        home: a!,
        away: b!,
        homeScore: 125,
        awayScore: 100,
      }),
      finalGame(base, {
        id: "below",
        date: seasonDay(2),
        home: a!,
        away: b!,
        homeScore: 124,
        awayScore: 100,
      }),
    ]);
    expect(gamePost(state, "at")?.attachment).toMatchObject({
      reasons: ["blowout"],
      margin: 25,
    });
    expect(gamePost(state, "below")).toBeUndefined();
  });

  it("flags overtime and counts the extra periods", () => {
    const periods = [
      { home: 25, away: 25 },
      { home: 25, away: 25 },
      { home: 25, away: 25 },
      { home: 25, away: 25 },
      { home: 10, away: 10 },
      { home: 12, away: 8 },
    ];
    const state = withGames(base, [
      finalGame(base, {
        id: "ot",
        date: seasonDay(1),
        home: a!,
        away: b!,
        homeScore: 122,
        awayScore: 118,
        periods,
      }),
    ]);
    const attachment = gamePost(state, "ot")?.attachment as GameAttachment;
    expect(attachment.reasons).toEqual(["overtime"]);
    expect(attachment.overtimePeriods).toBe(2);
    expect(attachment.periodScores).toEqual(periods);
    expect(attachment.score).toEqual({ home: 122, away: 118 });
  });

  it("flags a comeback from 15 down but not 14", () => {
    expect(
      largestWinnerDeficit(
        [
          { home: 20, away: 35 },
          { home: 30, away: 20 },
        ],
        true,
      ),
    ).toBe(15);
    const comeback = (id: string, deficit: number, day: number) =>
      finalGame(base, {
        id,
        date: seasonDay(day),
        home: a!,
        away: b!,
        homeScore: 100,
        awayScore: 98,
        periods: [
          { home: 20, away: 20 + deficit },
          { home: 25, away: 25 },
          { home: 25, away: 25 },
          { home: 30, away: 28 - deficit },
        ],
      });
    const state = withGames(base, [
      comeback("c15", 15, 1),
      comeback("c14", 14, 2),
    ]);
    expect(gamePost(state, "c15")?.attachment).toMatchObject({
      reasons: ["comeback"],
      comebackDeficit: 15,
    });
    expect(gamePost(state, "c14")).toBeUndefined();
  });

  it("flags an upset when the winner's win% trailed by .250 or more", () => {
    const [fav, dog, ...pool] = otherTeams(base);
    const history = (team: string, wins: number, losses: number) =>
      Array.from({ length: wins + losses }, (_, i) =>
        finalGame(base, {
          id: `h_${team}_${i}`,
          date: seasonDay(i),
          home: team,
          away: pool[i % pool.length]!,
          homeScore: i < wins ? 100 : 90,
          awayScore: i < wins ? 95 : 96,
        }),
      );
    const decider = (id: string, day: number) =>
      finalGame(base, {
        id,
        date: seasonDay(day),
        home: fav!,
        away: dog!,
        homeScore: 99,
        awayScore: 101,
      });
    // .750 vs .500: exactly at the threshold.
    const atThreshold = withGames(base, [
      ...history(fav!, 15, 5),
      ...history(dog!, 10, 10),
      decider("upset", 30),
    ]);
    expect(gamePost(atThreshold, "upset")?.attachment).toMatchObject({
      reasons: ["upset"],
      winPctBefore: { home: 0.75, away: 0.5 },
    });
    // .700 vs .500: just below.
    const below = withGames(base, [
      ...history(fav!, 14, 6),
      ...history(dog!, 10, 10),
      decider("no_upset", 30),
    ]);
    expect(gamePost(below, "no_upset")).toBeUndefined();
  });

  it("reports each team's top performer from the box score", () => {
    const state = withGames(base, [
      finalGame(base, {
        id: "box",
        date: seasonDay(1),
        home: viewerTeam(base),
        away: b!,
        homeScore: 110,
        awayScore: 100,
        stats: [
          statRow("p1", viewerTeam(base), { points: 31, rebounds: 9 }),
          statRow("p2", viewerTeam(base), { points: 12 }),
          statRow("p3", b!, { points: 27, assists: 11 }),
        ],
      }),
    ]);
    const attachment = gamePost(state, "box")?.attachment as GameAttachment;
    expect(attachment.topPerformers.home?.player.playerId).toBe("p1");
    expect(attachment.topPerformers.home?.line.points).toBe(31);
    expect(attachment.topPerformers.home?.line.rebounds).toBe(9);
    expect(attachment.topPerformers.away?.player.playerId).toBe("p3");
    expect(attachment.topPerformers.away?.line.assists).toBe(11);
  });
});

describe("detectPerformances", () => {
  it("applies each threshold at the line and not one below", () => {
    const zero = { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 };
    expect(performanceReasons({ ...zero, points: 40 })).toEqual([
      "forty_points",
    ]);
    expect(performanceReasons({ ...zero, points: 39 })).toEqual([]);
    expect(performanceReasons({ ...zero, points: 20, rebounds: 20 })).toEqual([
      "twenty_twenty",
    ]);
    expect(performanceReasons({ ...zero, points: 20, rebounds: 19 })).toEqual(
      [],
    );
    expect(
      performanceReasons({ ...zero, points: 10, rebounds: 10, assists: 10 }),
    ).toEqual(["triple_double"]);
    expect(
      performanceReasons({ ...zero, points: 10, rebounds: 10, assists: 9 }),
    ).toEqual([]);
    expect(performanceReasons({ ...zero, blocks: 8 })).toEqual(["blocks"]);
    expect(performanceReasons({ ...zero, blocks: 7 })).toEqual([]);
    expect(performanceReasons({ ...zero, steals: 7 })).toEqual(["steals"]);
    expect(performanceReasons({ ...zero, steals: 6 })).toEqual([]);
    expect(performanceReasons({ ...zero, assists: 15 })).toEqual(["assists"]);
    expect(performanceReasons({ ...zero, assists: 14 })).toEqual([]);
  });

  it("posts one performance per game, the most notable, with its box line", () => {
    const base = timelineState();
    const [a, b] = otherTeams(base);
    const state = withGames(base, [
      finalGame(base, {
        id: "g",
        date: seasonDay(1),
        home: a!,
        away: b!,
        homeScore: 120,
        awayScore: 110,
        stats: [
          statRow("big", a!, { points: 44, rebounds: 7, assists: 3 }),
          statRow("td", b!, { points: 12, rebounds: 10, assists: 10 }),
        ],
      }),
    ]);
    const perfs = allPosts(state).filter((p) => p.kind === "performance");
    expect(perfs).toHaveLength(1);
    const attachment = perfs[0]!.attachment as PerformanceAttachment;
    expect(attachment.player.playerId).toBe("big");
    expect(attachment.line).toMatchObject({
      points: 44,
      rebounds: 7,
      assists: 3,
    });
    expect(attachment.reasons).toEqual(["forty_points"]);
    expect(attachment.won).toBe(true);
    expect(attachment.opponent.teamId).toBe(b);
  });

  it("marks a season high only after the opening game days", () => {
    const base = timelineState();
    const [a, b] = otherTeams(base);
    const day = (n: number, points: number) =>
      finalGame(base, {
        id: `d${n}`,
        date: seasonDay(n),
        home: a!,
        away: b!,
        homeScore: 100,
        awayScore: 95,
        stats: [statRow(`p${n}`, a!, { points })],
      });
    const games = Array.from({ length: 10 }, (_, n) => day(n, 25));
    const state = withGames(base, [...games, day(10, 32), day(11, 31)]);
    const perfIds = allPosts(state)
      .filter((p) => p.kind === "performance")
      .map((p) => p.id);
    expect(perfIds).toEqual([`perf:d10:p10`]);
  });
});

describe("streakEvent", () => {
  it("posts win streaks at 5 and every 5 after", () => {
    expect(streakEvent(4, 5)).toEqual({ kind: "win_streak", length: 5 });
    expect(streakEvent(5, 6)).toBeNull();
    expect(streakEvent(9, 10)).toEqual({ kind: "win_streak", length: 10 });
  });

  it("posts losing streaks at 7 and every 5 after", () => {
    expect(streakEvent(-6, -7)).toEqual({ kind: "losing_streak", length: 7 });
    expect(streakEvent(-5, -6)).toBeNull();
    expect(streakEvent(-11, -12)).toEqual({
      kind: "losing_streak",
      length: 12,
    });
  });

  it("posts a snapped win streak of 8 or more", () => {
    expect(streakEvent(8, -1)).toEqual({ kind: "streak_snapped", length: 8 });
    expect(streakEvent(7, -1)).toBeNull();
  });

  it("detects streaks from the season's results", () => {
    const base = timelineState();
    const [a, ...pool] = otherTeams(base);
    const games = Array.from({ length: 5 }, (_, i) =>
      finalGame(base, {
        id: `w${i}`,
        date: seasonDay(i),
        home: a!,
        away: pool[i]!,
        homeScore: 100,
        awayScore: 90,
      }),
    );
    const posts = allPosts(withGames(base, games));
    expect(posts.filter((p) => p.kind === "streak").map((p) => p.id)).toEqual([
      `streak:w4:${a}`,
    ]);
  });
});
