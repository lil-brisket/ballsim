import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import { toTimelineHighlights } from "@/state/media-timeline/highlights";
import { toMediaTimelinePageView } from "@/state/media-timeline/page-view";
import { computeOwnerNavBadges } from "@/state/owner-nav-badges";
import {
  finalGame,
  otherTeams,
  seasonDay,
  timelineState,
  viewerTeam,
  withGames,
} from "./fixtures";

const SAVE = "save_test";

function playedState(): GameState {
  const base = timelineState();
  const others = otherTeams(base);
  const games = [];
  for (let day = 0; day < 3; day += 1) {
    for (let i = 0; i < 4; i += 1) {
      games.push(
        finalGame(base, {
          id: `g${day}_${i}`,
          date: seasonDay(60 + day),
          home: i === 0 ? viewerTeam(base) : others[(2 * i) % others.length]!,
          away: others[(2 * i + 1) % others.length]!,
          homeScore: 127 + i + day,
          awayScore: 100,
        }),
      );
    }
  }
  const state = withGames(base, games);
  return {
    ...state,
    world: {
      ...state.world,
      calendar: { ...state.world.calendar, currentDate: seasonDay(63) },
    },
  };
}

describe("timeline highlights", () => {
  it("leads with the same posts and text the Media Hub opens with", () => {
    const state = playedState();
    const page = toMediaTimelinePageView(state, SAVE);
    const pageLead = [page.topStory!, ...page.posts].slice(0, 3);
    const highlights = toTimelineHighlights(state, SAVE);
    expect(highlights.posts.map((p) => [p.id, p.text])).toEqual(
      pageLead.map((p) => [p.id, p.text]),
    );
  });

  it("is empty for a fresh save", () => {
    expect(toTimelineHighlights(timelineState(), SAVE).posts).toEqual([]);
  });
});

describe("media nav badge", () => {
  it("counts the same unread posts the Media Hub shows", () => {
    const state = playedState();
    const page = toMediaTimelinePageView(state, SAVE);
    expect(page.unreadCount).toBeGreaterThan(0);
    expect(computeOwnerNavBadges(state).media?.count).toBe(page.unreadCount);
  });

  it("has no media badge when nothing is unread", () => {
    expect(computeOwnerNavBadges(timelineState()).media).toBeUndefined();
  });
});
