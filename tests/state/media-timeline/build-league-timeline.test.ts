import { describe, expect, it } from "vitest";
import type { PlayoffSeries } from "@/domain/entities/playoffs";
import { asPlayoffSeriesId, asSeasonId, asTeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  buildLeagueTimeline,
  parseTimelineFilter,
  TIMELINE_LIMITS,
} from "@/state/media-timeline/build-league-timeline";
import type {
  AwardAttachment,
  InjuryAttachment,
  PlayoffAttachment,
  TimelinePost,
  TradeAttachment,
} from "@/state/media-timeline/types";
import {
  awardResult,
  seasonRecord,
  withAwards,
  withFranchiseHistory,
} from "../history-fixtures";
import {
  domainEvent,
  finalGame,
  mediaItem,
  otherTeams,
  seasonDay,
  statRow,
  FIXTURE_PLAYER_ID,
  timelineState,
  TODAY,
  viewerTeam,
  withGames,
  withFixturePlayer,
  withMedia,
} from "./fixtures";

function allPosts(state: GameState): TimelinePost[] {
  return buildLeagueTimeline(state, { limit: 10_000 }).posts;
}

describe("awards", () => {
  const empty = timelineState();
  const [a, b] = otherTeams(empty);
  const base = withFixturePlayer(empty, a!);
  const year = base.competition.season.year;
  const seasonId = base.competition.season.id;
  const winnerId = FIXTURE_PLAYER_ID;
  const lastRegular = finalGame(base, {
    id: "last",
    date: seasonDay(5),
    home: a!,
    away: b!,
    homeScore: 100,
    awayScore: 99,
  });

  function award(
    awardId: Parameters<typeof awardResult>[0]["awardId"],
    period: string | null,
    seasonYear = year,
  ) {
    const result = awardResult({
      awardId,
      seasonYear,
      winnerId,
      teamId: a,
      period,
    });
    return seasonYear === year ? { ...result, seasonId } : result;
  }

  it("dates monthly awards to the 1st of the next month and yearly to the last regular-season day", () => {
    const monthly = award("player_of_month", "2026-10");
    const mvp = award("mvp", null);
    mvp.context.statSnapshot.perGame.points = 28.4;
    mvp.context.statSnapshot.perGame.rebounds = 7.1;
    mvp.context.statSnapshot.perGame.assists = 6.2;
    mvp.context.statSnapshot.teamRecord = {
      wins: 50,
      losses: 12,
      winPct: 0.806,
    };
    const state = withGames(withAwards(base, [monthly, mvp]), [lastRegular]);

    const posts = allPosts(state);
    const monthlyPost = posts.find((p) => p.id === `award:${monthly.id}`);
    const mvpPost = posts.find((p) => p.id === `award:${mvp.id}`);
    expect(monthlyPost?.occurredOn).toBe("2026-11-01");
    expect(mvpPost?.occurredOn).toBe(lastRegular.date);
    expect(mvpPost?.importance).toBe("critical");
    const attachment = mvpPost?.attachment as AwardAttachment;
    expect(attachment.winner?.playerId).toBe(winnerId);
    expect(attachment.awardName).toBe("Most Valuable Player");
    expect(attachment.stats).toEqual([
      { label: "PPG", value: "28.4" },
      { label: "RPG", value: "7.1" },
      { label: "APG", value: "6.2" },
    ]);
    expect(attachment.teamRecord).toEqual({ wins: 50, losses: 12 });
  });

  it("skips legacy midseason awards", () => {
    const state = withAwards(base, [award("midseason_mvp", "midseason")]);
    expect(allPosts(state).filter((p) => p.kind === "award")).toEqual([]);
  });

  it("includes last season's yearly awards dated to its last archived regular-season game", () => {
    const previous = award("mvp", null, year - 1);
    const monthlyPrevious = award(
      "player_of_month",
      `${year - 1}-11`,
      year - 1,
    );
    const archived = {
      ...finalGame(base, {
        id: "old",
        date: `${year}-04-10`,
        home: a!,
        away: b!,
        homeScore: 100,
        awayScore: 90,
      }),
      seasonId: asSeasonId(`season_${year - 1}`),
    };
    const withArchive: GameState = {
      ...base,
      business: { ...base.business, gameArchive: { old: archived } },
    };
    const posts = allPosts(
      withAwards(withArchive, [previous, monthlyPrevious]),
    );
    expect(posts.map((p) => [p.id, p.occurredOn])).toEqual([
      [`award:${previous.id}`, `${year}-04-10`],
    ]);
  });
});

