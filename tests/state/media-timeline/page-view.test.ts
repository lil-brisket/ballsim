import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import {
  mediaPageHref,
  parseMediaPageFilter,
  toMediaTimelinePageView,
} from "@/state/media-timeline/page-view";
import {
  finalGame,
  otherTeams,
  seasonDay,
  timelineState,
  viewerTeam,
  withGames,
} from "./fixtures";

const SAVE = "save_test";

/** A busy fixture: 25 blowouts over 5 days plus one viewer game. */
function busyState(): GameState {
  const base = timelineState();
  const others = otherTeams(base);
  const games = [];
  for (let day = 0; day < 5; day += 1) {
    for (let i = 0; i < 5; i += 1) {
      games.push(
        finalGame(base, {
          id: `b${day}_${i}`,
          date: seasonDay(50 + day),
          home: others[(2 * i) % others.length]!,
          away: others[(2 * i + 1) % others.length]!,
          homeScore: 126 + i + day,
          awayScore: 100,
        }),
      );
    }
  }
  games.push(
    finalGame(base, {
      id: "mine",
      date: seasonDay(54),
      home: viewerTeam(base),
      away: others[0]!,
      homeScore: 101,
      awayScore: 99,
    }),
  );
  return withGames(base, games);
}

describe("parseMediaPageFilter", () => {
  it("accepts the timeline filters", () => {
    expect(parseMediaPageFilter({ filter: "injuries" })).toBe("injuries");
    expect(parseMediaPageFilter({})).toBe("for-you");
    expect(parseMediaPageFilter({ filter: "nope" })).toBe("for-you");
  });

  it("maps the old tabs and Latest chips onto the new filters", () => {
    expect(parseMediaPageFilter({ tab: "social" })).toBe("for-you");
    expect(parseMediaPageFilter({ tab: "latest" })).toBe("for-you");
    expect(parseMediaPageFilter({ tab: "games" })).toBe("scores");
    expect(parseMediaPageFilter({ tab: "transactions" })).toBe("moves");
    expect(parseMediaPageFilter({ tab: "team" })).toBe("your-team");
    expect(parseMediaPageFilter({ tab: "injuries" })).toBe("injuries");
    expect(parseMediaPageFilter({ tab: "league" })).toBe("league");
    expect(parseMediaPageFilter({ filter: "game" })).toBe("scores");
    expect(parseMediaPageFilter({ filter: "trends" })).toBe("for-you");
    // A new filter value wins over an old tab.
    expect(parseMediaPageFilter({ filter: "awards", tab: "games" })).toBe(
      "awards",
    );
  });
});

describe("toMediaTimelinePageView", () => {
  it("shows a league-office welcome post on a fresh save", () => {
    const view = toMediaTimelinePageView(timelineState(), SAVE);
    expect(view.posts).toHaveLength(1);
    expect(view.posts[0]!.author.kind).toBe("league");
    expect(view.emptyMessage).toBeNull();
    expect(view.topStory).toBeNull();
    expect(view.scores).toEqual([]);
  });

  it("shows a quiet message for an empty filter", () => {
    const view = toMediaTimelinePageView(busyState(), SAVE, {
      filter: "injuries",
    });
    expect(view.posts).toEqual([]);
    expect(view.emptyMessage).toBe("No injuries reported.");
  });

  it("pulls the top story above the feed and never repeats it", () => {
    const state = busyState();
    const first = toMediaTimelinePageView(state, SAVE);
    expect(first.topStory).not.toBeNull();
    const seen = new Set<string>([first.topStory!.id]);
    let view = first;
    for (let guard = 0; guard < 20; guard += 1) {
      for (const post of view.posts) {
        expect(seen.has(post.id), post.id).toBe(false);
        seen.add(post.id);
      }
      if (!view.loadMoreHref) break;
      const before = new URL(view.loadMoreHref, "http://x").searchParams.get(
        "before",
      );
      view = toMediaTimelinePageView(state, SAVE, { before });
      expect(view.topStory).toBeNull();
    }
    expect(view.loadMoreHref).toBeNull();
  });

  it("keeps the filter in load-more links and marks the active filter", () => {
    const view = toMediaTimelinePageView(busyState(), SAVE, {
      filter: "scores",
    });
    expect(view.topStory).toBeNull();
    expect(view.filters.find((f) => f.active)?.filter).toBe("scores");
    if (view.loadMoreHref) {
      const url = new URL(view.loadMoreHref, "http://x");
      expect(url.searchParams.get("filter")).toBe("scores");
      expect(url.searchParams.get("before")).toBeTruthy();
    }
    expect(view.returnPath).toBe(`/dashboard/${SAVE}/media?filter=scores`);
  });

  it("filters by a trending tag", () => {
    const state = busyState();
    const view = toMediaTimelinePageView(state, SAVE);
    const trend = view.trending[0]!;
    expect(trend.href).toBe(mediaPageHref(SAVE, { tag: trend.tag }));
    const tagged = toMediaTimelinePageView(state, SAVE, { tag: trend.tag });
    expect(tagged.posts.length).toBeGreaterThan(0);
    expect(tagged.filters.some((f) => f.active)).toBe(false);
  });

  it("lists the latest game day's scores with box score links", () => {
    const view = toMediaTimelinePageView(busyState(), SAVE);
    expect(view.scores.map((s) => s.gameId).sort()).toEqual(
      ["b4_0", "b4_1", "b4_2", "b4_3", "b4_4", "mine"].sort(),
    );
    expect(view.scoresDateLabel).toBe("Nov 24");
    expect(view.scores[0]!.href).toMatch(/\/games\//);
    expect(
      view.scores.filter((s) => s.isUserGame).map((s) => s.gameId),
    ).toEqual(["mine"]);
  });

  it("puts the unread count on For you", () => {
    const state = busyState();
    const view = toMediaTimelinePageView(
      {
        ...state,
        world: {
          ...state.world,
          calendar: { ...state.world.calendar, currentDate: seasonDay(55) },
        },
      },
      SAVE,
    );
    const forYou = view.filters.find((f) => f.filter === "for-you")!;
    expect(view.unreadCount).toBeGreaterThan(0);
    expect(forYou.badge).toBe(view.unreadCount);
  });
});
