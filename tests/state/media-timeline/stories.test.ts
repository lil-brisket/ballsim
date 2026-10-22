import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import { toMediaTimelinePageView } from "@/state/media-timeline/page-view";
import {
  buildMediaStories,
  STORY_SLIDE_LIMIT,
} from "@/state/media-timeline/stories";
import {
  finalGame,
  otherTeams,
  seasonDay,
  statRow,
  timelineState,
  viewerTeam,
  withGames,
} from "./fixtures";

const SAVE = "save_test";

function atDay(state: GameState, day: number): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      calendar: { ...state.world.calendar, currentDate: seasonDay(day) },
    },
  };
}

function storyState(): GameState {
  const base = timelineState();
  const viewer = viewerTeam(base);
  const others = otherTeams(base);
  return atDay(
    withGames(base, [
      // Older blowout: outside "Last night".
      finalGame(base, {
        id: "old",
        date: seasonDay(50),
        home: others[0]!,
        away: others[1]!,
        homeScore: 130,
        awayScore: 100,
      }),
      finalGame(base, {
        id: "mine",
        date: seasonDay(52),
        home: viewer,
        away: others[2]!,
        homeScore: 101,
        awayScore: 99,
      }),
      ...Array.from({ length: 10 }, (_, i) =>
        finalGame(base, {
          id: `late${i}`,
          date: seasonDay(53),
          home: others[(2 * i) % others.length]!,
          away: others[(2 * i + 1) % others.length]!,
          homeScore: 130 + i,
          awayScore: 100,
          stats:
            i === 0
              ? [statRow("big", others[0]!, { points: 45, rebounds: 8 })]
              : [],
        }),
      ),
    ]),
    54,
  );
}

describe("buildMediaStories", () => {
  it("builds only rings that have slides, in a fixed order", () => {
    const { rings } = buildMediaStories(storyState(), SAVE);
    expect(rings.map((r) => r.key)).toEqual([
      "last-night",
      "top-performers",
      "your-team",
    ]);
  });

  it("keeps Last night to the latest game day and caps slides", () => {
    const { rings } = buildMediaStories(storyState(), SAVE);
    const lastNight = rings.find((r) => r.key === "last-night")!;
    expect(lastNight.slides.length).toBeLessThanOrEqual(STORY_SLIDE_LIMIT);
    expect(lastNight.slides.every((s) => s.occurredOn === seasonDay(53))).toBe(
      true,
    );
    expect(lastNight.latestOn).toBe(seasonDay(53));
  });

  it("covers the viewer's recent games and the night's big performance", () => {
    const { rings, context } = buildMediaStories(storyState(), SAVE);
    const mine = rings.find((r) => r.key === "your-team")!;
    expect(mine.slides.map((s) => s.id)).toEqual(["game:mine"]);
    const perf = rings.find((r) => r.key === "top-performers")!;
    expect(perf.slides.map((s) => s.id)).toEqual(["perf:late0:big"]);
    expect(Object.keys(context.teams).length).toBeGreaterThan(0);
  });

  it("is empty for a fresh save", () => {
    expect(buildMediaStories(timelineState(), SAVE).rings).toEqual([]);
  });

  it("appears on the first For you page only", () => {
    const state = storyState();
    expect(toMediaTimelinePageView(state, SAVE).stories.rings.length).toBe(3);
    expect(
      toMediaTimelinePageView(state, SAVE, { filter: "scores" }).stories.rings,
    ).toEqual([]);
  });
});