describe("playoffs", () => {
  const base = timelineState();
  const [a, b, c, d] = otherTeams(base);

  function series(
    id: string,
    round: number,
    higher: string | null,
    lower: string | null,
    gameIds: string[],
    wins: Record<string, number>,
    winner?: string,
  ): PlayoffSeries {
    return {
      id: asPlayoffSeriesId(id),
      round,
      slot: 0,
      higherSeed: 1,
      lowerSeed: 2,
      higherSeedTeamId: higher ? asTeamId(higher) : null,
      lowerSeedTeamId: lower ? asTeamId(lower) : null,
      wins,
      gameIds: gameIds as PlayoffSeries["gameIds"],
      status: winner ? "complete" : "pending",
      ...(winner ? { winnerTeamId: asTeamId(winner) } : {}),
    };
  }

  function withPlayoffs(state: GameState, all: PlayoffSeries[]): GameState {
    return {
      ...state,
      competition: {
        ...state.competition,
        playoffs: {
          status: "in_progress",
          fieldSize: 4,
          qualifiedTeams: [],
          series: all,
        },
      },
    };
  }

  const sweepGames = [0, 1, 2, 3].map((i) =>
    finalGame(base, {
      id: `po_${i}`,
      date: seasonDay(200 + i),
      home: a!,
      away: b!,
      homeScore: 110,
      awayScore: 100,
      competitionType: "playoffs",
    }),
  );

  it("posts a series win with the final series score and sweep flag", () => {
    const state = withGames(
      withPlayoffs(
        {
          ...base,
          world: {
            ...base.world,
            calendar: { ...base.world.calendar, currentDate: "2027-06-01" },
          },
        },
        [
          series(
            "s1",
            0,
            a!,
            b!,
            sweepGames.map((g) => g.id),
            { [a!]: 4, [b!]: 0 },
            a!,
          ),
          series("s2", 0, c!, d!, [], {}),
          series("f", 1, null, null, [], {}),
        ],
      ),
      sweepGames,
    );
    const posts = allPosts(state);
    const post = posts.find((p) => p.id === "playoff:s1");
    const attachment = post?.attachment as PlayoffAttachment;
    expect(post?.occurredOn).toBe(sweepGames[3]!.date);
    expect(attachment.event).toBe("series_won");
    expect(attachment.seriesScore).toEqual({ winner: 4, loser: 0 });
    expect(attachment.sweep).toBe(true);
    expect(attachment.roundLabel).toBe("Semifinals");
    const lastGame = posts.find((p) => p.id === "game:po_3");
    expect(lastGame?.attachment).toMatchObject({
      reasons: ["playoff"],
      series: {
        seriesId: "s1",
        gameNumber: 4,
        winsToClinch: 4,
        wins: { [a!]: 4, [b!]: 0 },
      },
    });
  });

  it("posts the champion when the final series completes", () => {
    const state = withGames(
      withPlayoffs(
        {
          ...base,
          world: {
            ...base.world,
            calendar: { ...base.world.calendar, currentDate: "2027-06-01" },
          },
        },
        [
          series(
            "f",
            0,
            a!,
            b!,
            sweepGames.map((g) => g.id),
            { [a!]: 4, [b!]: 0 },
            a!,
          ),
        ],
      ),
      sweepGames,
    );
    const champion = allPosts(state).find(
      (p) => p.id === `playoff:champion:${base.competition.season.id}`,
    );
    expect(champion?.importance).toBe("critical");
    expect((champion?.attachment as PlayoffAttachment).winner.teamId).toBe(a);
  });

  it("posts last season's champion from franchise history", () => {
    const year = base.competition.season.year;
    const archived = {
      ...finalGame(base, {
        id: "old_final",
        date: `${year}-06-12`,
        home: a!,
        away: b!,
        homeScore: 100,
        awayScore: 90,
        competitionType: "playoffs",
      }),
      seasonId: asSeasonId(`season_${year - 1}`),
    };
    const state = withFranchiseHistory(
      {
        ...base,
        business: { ...base.business, gameArchive: { old_final: archived } },
      },
      { [a!]: [seasonRecord({ year: year - 1, championship: true })] },
    );
    const post = allPosts(state).find((p) => p.kind === "playoff");
    expect(post?.occurredOn).toBe(`${year}-06-12`);
    expect((post?.attachment as PlayoffAttachment).event).toBe(
      "previous_champion",
    );
  });
});

describe("media items", () => {
  const empty = timelineState();
  const viewer = viewerTeam(empty);
  const [a, b] = otherTeams(empty);
  const base = withFixturePlayer(empty, a!);
  const playerId = FIXTURE_PLAYER_ID;

  const gameEvent = domainEvent("e_game", "GameCompleted", TODAY, {
    gameId: "g",
  });
  const tradeLeg1 = domainEvent("e_t1", "PlayerTraded", "2026-11-28", {
    playerId,
    fromTeamId: a,
    toTeamId: b,
  });
  const tradeLeg2 = domainEvent("e_t2", "PlayerTraded", "2026-11-28", {
    playerId: "unknown_player",
    fromTeamId: b,
    toTeamId: a,
  });
  const injury = domainEvent("e_inj", "PlayerInjured", "2026-11-29", {
    playerId,
    teamId: a,
    injuryId: "inj1",
    severity: "major",
    bodyPart: "knee",
  });
  const signing = domainEvent("e_sign", "FreeAgentSigned", "2026-11-20", {
    playerId,
    teamId: viewer,
  });
  const items = [
    mediaItem(gameEvent, { storyType: "game", gameId: "g" as never }),
    mediaItem(tradeLeg1, {
      storyType: "transaction",
      storyGroupId: "trade_x",
      teamIds: [a!, b!] as never,
    }),
    mediaItem(tradeLeg2, {
      storyType: "transaction",
      storyGroupId: "trade_x",
      teamIds: [a!, b!] as never,
    }),
    mediaItem(injury, {
      storyType: "injury",
      importance: "high",
      teamIds: [a!] as never,
    }),
    mediaItem(signing, {
      storyType: "transaction",
      importance: "high",
      teamIds: [viewer],
    }),
  ];

  it("drops game results, merges trade legs and maps injuries and signings", () => {
    const state = withMedia(
      base,
      [gameEvent, tradeLeg1, tradeLeg2, injury, signing],
      items,
    );
    const posts = allPosts(state);
    expect(posts.map((p) => [p.id, p.kind])).toEqual([
      [`media:${items[3]!.id}`, "injury"],
      ["media:trade_x", "trade"],
      [`media:${items[4]!.id}`, "signing"],
    ]);
    const trade = posts[1]!.attachment as TradeAttachment;
    expect(trade.movements).toEqual([
      expect.objectContaining({
        fromTeamId: a,
        toTeamId: b,
        player: expect.objectContaining({ playerId }),
      }),
    ]);
    expect(trade.otherPieces).toEqual([items[2]!.headline]);
    const inj = posts[0]!.attachment as InjuryAttachment;
    expect(inj).toMatchObject({ severity: "major", bodyPart: "knee" });
  });

  it("marks posts unread only inside the window and honours read state", () => {
    const state = withMedia(
      base,
      [gameEvent, tradeLeg1, tradeLeg2, injury, signing],
      items,
      {
        [items[3]!.id]: { readAt: TODAY },
      },
    );
    const timeline = buildLeagueTimeline(state, { limit: 100 });
    const unread = Object.fromEntries(
      timeline.posts.map((p) => [p.id, p.unread]),
    );
    expect(unread).toEqual({
      [`media:${items[3]!.id}`]: false,
      "media:trade_x": true,
      [`media:${items[4]!.id}`]: false,
    });
    expect(timeline.unreadCount).toBe(1);
  });
});

describe("buildLeagueTimeline", () => {
  const base = timelineState();
  const viewer = viewerTeam(base);
  const others = otherTeams(base);

  function blowoutDay(day: number, count: number) {
    return Array.from({ length: count }, (_, i) =>
      finalGame(base, {
        id: `b${day}_${i}`,
        date: seasonDay(day),
        home: others[(2 * i) % others.length]!,
        away: others[(2 * i + 1) % others.length]!,
        homeScore: 130 + i,
        awayScore: 100,
      }),
    );
  }

  const busy = withGames(base, [
    ...blowoutDay(40, 9),
    ...blowoutDay(41, 3),
    finalGame(base, {
      id: "mine",
      date: seasonDay(40),
      home: viewer,
      away: others[0]!,
      homeScore: 100,
      awayScore: 99,
    }),
  ]);

  it("caps league-wide posts per day but never the viewer's team", () => {
    const posts = allPosts(busy);
    const day40 = posts.filter((p) => p.occurredOn === seasonDay(40));
    expect(day40.filter((p) => !p.teamIds.includes(viewer))).toHaveLength(
      TIMELINE_LIMITS.dailyLeagueCap + 1,
    );
    expect(day40.some((p) => p.id === "game:mine")).toBe(true);
    // The top story survives the cap even when relevance ranks it low.
    expect(day40.some((p) => p.id === "game:b40_8")).toBe(true);
  });

  it("orders newest day first and pages through every post exactly once", () => {
    const all = allPosts(busy);
    expect(all[0]!.occurredOn).toBe(seasonDay(41));
    const seen: string[] = [];
    let before: string | null = null;
    for (let guard = 0; guard < 50; guard += 1) {
      const page = buildLeagueTimeline(busy, { limit: 3, before });
      seen.push(...page.posts.map((p) => p.id));
      before = page.nextCursor;
      if (!before) break;
    }
    expect(seen).toEqual(all.map((p) => p.id));
  });

  it("filters to the viewer's team and to scores", () => {
    const mine = buildLeagueTimeline(busy, { filter: "your-team", limit: 100 });
    expect(mine.posts.map((p) => p.id)).toEqual(["game:mine"]);
    const moves = buildLeagueTimeline(busy, { filter: "moves", limit: 100 });
    expect(moves.posts).toEqual([]);
    expect(parseTimelineFilter("nope")).toBe("for-you");
    expect(parseTimelineFilter("awards")).toBe("awards");
  });

  it("picks a top story, the latest scores and trending tags", () => {
    const timeline = buildLeagueTimeline(busy);
    // Day 40's 38-point blowout outranks everything in the last 3 game days.
    expect(timeline.topStory?.id).toBe("game:b40_8");
    expect(timeline.scores.map((s) => s.gameId)).toEqual([
      "b41_0",
      "b41_1",
      "b41_2",
    ]);
    expect(timeline.trending.length).toBeGreaterThan(0);
    expect(timeline.trending.length).toBeLessThanOrEqual(
      TIMELINE_LIMITS.trendingCount,
    );
  });

  it("hides posts dated after the current date", () => {
    const future = withGames(base, [
      finalGame(base, {
        id: "future",
        date: "2027-01-15",
        home: viewer,
        away: others[0]!,
        homeScore: 100,
        awayScore: 90,
      }),
    ]);
    expect(allPosts(future)).toEqual([]);
  });

  it("returns the same timeline for the same state", () => {
    const again = withGames(base, [
      ...blowoutDay(40, 9),
      ...blowoutDay(41, 3),
      finalGame(base, {
        id: "mine",
        date: seasonDay(40),
        home: viewer,
        away: others[0]!,
        homeScore: 100,
        awayScore: 99,
      }),
    ]);
    expect(JSON.stringify(buildLeagueTimeline(again, { limit: 100 }))).toBe(
      JSON.stringify(buildLeagueTimeline(busy, { limit: 100 })),
    );
  });

  it("builds a full season of games within the time budget", () => {
    const teams = Object.keys(base.world.teams).sort();
    const games = [];
    for (let i = 0; i < 1_230; i += 1) {
      const day = Math.floor(i / 6);
      const slot = i % 6;
      const home = teams[(2 * slot + day) % teams.length]!;
      const away = teams[(2 * slot + 1 + day) % teams.length]!;
      const homeScore = 90 + ((i * 7) % 45);
      const awayScore = 90 + ((i * 11) % 41);
      games.push(
        finalGame(base, {
          id: `s${i}`,
          date: seasonDay(day),
          home,
          away,
          homeScore: homeScore === awayScore ? homeScore + 1 : homeScore,
          awayScore,
          stats: Array.from({ length: 20 }, (_, p) =>
            statRow(`pl${p}_${i % 30}`, p < 10 ? home : away, {
              points: (i * (p + 3)) % 45,
              rebounds: (i + p) % 15,
              assists: (i * p) % 12,
            }),
          ),
        }),
      );
    }
    const season = {
      ...withGames(base, games),
      world: {
        ...base.world,
        calendar: { ...base.world.calendar, currentDate: "2027-04-20" },
      },
    };
    buildLeagueTimeline(withGames(base, games.slice(0, 50)));
    const started = performance.now();
    const timeline = buildLeagueTimeline(season);
    const elapsed = performance.now() - started;
    console.info(
      `media timeline: 1,230 games built in ${elapsed.toFixed(1)} ms`,
    );
    expect(timeline.posts.length).toBeGreaterThan(0);
    // About 30 ms alone (budget 50 ms). The bound is loose because the full
    // suite runs in parallel; it still catches a quadratic regression.
    expect(elapsed).toBeLessThan(1_000);
  });
});
